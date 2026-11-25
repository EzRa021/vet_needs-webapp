import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const SORTABLE_COLUMNS = new Set(['name', 'price', 'created_at', 'stock'])

// Everything a product card or page needs. Explicit columns, NOT '*': after
// 023 a `select('*')` as anon fails on the revoked cost_price, and listing
// columns means cost_price / pos_* can never be re-leaked by a future column.
// The FK is named explicitly: item_categories (multi-placement junction)
// creates a second items↔categories path, making a bare embed ambiguous.
const COLUMNS = `id, name, slug, sku, brand, description, long_description, price,
  compare_at_price, unit_type, stock, low_stock_threshold, allow_backorder,
  is_active, is_available, is_featured, image_url, rating_avg, rating_count,
  weight_grams, attributes, tags, meta_title, meta_description, category_id,
  created_at, updated_at, vat_enabled, vat_rate, vat_inclusive,
  category:categories!items_category_id_fkey(id, name, path)`

// GET /api/shop/items - Get all items with filters
export async function GET(request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const search = (searchParams.get('search') || '').slice(0, 100)
    const department = searchParams.get('department') || 'all'
    const category = searchParams.get('category') || 'all'
    const minPrice = parseFloat(searchParams.get('minPrice'))
    const maxPrice = parseFloat(searchParams.get('maxPrice'))
    // 'relevance' (Best match) is the matcher's own order, so it only means
    // something while searching; otherwise it falls back to A–Z.
    const relevance = Boolean(search.trim()) && searchParams.get('sortBy') === 'relevance'
    const sortBy = SORTABLE_COLUMNS.has(searchParams.get('sortBy'))
      ? searchParams.get('sortBy')
      : 'name'
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'
    const page = Math.max(parseInt(searchParams.get('page')) || 1, 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit')) || 12, 1), 48)
    const offset = (page - 1) * limit

    // Category / department filter → the node AND everything nested under it.
    // (department is just a root category, so both resolve the same way.)
    const nodeId =
      category && category !== 'all'
        ? category
        : department && department !== 'all'
          ? department
          : null

    let categoryIds = null
    if (nodeId) {
      const { data: ids, error: idsError } = await supabase.rpc(
        'category_descendant_ids',
        { p_root: nodeId }
      )
      if (idsError) {
        console.error('Subtree resolve error:', idsError)
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      }
      categoryIds = ids && ids.length ? ids : [nodeId]
    }

    // Searching goes through search_products (032): word-prefix, substring
    // and near-spelling matches, best first, as storefront_items rows — so the
    // same filters, sorting, paging and category embed below apply to it
    // exactly as to the items table, and it can't expose cost_price.
    //
    // If 032 hasn't been run yet the function doesn't exist; the search then
    // falls back to 012's whole-word full-text match rather than failing.
    const build = (mode) => {
      let query =
        mode === 'rpc'
          ? supabase.rpc('search_products', { p_query: search }, { count: 'exact' }).select(COLUMNS)
          : supabase.from('items').select(COLUMNS, { count: 'exact' })

      if (mode === 'fts') {
        query = query.textSearch('fts', search, { type: 'websearch', config: 'english' })
      }

      query = query
        .eq('is_active', true) // hide products the admin has switched off

      if (searchParams.get('featured') === 'true') {
        query = query.eq('is_featured', true)
      }

      // ?ids=a,b,c — hydrate a client-held list of ids (recently viewed lives in
      // localStorage, so the browser knows the ids but nothing else). Capped and
      // uuid-checked: this is a public endpoint taking a list.
      const idsParam = searchParams.get('ids')
      if (idsParam) {
        const ids = idsParam
          .split(',')
          .map((s) => s.trim())
          .filter((s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))
          .slice(0, 24)
        // An ids param that survives validation as empty must return nothing, not
        // everything — silently dropping the filter would dump the catalogue.
        query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
      }

      if (Number.isFinite(minPrice)) query = query.gte('price', minPrice)
      if (Number.isFinite(maxPrice)) query = query.lte('price', maxPrice)

      // Brand facet — may be repeated (?brand=TopFeeds&brand=Coppens), which reads
      // as OR within the facet, the standard behaviour: ticking two brands widens.
      const brands = searchParams.getAll('brand').filter(Boolean).slice(0, 20)
      if (brands.length) query = query.in('brand', brands)

      // In-stock: "buyable now", which includes untracked stock and backorders —
      // not merely stock > 0, or backorder products would be hidden from the one
      // filter that claims to show what you can buy.
      if (searchParams.get('inStock') === 'true') {
        query = query.or('allow_backorder.eq.true,stock.is.null,stock.gt.0')
      }

      // Attribute facets arrive as attr.<key>=<value> (e.g. attr.bag_size=25kg).
      // Keys are whitelisted against \w to keep arbitrary text out of the jsonb
      // path, and capped so a hand-built URL can't stack 50 filters.
      let attrCount = 0
      for (const [rawKey, value] of searchParams.entries()) {
        if (!rawKey.startsWith('attr.') || !value) continue
        if (attrCount >= 6) break
        const key = rawKey.slice(5)
        if (!/^\w{1,40}$/.test(key)) continue
        query = query.eq(`attributes->>${key}`, value)
        attrCount++
      }

      // Best match keeps search_products' order; any other sort re-orders the
      // same matches. `id` breaks ties so paging never repeats or skips a row.
      if (!(relevance && mode === 'rpc')) {
        query = query.order(sortBy, { ascending: sortOrder === 'asc' }).order('id', { ascending: true })
      }
      if (categoryIds) query = query.in('category_id', categoryIds)
      return query.range(offset, offset + limit - 1)
    }

    const searching = Boolean(search.trim())
    let { data, error, count } = await build(searching ? 'rpc' : 'plain')
    // PGRST202: PostgREST has no such function (032 not run yet).
    if (error && searching && (error.code === 'PGRST202' || error.code === '42883')) {
      console.warn('search_products missing — run migration 032. Falling back to whole-word search.')
      ;({ data, error, count } = await build('fts'))
    }

    if (error) {
      console.error('Items fetch error:', error)
      return NextResponse.json({ error: 'Failed to load products' }, { status: 500 })
    }

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
    console.error('Items API error:', error)
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 })
  }
}
