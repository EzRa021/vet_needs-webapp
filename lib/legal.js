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
  brand: 'PetDo',

  // The entity a customer would actually be contracting with.
  legalName: '[Registered business name]',
  rcNumber: '[RC number]',
  address: '[Registered business address]',

  // Keep in step with the footer + the support_email store setting.
  supportEmail: 'support@petdo.ng',
  supportPhone: '+234 800 000 0000',

  // Consumer-facing commitments. Guessing these would create promises the shop
  // has not agreed to and may not be able to keep.
  returnWindowDays: '[X]',
  deliveryEstimate: '[X–Y working days]',

  // Bump when the text changes materially — it is what tells a returning
  // customer the terms they agreed to have moved.
  lastUpdated: '17 July 2026',
}
