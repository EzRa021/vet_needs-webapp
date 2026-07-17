// The 36 states + FCT. Shared by the checkout form and the account address
// book so the two can never offer different lists.
export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT Abuja', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
  'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

// One-line rendering of a saved address, used by the picker and the cards.
export function formatAddress(a) {
  if (!a) return ''
  return [
    a.address,
    a.address2,
    [a.city, a.state].filter(Boolean).join(', '),
    a.zip,
  ]
    .filter(Boolean)
    .join(' · ')
}
