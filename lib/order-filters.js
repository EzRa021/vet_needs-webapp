// Shared by /api/admin/orders (the table) and /api/admin/orders/summary (the
// pipeline counts), so a count always describes exactly the rows you'd see
// after clicking it.

export const ORDER_RANGES = ['today', '7d', '30d', 'all']
export const ORDER_SORTS = {
  newest: { column: 'created_at', ascending: false },
  oldest: { column: 'created_at', ascending: true },
  total_desc: { column: 'total_amount', ascending: false },
  total_asc: { column: 'total_amount', ascending: true },
}

// Nigeria is UTC+1 all year (no DST), so "today" for the shop starts at
// 23:00 UTC the previous day. Computed here rather than trusting the server's
// timezone, which on most hosts is UTC.
const LAGOS_OFFSET_MS = 60 * 60 * 1000

export function lagosStartOfToday(now = new Date()) {
  const lagos = new Date(now.getTime() + LAGOS_OFFSET_MS)
  const midnightLagosAsUtc = Date.UTC(
    lagos.getUTCFullYear(),
    lagos.getUTCMonth(),
    lagos.getUTCDate()
  )
  return new Date(midnightLagosAsUtc - LAGOS_OFFSET_MS)
}

export function rangeStart(range, now = new Date()) {
  const today = lagosStartOfToday(now)
  switch (range) {
    case 'today':
      return today
    case '7d':
      return new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)
    default:
      return null
  }
}

// "#1A2B" or "1a2b3c4d" → the uuid range that starts with those hex digits.
// A bare word like "bad" or "cafe" is valid hex, so short prefixes only count
// as an order number when they start with "#"; 8 bare hex digits always do.
function orderIdPrefix(search) {
  const m = search.match(/^#([0-9a-f]{1,8})$/i) || search.match(/^([0-9a-f]{8})$/i)
  if (!m) return null
  const hex = m[1].toLowerCase()
  const toUuid = (h) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
  return {
    from: toUuid(hex.padEnd(32, '0')),
    to: toUuid(hex.padEnd(32, 'f')),
  }
}

export function readOrderFilters(searchParams) {
  const search = (searchParams.get('search') || '').trim().slice(0, 100)
  const range = ORDER_RANGES.includes(searchParams.get('range')) ? searchParams.get('range') : 'all'
  const sort = ORDER_SORTS[searchParams.get('sort')] ? searchParams.get('sort') : 'newest'
  return { search, range, sort }
}

// Applies search + date range. Status is applied by the caller, because the
// summary needs one count per status over the same base.
export function applyOrderFilters(query, { search, range }) {
  const from = rangeStart(range)
  if (from) query = query.gte('created_at', from.toISOString())

  if (search) {
    const idRange = orderIdPrefix(search)
    if (idRange) {
      return query.gte('id', idRange.from).lte('id', idRange.to)
    }
    // Name, phone and city live in the address blob; email has its own column
    // (guests) as well as appearing in the blob.
    const safe = search.replace(/[,()\\%_*#]/g, ' ').trim()
    if (safe) {
      query = query.or(
        [
          `shipping_address.ilike.*${safe}*`,
          `email.ilike.*${safe}*`,
          `tracking_number.ilike.*${safe}*`,
          `payment_reference.ilike.*${safe}*`,
          `coupon_code.ilike.*${safe}*`,
        ].join(',')
      )
    }
  }
  return query
}
