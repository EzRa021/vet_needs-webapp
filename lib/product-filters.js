// Shared by /api/admin/products (the table) and /api/admin/products/summary
// (the catalogue health counts), so a count always matches the rows you get
// by clicking it.

export const PRODUCT_SORTS = {
  newest: { column: 'created_at', ascending: false },
  updated: { column: 'updated_at', ascending: false },
  name_asc: { column: 'name', ascending: true },
  name_desc: { column: 'name', ascending: false },
  price_desc: { column: 'price', ascending: false },
  price_asc: { column: 'price', ascending: true },
  stock_asc: { column: 'stock', ascending: true },
  stock_desc: { column: 'stock', ascending: false },
}

export const PRODUCT_STATUSES = ['all', 'active', 'inactive', 'featured', 'low_stock', 'out_of_stock']

export function readProductFilters(searchParams) {
  const sort = searchParams.get('sort')
  const status = searchParams.get('status')
  return {
    search: (searchParams.get('search') || '').trim().slice(0, 100),
    category: searchParams.get('category') || 'all',
    status: PRODUCT_STATUSES.includes(status) ? status : 'all',
    sort: PRODUCT_SORTS[sort] ? sort : 'newest',
  }
}

// Low stock compares two columns (stock vs that product's own reorder
// point), which PostgREST filters can't express. Callers fetch the candidates
// and apply this in JS — fine at catalogue sizes, and it keeps the rule in
// one place.
export const isLowStock = (item) =>
  Number(item.stock) > 0 && Number(item.stock) <= Number(item.low_stock_threshold ?? 10)

// Search + category. `rpcClient` resolves a category to itself plus every
// sub-category (002), so "Poultry" includes "Poultry › Layers".
// Returns { query } or { error } for an unknown category.
export async function applyProductFilters(query, { search, category }, rpcClient) {
  if (search) {
    const safe = search.replace(/[,()\\%_*]/g, ' ').trim()
    if (safe) query = query.or(`name.ilike.*${safe}*,sku.ilike.*${safe}*,brand.ilike.*${safe}*`)
  }

  if (category && category !== 'all') {
    if (category === 'none') {
      query = query.is('category_id', null)
    } else {
      const { data: ids, error } = await rpcClient.rpc('category_descendant_ids', { p_root: category })
      if (error) return { error: 'Invalid category' }
      query = query.in('category_id', ids?.length ? ids : [category])
    }
  }
  return { query }
}

// Status filters that a PostgREST query CAN express. 'low_stock' is applied
// by the caller with isLowStock().
export function applyProductStatus(query, status) {
  if (status === 'active') return query.eq('is_active', true)
  if (status === 'inactive') return query.eq('is_active', false)
  if (status === 'featured') return query.eq('is_featured', true)
  if (status === 'out_of_stock') return query.lte('stock', 0)
  if (status === 'low_stock') return query.gt('stock', 0)
  return query
}
