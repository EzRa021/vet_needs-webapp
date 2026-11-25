import { createAdminClient } from '@/lib/supabase/admin'

// Rebuilds the best-sellers summary (015) so the home page's Top selling and
// Best sellers reflect real sales.
//
// 015 left the refresh to "a schedule", and nothing ever ran one: the summary
// stayed empty however many orders were paid. It's now rebuilt right after the
// events that change it — a payment confirmed, a refund settled, an order
// cancelled — each AFTER that event is saved (never inside the payment's own
// transaction), so a slow or failed rebuild can't touch the order.
//
// Never throws: a stale list is fine; a failed payment confirmation is not.
export async function refreshBestSellers() {
  try {
    const { error } = await createAdminClient().rpc('refresh_best_sellers')
    if (error) console.error('Best sellers refresh failed:', error.message)
  } catch (e) {
    console.error('Best sellers refresh failed:', e.message)
  }
}
