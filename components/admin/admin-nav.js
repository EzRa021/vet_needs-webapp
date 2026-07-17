import {
  AtSign,
  BellRing,
  Boxes,
  ChartLine,
  LayoutDashboard,
  Mail,
  FolderTree,
  Package,
  ShoppingBag,
  Users,
  Ticket,
  Megaphone,
  Settings,
  Star,
  Truck,
  Undo2,
} from "lucide-react"

// Single source of truth for admin navigation.
// Adding a module = add one entry here + the page. Nothing else to wire.
//   role: minimum role required ('staff' | 'admin')
//   ready: false renders the item disabled with a "Soon" badge
export const ADMIN_NAV = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/admin", icon: LayoutDashboard, role: "staff", ready: true, exact: true },
      { title: "Reports", href: "/admin/reports", icon: ChartLine, role: "admin", ready: true },
    ],
  },
  {
    label: "Catalog",
    items: [
      { title: "Categories", href: "/admin/categories", icon: FolderTree, role: "staff", ready: true },
      { title: "Products", href: "/admin/products", icon: Package, role: "staff", ready: true },
      { title: "Inventory", href: "/admin/inventory", icon: Boxes, role: "admin", ready: true },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "Orders", href: "/admin/orders", icon: ShoppingBag, role: "staff", ready: true },
      { title: "Refunds", href: "/admin/refunds", icon: Undo2, role: "admin", ready: true },
      { title: "Customers", href: "/admin/customers", icon: Users, role: "admin", ready: true },
      { title: "Coupons", href: "/admin/coupons", icon: Ticket, role: "admin", ready: true },
    ],
  },
  {
    label: "Store",
    items: [
      { title: "Reviews", href: "/admin/reviews", icon: Star, role: "staff", ready: true },
      // `badge: "messages"` asks the sidebar to show the unread count. Messages
      // sat unread in the database for as long as this entry didn't exist.
      { title: "Messages", href: "/admin/messages", icon: Mail, role: "staff", ready: true, badge: "messages" },
      { title: "Subscribers", href: "/admin/subscribers", icon: AtSign, role: "admin", ready: true },
      { title: "Waitlist", href: "/admin/waitlist", icon: BellRing, role: "staff", ready: true },
      { title: "Delivery", href: "/admin/shipping", icon: Truck, role: "admin", ready: true },
      { title: "Promotions", href: "/admin/promotions", icon: Megaphone, role: "staff", ready: true },
      { title: "Settings", href: "/admin/settings", icon: Settings, role: "admin", ready: true },
    ],
  },
]

export function canSee(item, role) {
  if (role === "admin") return true
  if (role === "staff") return item.role === "staff"
  return false
}

// Human label for the current route (used by the topbar breadcrumb)
export function findNavTitle(pathname) {
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (item.exact ? pathname === item.href : pathname.startsWith(item.href)) {
        return item.title
      }
    }
  }
  return "Admin"
}

// Breadcrumb trail for nested routes, e.g.
//   /admin/products/123/edit → [Products → /admin/products, Edit]
// Returns [] on a top-level module page (the title alone is enough).
export function findNavTrail(pathname) {
  const section = ADMIN_NAV.flatMap((g) => g.items).find(
    (item) => !item.exact && pathname.startsWith(item.href)
  )
  if (!section) return []

  const rest = pathname.slice(section.href.length).split("/").filter(Boolean)
  if (rest.length === 0) return []

  const trail = [{ title: section.title, href: section.href }]
  const last = rest[rest.length - 1]

  if (rest[0] === "new") {
    trail.push({ title: "New" })
  } else if (last === "edit") {
    trail.push({ title: "Edit" })
  } else {
    // A record id — the page renders the real name in its own header.
    trail.push({ title: "Details" })
  }
  return trail
}
