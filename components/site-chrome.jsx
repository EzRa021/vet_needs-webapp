"use client"

import { usePathname } from "next/navigation"
import Header from "@/components/header"
import Footer from "@/components/footer"

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

export function SiteHeader() {
  const pathname = usePathname()
  if (isBare(pathname)) return null
  return <Header />
}

export function SiteFooter() {
  const pathname = usePathname()
  if (isBare(pathname)) return null
  return <Footer />
}

// Bare routes manage their own height; the storefront gets the flex-1 main.
export function SiteMain({ children }) {
  const pathname = usePathname()
  if (isBare(pathname)) return <>{children}</>
  return <main className="flex-1">{children}</main>
}
