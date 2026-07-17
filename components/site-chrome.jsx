"use client"

import { usePathname } from "next/navigation"
import Header from "@/components/header"
import Footer from "@/components/footer"
import PromoPopup from "@/components/promo-popup"

// Routes that render their own full-page shell and must NOT get the
// storefront header/footer:
//   /admin/*  → dashboard sidebar shell
//   auth      → AuthShell split-screen layout
const BARE_PREFIXES = [
  "/admin",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth",
]

const isBare = (pathname) =>
  BARE_PREFIXES.some(
    (p) => pathname === p || pathname?.startsWith(`${p}/`)
  )

// Anywhere the customer is mid-purchase. These keep the header/footer, but a
// popup over them is actively harmful.
const isCheckout = (pathname) =>
  pathname === "/cart" || pathname?.startsWith("/checkout")

export function SiteHeader() {
  const pathname = usePathname()
  if (isBare(pathname)) return null
  return <Header />
}

export function SiteFooter() {
  const pathname = usePathname()
  if (isBare(pathname)) return null
  return (
    <>
      <Footer />
      {/* Popup lives with the chrome so it can't appear over the admin or an
          auth screen — and NEVER during checkout: interrupting someone who is
          already buying to advertise at them is how you lose the sale you
          already had. */}
      {!isCheckout(pathname) && <PromoPopup />}
    </>
  )
}

// Bare routes manage their own height; the storefront gets the flex-1 main.
export function SiteMain({ children }) {
  const pathname = usePathname()
  if (isBare(pathname)) return <>{children}</>
  return <main className="flex-1">{children}</main>
}
