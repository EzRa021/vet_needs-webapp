// Single source of truth for how roles look and read across the admin.
export const ROLE_META = {
  admin: { label: 'Admin', variant: 'default' },
  staff: { label: 'Staff', variant: 'secondary' },
  customer: { label: 'Customer', variant: 'outline' },
}

export const ROLE_HELP = {
  customer: 'Can shop and see their own orders. No admin access.',
  staff:
    'Can manage products, categories and orders. Cannot see customers, coupons or settings.',
  admin: 'Full access, including customer data, roles and settings.',
}

export const roleMeta = (role) => ROLE_META[role] || ROLE_META.customer

export function initialsFor(name, email) {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }
  return email?.[0]?.toUpperCase() || '?'
}
