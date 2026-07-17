// Maps an email address to its webmail inbox, so "Check your email" can be a
// real one-click action instead of an instruction.

const PROVIDERS = {
  'gmail.com': { name: 'Gmail', url: 'https://mail.google.com/mail/u/0/#search/from%3A(supabase+OR+petdo)' },
  'googlemail.com': { name: 'Gmail', url: 'https://mail.google.com/mail/u/0/' },
  'yahoo.com': { name: 'Yahoo Mail', url: 'https://mail.yahoo.com' },
  'outlook.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/0/' },
  'hotmail.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/0/' },
  'live.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/0/' },
  'icloud.com': { name: 'iCloud Mail', url: 'https://www.icloud.com/mail' },
  'proton.me': { name: 'Proton Mail', url: 'https://mail.proton.me' },
  'protonmail.com': { name: 'Proton Mail', url: 'https://mail.proton.me' },
  'yandex.com': { name: 'Yandex Mail', url: 'https://mail.yandex.com' },
  'zoho.com': { name: 'Zoho Mail', url: 'https://mail.zoho.com' },
}

export function getWebmail(email) {
  const domain = String(email || '').split('@')[1]?.toLowerCase()
  if (!domain) return null
  return PROVIDERS[domain] || null
}
