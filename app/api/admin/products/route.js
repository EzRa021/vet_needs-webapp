import { NextResponse } from 'next/server'
import { getStaffUser } from '@/lib/auth/admin'
import { parseAdminBody, ProductCreateSchema } from '@/lib/validation/admin'
import { createAdminClient } from '@/lib/supabase/admin'

const SORTABLE = new Set(['name', 'price', 'stock', 'created_at', 'updated_at'])

// Whitelist of columns staff may write. Anything else in the body is ignored —
// generated/derived columns (is_available, rating_*, path) are never accepted.
function buildPayload(body) {
  const out = {}
  const str = (k, max = 500) => {
    if (typeof body[k] === 'string') out[k] = body[k].trim().slice(0, max) || null
  }
  // An absent key means "leave this column alone"; only an explicitly empty
  // value ('' or null) clears it.
  //
  // This used to write null for absent keys, which made PATCH destructive: a
  // body of { price } also nulled vat_rate, stock, low_stock_threshold,
  // compare_at_price and cost_price. The NOT NULL columns turned that into a
  // 500-shaped DB error; the nullable ones silently wiped data. It only stayed
  // hidden because product-form.jsx always submits the whole product.
  //
  // On create the same change is an improvement: an omitted vat_rate now takes
  // the column default (7.5) instead of failing its NOT NULL constraint.
  const num = (k, { min = 0, max = 1e12 } = {}) => {
    if (!(k in body)) return
    const raw = body[k]
    if (raw === '' || raw === null || raw === undefined) {
      out[k] = null
      return
    }
    const n = Number(raw)
    if (Number.isFinite(n)) out[k] = Math.min(Math.max(n, min), max)
  }
  const bool = (k) => {
    if (typeof body[k] === 'boolean') out[k] = body[k]
  }

  str('name', 200)
  str('sku', 64)
  str('brand', 120)
  str('description', 500)
  str('long_description', 5000)
  str('image_url', 1000)

  num('price')
  num('compare_at_price')
  num('cost_price')
  num('vat_rate', { max: 100 })
  num('stock')
  num('low_stock_threshold')

  bool('vat_enabled')
  bool('vat_inclusive')
  bool('allow_backorder')
  bool('is_active')
  bool('is_featured')

  if ('unit_type' in body) {
    out.unit_type = body.unit_type === 'kg' ? 'kg' : 'piece'
  }
  if ('category_id' in body) {
    out.category_id = body.category_id || null
  }

  // attributes: a free-form key/value bag that drives the product page's spec
  // table AND the shop's facets (013). It wasn't in this whitelist, so only the
  // seed data ever had any — a product created through the admin could never be
  // filtered by bag size or life stage.
  //
  // Keys are constrained to \w because they become jsonb paths in the facet
  // filter (`attributes->>bag_size`) and are rendered as labels. Values are
  // stringified: a facet compares text, and "10" vs 10 would be two facets.
  if ('attributes' in body) {
    const raw = body.attributes && typeof body.attributes === 'object' ? body.attributes : {}
    const cleaned = {}
    for (const [k, v] of Object.entries(raw).slice(0, 30)) {
      const key = String(k).trim()
      if (!/^\w{1,40}$/.test(key)) continue
      const value = String(v ?? '').trim().slice(0, 200)
      if (!value) continue // an empty attribute is noise on the page and a dead facet
      cleaned[key] = value
    }
    out.attributes = cleaned
  }

  // tags: weighted into the search vector (012, weight C) and shown on the
  // product page. Same story — no form ever set them.
  if ('tags' in body) {
    const arr = Array.isArray(body.tags) ? body.tags : []
    out.tags = [
      ...new Set(
        arr
          .map((t) => String(t).trim().toLowerCase().slice(0, 40))
          .filter(Boolean)
      ),
    ].slice(0, 30)
  }

  return out
}

// GET /api/admin/products?search=&category=&status=&page=&limit=&sortBy=&sortOrder=
export async function GET(request) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { supabase } = auth

  try {
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').slice(0, 100)
    const category = searchParams.get('category') || 'all'
    const status = searchParams.get('status') || 'all'
    const sortBy = SORTABLE.has(searchParams.get('sortBy')) ? searchParams.get('sortBy') : 'created_at'
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc'
    const page = Math.max(parseInt(searchParams.get('page')) || 1, 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit')) || 20, 1), 100)
    const offset = (page - 1) * limit

    // Service role for the read: 023 revoked cost_price from authenticated, so
    // the staff session can no longer `select('*')` it — but staff legitimately
    // need it to edit. getStaffUser() above is the gate; the admin client does
    // the read. Same pattern as orders (010).
    const admin = createAdminClient()

    // Admin sees inactive products too — no is_active filter by default.
    // NOTE: the FK must be named explicitly. item_categories (the optional
    // multi-placement junction) creates a SECOND items↔categories path, so a
    // bare `categories(...)` embed is ambiguous and PostgREST errors (PGRST201).
    let query = admin
      .from('items')
      .select('*, category:categories!items_category_id_fkey(id, name, path)', {
        count: 'exact',
      })

    if (search) {
      const safe = search.replace(/[,()\\%_]/g, ' ').trim()
      if (safe) query = query.or(`name.ilike.*${safe}*,sku.ilike.*${safe}*,brand.ilike.*${safe}*`)
    }

    if (category !== 'all') {
      const { data: ids, error: idsError } = await supabase.rpc('category_descendant_ids', {
        p_root: category,
      })
      if (idsError) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      }
      query = query.in('category_id', ids?.length ? ids : [category])
    }

    if (status === 'active') query = query.eq('is_active', true)
    else if (status === 'inactive') query = query.eq('is_active', false)
    else if (status === 'featured') query = query.eq('is_featured', true)
    else if (status === 'out_of_stock') query = query.eq('stock', 0)

    const { data, error, count } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      data: data || [],
      pagination: {
        total: count || 0,
        page,
        pages: Math.ceil((count || 0) / limit),
        limit,
      },
    })
  } catch (error) {
    console.error('Admin products error:', error)
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 })
  }
}

// POST /api/admin/products
export async function POST(request) {
  const auth = await getStaffUser()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  // Service role: the insert writes cost_price, and the trailing `.select()`
  // reads it back — both blocked for the staff session after 023. Staff-gated
  // above; write below.
  const admin = createAdminClient()

  try {
    const { data: body, response } = await parseAdminBody(
      request,
      ProductCreateSchema
    )
    if (response) return response
    const payload = buildPayload(body)

    const { data, error } = await admin.from('items').insert([payload]).select().single()
    if (error) {
      return NextResponse.json({ error: friendlyItemError(error) }, { status: 400 })
    }
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Create product error:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}

export { buildPayload }

export function friendlyItemError(error) {
  const msg = error?.message || ''
  if (msg.includes('items_sku_key') || (msg.includes('duplicate') && msg.includes('sku'))) {
    return 'That SKU is already used by another product.'
  }
  if (msg.includes('items_slug_key') || (msg.includes('duplicate') && msg.includes('slug'))) {
    return 'A product with a very similar name already exists. Try a more specific name.'
  }
  if (msg.includes('items_stock_non_negative')) {
    return 'Stock cannot be negative.'
  }
  if (msg.includes('duplicate key')) {
    return 'A product with those details already exists.'
  }
  return msg || 'Database rejected the change.'
}
