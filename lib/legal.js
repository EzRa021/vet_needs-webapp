// Business facts used by /privacy and /terms.
//
// ⚠️ THE BRACKETED VALUES ARE PLACEHOLDERS. They are facts about the business
// that only the owner knows — they were deliberately NOT guessed, because a
// policy that states the wrong registered entity or the wrong refund window is
// worse than one that visibly isn't finished yet.
//
// Fill these in, then have both pages reviewed by someone qualified in Nigerian
// consumer/data-protection law before launch. They are written to be accurate
// about what the software actually does; they are not legal advice.
export const LEGAL = {
  // Trading name (safe — it's the brand used throughout the app).
  brand: 'VetNeeds',

  // The entity a customer would actually be contracting with.
  legalName: '[Registered business name]',
  rcNumber: '[RC number]',
  address: '[Registered business address]',

  // Keep in step with the footer + the support_email store setting.
  supportEmail: 'support@vetneeds.ng',
  supportPhone: '+234 800 000 0000',

  // WhatsApp click-to-chat. International format, DIGITS ONLY — wa.me rejects
  // '+', spaces and dashes, and fails silently by opening a broken chat rather
  // than erroring. Nigeria = 234, then the number without its leading 0:
  //   0801 234 5678  →  2348012345678
  //
  // Empty until you set it, and the button doesn't render while it is — a dead
  // "Chat with us" is worse than no button. Deliberately NOT a bracketed
  // placeholder like the fields above: a placeholder containing digits sails
  // straight through whatsappLink()'s check and ships a link to a number that
  // isn't yours. (It did, in review.)
  whatsapp: '',

  // Consumer-facing commitments. Guessing these would create promises the shop
  // has not agreed to and may not be able to keep.
  returnWindowDays: '[X]',
  deliveryEstimate: '[X–Y working days]',

  // Bump when the text changes materially — it is what tells a returning
  // customer the terms they agreed to have moved.
  lastUpdated: '17 July 2026',
}

// A wa.me link, or null while the number is still a placeholder.
//
// Returns null rather than a broken link on purpose: a "Chat with us on
// WhatsApp" button that opens an empty chat with nobody is worse than no
// button, and placeholders are exactly the thing that ships by accident.
export function whatsappLink(message) {
  const raw = String(LEGAL.whatsapp || '')

  // Belt and braces: if someone re-adds a bracketed placeholder, refuse it
  // regardless of how many digits it happens to contain. Stripping non-digits
  // from "[2348012345678]" yields a perfectly valid-looking 13-digit number.
  if (/[[\]<>]/.test(raw)) return null

  const digits = raw.replace(/\D/g, '')
  // A real international number is 10–15 digits.
  if (digits.length < 10 || digits.length > 15) return null
  return message
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${digits}`
}
