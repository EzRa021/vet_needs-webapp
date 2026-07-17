import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { calcTotals } from '@/lib/pricing'
import { resolveShipping } from '@/lib/shipping'
import { allow, TOO_MANY } from '@/lib/rate-limit'

// POST /api/checkout/create-order - Create a new order
//
// SECURITY: prices and totals are computed from the database; the client only
// sends item ids + quantities.
//
// That sentence was already here before migration 010 — and was worthless,
// because the client could skip this route entirely and POST its own order to
// PostgREST (the insert policy only checked `auth.uid() = user_id`). It's true
// now because 010 removed that policy: this route is the ONLY writer of orders,
// and 010's trigger re-prices every line as a backstop.
export async function POST(request) {
  try {
    const supabase = await createClient()

    // No auth gate: guests may buy (migration 011). `user` is simply null for
    // them, and every branch below has to cope with that. It is still the
    // SESSION that decides who the order belongs to — never the request body —
    // so a guest cannot claim to be a signed-in customer.
    const { data: { user } } = await supabase.auth.getUser()

    // Guests can create orders (011), so this is now an unauthenticated write
    // path. The order itself is safe — server-priced (010), idempotency-keyed
    // (006/011) — but nothing stopped a script filling the table with junk
    // pending rows. Generous enough that a real shopper retrying never sees it.
    if (!(await allow(request, 'order'))) {
      return NextResponse.json({ error: TOO_MANY }, { status: 429 })
    }

    const body = await request.json()
    const { items, shippingInfo, orderNotes, couponCode, idempotencyKey } = body

    // Idempotency key: optional, but when present it makes a repeated submit
    // (double-click, retry, refresh) return the original order rather than
    // create another. Bounded so it can't be used to write junk into the row.
    const idemKey =
      typeof idempotencyKey === 'string' &&
      idempotencyKey.length >= 8 &&
      idempotencyKey.length <= 100
        ? idempotencyKey
        : null

    // Fast path: the retry usually arrives after the first request finished,
    // so this returns without touching stock or coupons. It is NOT the
    // safety net — two simultaneous requests both reach here and both find
    // nothing. The unique indexes (006 for accounts, 011 for guests) decide.
    //
    // Read with the service role: a guest has no session, and since 010 even a
    // signed-in customer's own order is only readable through their RLS select
    // policy — which a guest hasn't got. Scoped explicitly below instead.
    const admin = createAdminClient()

    if (idemKey) {
      const lookup = admin.from('orders').select('*').eq('idempotency_key', idemKey)
      // Scope to the caller: their account, or (for a guest) the unclaimed
      // orders, where 011's partial unique index makes the key itself unique.
      const { data: existing } = user
        ? await lookup.eq('user_id', user.id).maybeSingle()
        : await lookup.is('user_id', null).maybeSingle()

      if (existing) {
        return NextResponse.json({
          data: existing,
          duplicate: true,
          message: 'Order already created',
        })
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items in order' }, { status: 400 })
    }
    if (items.length > 100) {
      return NextResponse.json({ error: 'Too many items' }, { status: 400 })
    }

    // Validate shipping info
    const required = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state']
    if (!shippingInfo || required.some((f) => !shippingInfo[f] || typeof shippingInfo[f] !== 'string')) {
      return NextResponse.json({ error: 'Missing required shipping information' }, { status: 400 })
    }

    // A guest's email is the only thing tying them to this order — it's how the
    // receipt reaches them and how the order is claimed if they later register
    // (011). A typo here is unrecoverable for them, so reject the obvious ones.
    if (!user && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shippingInfo.email.trim())) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    // Validate item shape: only id + quantity are accepted from the client.
    // Quantities may be fractional (kg items) — piece items are re-checked
    // for whole numbers after the DB lookup below.
    const requested = []
    for (const item of items) {
      const quantity = Number(item.quantity)
      if (!item.id || !Number.isFinite(quantity) || quantity <= 0 || quantity > 999) {
        return NextResponse.json({ error: 'Invalid item in cart' }, { status: 400 })
      }
      requested.push({ id: item.id, quantity: Math.round(quantity * 1000) / 1000 })
    }

    // Fetch authoritative prices + stock + VAT rules from the database
    const ids = requested.map((i) => i.id)
    const { data: dbItems, error: itemsError } = await supabase
      .from('items')
      .select('id, name, price, stock, unit_type, vat_enabled, vat_rate, vat_inclusive')
      .in('id', ids)

    if (itemsError) {
      console.error('Items lookup error:', itemsError)
      return NextResponse.json({ error: 'Could not verify items' }, { status: 500 })
    }

    const byId = new Map((dbItems || []).map((i) => [i.id, i]))
    const orderItems = []
    for (const { id, quantity } of requested) {
      const dbItem = byId.get(id)
      if (!dbItem) {
        return NextResponse.json({ error: 'One or more items no longer exist' }, { status: 400 })
      }
      // Piece items must be whole numbers; kg items may be fractional
      if (dbItem.unit_type !== 'kg' && !Number.isInteger(quantity)) {
        return NextResponse.json(
          { error: `"${dbItem.name}" is sold per piece — quantity must be a whole number` },
          { status: 400 }
        )
      }
      if (dbItem.stock !== null && Number(dbItem.stock) < quantity) {
        return NextResponse.json(
          { error: `Not enough stock for "${dbItem.name}" (only ${dbItem.stock}${dbItem.unit_type === 'kg' ? ' kg' : ''} left)` },
          { status: 409 }
        )
      }
      orderItems.push({
        id: dbItem.id,
        name: dbItem.name,
        price: dbItem.price, // authoritative DB price (per piece or per kg)
        quantity,
        unit_type: dbItem.unit_type,
        vat_enabled: dbItem.vat_enabled,
        vat_rate: dbItem.vat_rate,
        vat_inclusive: dbItem.vat_inclusive,
      })
    }

    // Coupon: re-validated here from the database. The browser only ever
    // sends a code string — the discount amount is computed server-side, so a
    // tampered request can't invent a discount.
    let appliedCoupon = null
    let discount = 0

    if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
      // Items, not a subtotal (020): a scoped coupon ("10% off feed") needs the
      // lines to know which part of the order it applies to, and the function
      // re-prices them from the catalogue rather than trusting our arithmetic.
      //
      // p_user null for guests: validate_coupon() then skips the per-customer
      // limit (a guest has no identity to count against) while still enforcing
      // expiry, min spend, scope and global max_uses.
      const { data: couponData, error: couponError } = await supabase.rpc('validate_coupon', {
        p_code: couponCode.trim(),
        p_user: user?.id ?? null,
        p_items: orderItems.map((i) => ({ id: i.id, quantity: i.quantity })),
      })

      if (couponError) {
        console.error('validate_coupon error:', couponError)
        return NextResponse.json({ error: 'Could not apply that code' }, { status: 500 })
      }

      const result = Array.isArray(couponData) ? couponData[0] : couponData
      if (!result?.valid) {
        // Fail loudly: the customer expects the discount they saw in the cart.
        return NextResponse.json(
          { error: result?.reason || "That discount code isn't valid." },
          { status: 400 }
        )
      }

      appliedCoupon = result.code
      discount = Number(result.discount) || 0
    }

    // Authoritative totals (NGN). The shipping fee is resolved server-side from
    // the DESTINATION STATE (014) — never from the browser, which would let a
    // customer quote themselves Lagos rates for a delivery to Sokoto.
    const pricingConfig = await resolveShipping(shippingInfo.state)
    const totals = calcTotals(orderItems, { discount, ...pricingConfig })

    const shippingAddress = `${shippingInfo.firstName} ${shippingInfo.lastName}
${shippingInfo.address}${shippingInfo.address2 ? '\n' + shippingInfo.address2 : ''}
${shippingInfo.city}, ${shippingInfo.state}${shippingInfo.zip ? ' ' + shippingInfo.zip : ''}
${shippingInfo.country || 'NG'}
Email: ${shippingInfo.email}
Phone: ${shippingInfo.phone}`

    // A signed-in customer is identified by their session; a guest by the email
    // they typed. Note the account's email wins over anything in the body — a
    // signed-in customer can send an order to someone else's address, but the
    // order still belongs to, and is contactable at, their own account.
    const contactEmail = user?.email || shippingInfo.email

    const orderData = {
      user_id: user?.id ?? null,
      email: contactEmail,
      // The guest's only way back to this order (011). Signed-in customers
      // reach theirs through their account, so they get no token to leak.
      guest_token: user ? null : crypto.randomUUID(),
      currency: 'NGN',
      subtotal: totals.subtotal,
      shipping_fee: totals.shipping,
      tax_amount: totals.tax,
      discount_amount: totals.discount,
      coupon_code: appliedCoupon, // redeemed by mark_order_paid() once paid
      total_amount: totals.total,
      status: 'pending', // pending, paid, delivered, canceled
      shipping_address: shippingAddress,
      order_items: orderItems,
      notes: typeof orderNotes === 'string' ? orderNotes.slice(0, 2000) : null,
      idempotency_key: idemKey,
    }

    // Inserted with the service role, not the caller's session: migration 010
    // removed the client's insert policy on orders. That policy only checked
    // `auth.uid() = user_id`, which let a customer POST their own order with
    // total_amount = 1 and pay ₦1 for anything. "Orders are server-authored" is
    // a computation ("the total must match the catalogue"), not a row predicate,
    // so RLS cannot express it — this route is the only thing that prices an
    // order, and 010's trigger re-checks the arithmetic regardless.
    //
    // Everything the dropped policy guaranteed is still enforced above:
    // user_id comes from the verified session, never the request body.
    const { data: order, error } = await admin
      .from('orders')
      .insert([orderData])
      .select()
      .single()

    if (error) {
      // 23505 = unique_violation on the idempotency index (006 for accounts,
      // 011 for guests): a simultaneous request won the race and already
      // created this exact order. That is a success, not a failure — return the
      // winner's row so the shopper carries on to payment instead of seeing an
      // error for an order that exists.
      if (error.code === '23505' && idemKey) {
        const q = admin.from('orders').select('*').eq('idempotency_key', idemKey)
        const { data: winner } = user
          ? await q.eq('user_id', user.id).maybeSingle()
          : await q.is('user_id', null).maybeSingle()

        if (winner) {
          return NextResponse.json({
            data: winner,
            duplicate: true,
            message: 'Order already created',
          })
        }
      }

      console.error('Create order error:', error)
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    return NextResponse.json({
      data: order,
      totals,
      message: 'Order created successfully',
    })
  } catch (error) {
    console.error('Create order API error:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
