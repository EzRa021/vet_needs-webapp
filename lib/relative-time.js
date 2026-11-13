// "just now", "4 min ago", "3 h ago", "yesterday", "12 Nov" — short enough for
// a table cell, precise enough to tell a fresh order from a stale one. The
// full timestamp belongs in a title/tooltip next to it (see fullDateTime).

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export function timeAgo(value, now = Date.now()) {
  if (!value) return ''
  const t = new Date(value).getTime()
  const diff = Math.max(0, now - t)
  if (diff < 45 * 1000) return 'just now'
  if (diff < HOUR) return `${Math.round(diff / MIN)} min ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`
  if (diff < 2 * DAY) return 'yesterday'
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} days ago`
  return new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

// "26 h", "3 days" — how long something has been waiting.
export function duration(ms) {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MIN))} min`
  if (ms < 2 * DAY) return `${Math.floor(ms / HOUR)} h`
  return `${Math.floor(ms / DAY)} days`
}

export const fullDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-NG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''
