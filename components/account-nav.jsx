"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Package, User, Heart, MapPin } from "lucide-react"

import { cn } from "@/lib/utils"

// Single source of truth for the customer account area.
// `ready: false` items render disabled with a "Soon" chip, so the shape of the
// account area is honest about what exists rather than linking to 404s.
export const ACCOUNT_NAV = [
  { title: "Orders", href: "/account/orders", icon: Package, ready: true },
  { title: "Profile", href: "/account/profile", icon: User, ready: true },
  { title: "Addresses", href: "/account/addresses", icon: MapPin, ready: true },
  { title: "Wishlist", href: "/account/wishlist", icon: Heart, ready: true },
]

export function findAccountTitle(pathname) {
  return ACCOUNT_NAV.find((i) => pathname.startsWith(i.href))?.title || "My account"
}

export default function AccountNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Account" className="border-b">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {ACCOUNT_NAV.map((item) => {
          const active = pathname.startsWith(item.href)

          if (!item.ready) {
            return (
              <li key={item.href}>
                <span
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground/50"
                >
                  <item.icon className="size-4" />
                  {item.title}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    Soon
                  </span>
                </span>
              </li>
            )
          }

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                <item.icon className="size-4" />
                {item.title}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
