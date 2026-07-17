import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const SORTABLE_COLUMNS = new Set(['name', 'price', 'created_at', 'stock'])

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
    const sortBy = SORTABLE_COLUMNS.has(searchParams.get('sortBy'))
      ? searchParams.get('sortBy')
      : 'name'
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'
    const page = Math.max(parseInt(searchParams.get('page')) || 1, 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit')) || 12, 1), 48)
    const offset = (page - 1) * limit

    // The FK is named explicitly: item_categories (multi-placement junction)
    // creates a second items↔categories path, making a bare embed ambiguous.
    let query = supabase
      .from('items')
      .select('*, category:categories!items_category_id_fkey(id, name, path)', {
        count: 'exact',
      })
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

    // Search — full-text against the generated `fts` column (012), GIN-indexed.
    //
    // Replaces `name.ilike.*term*,description.ilike.*term*`, which could not use
    // an index (leading wildcard), could not rank, and could not match across
    // fields — "bovans layer" found nothing when the brand and name live in
    // separate columns. `websearch` is the right dialect for a search box: it
    // understands quoted phrases and OR, and it never throws on odd input, so a
    // stray quote can't 500 the shop.
    if (search) {
      query = query.textSearch('fts', search, {
        type: 'websearch',
        config: 'english',
      })
    }

    // Category / department filter → the node AND everything nested under it.
    // (department is just a root category, so both resolve the same way.)
    const nodeId =
      category && category !== 'all'
        ? category
        : department && department !== 'all'
          ? department
          : null

    if (nodeId) {
      const { data: ids, error: idsError } = await supabase.rpc(
        'category_descendant_ids',
        { p_root: nodeId }
      )
      if (idsError) {
        console.error('Subtree resolve error:', idsError)
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
      }
      query = query.in('category_id', ids && ids.length ? ids : [nodeId])
    }

    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

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
