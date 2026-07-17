import { z } from 'zod'
import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { fail, parseBody } from '@/lib/api'
import { allow, TOO_MANY } from '@/lib/rate-limit'

const CouponSchema = z.object({
  code: z.string().trim().min(1, 'Enter a code.').max(50),
  items: z
    .array(
      z.object({
        id: z.string().uuid('Invalid item in cart'),
        quantity: z.coerce.number().positive('Invalid item in cart').max(999),
      })
    )
    .min(1, 'Your cart is empty.')
    .max(100),
})

// POST /api/checkout/validate-coupon
//
// The client sends only ids + quantities. The subtotal is recomputed from
// database prices, and the discount comes from validate_coupon() — never from
// the browser. This endpoint previews the discount; it does NOT reserve the
// coupon (that happens when payment is confirmed).
export async function POST(request) {
  try {
    const { data: body, response } = await parseBody(request, CouponSchema)
    if (response) return response

    // Coupon codes are guessable by design ("SAVE10", "PETDO20"), which makes
    // this the one endpoint someone would actually brute-force. Rate limited
    // per IP + code so walking the keyspace is slow.
    if (!(await allow(request, 'coupon'))) {
      return fail(TOO_MANY, 429)
    }

    const supabase = await createClient()

    // No auth gate. Guests can check out (011) and create-order happily accepts
    // their coupon with p_user null — so refusing to *preview* it here told
    // guests "Please sign in to use a code" about a code that would have worked
    // at the next step. validate_coupon() skips only the per-customer limit
    // when there's no user; expiry, min spend and global max_uses still apply.
    const { data: { user } } = await supabase.auth.getUser()

    // No subtotal maths here any more (020). validate_coupon() takes the lines
    // and prices them from the catalogue itself — which it has to, because a
    // scoped coupon needs to know WHICH items are in the cart, not just what
    // they add up to. That also deletes the price-lookup this route used to do.
    const { data, error } = await supabase.rpc('validate_coupon', {
      p_code: body.code,
      p_user: user?.id ?? null,
      p_items: body.items.map((i) => ({ id: i.id, quantity: i.quantity })),
    })

    if (error) {
      console.error('validate_coupon error:', error)
      return fail('Could not check that code', 500)
    }

    const result = Array.isArray(data) ? data[0] : data

    // 200 with valid:false — an invalid code is an answer, not a failure, and
    // CouponInput reads this shape. Left as-is deliberately: switching it to the
    // { error } envelope would silently turn every "expired code" message into
    // a generic toast.
    if (!result || !result.valid) {
      return NextResponse.json(
        { valid: false, error: result?.reason || "That code isn't valid." },
        { status: 200 }
      )
    }

    return NextResponse.json({
      valid: true,
      code: result.code,
      discount: Number(result.discount),
    })
  } catch (error) {
    console.error('Validate coupon error:', error)
    return fail('Could not check that code', 500)
  }
}
