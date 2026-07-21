import type React from "react"
import { Providers } from './providers'
import type { Metadata } from "next"
import { Inter, Manrope } from "next/font/google"
import "./globals.css"
import { SiteHeader, SiteFooter, SiteMain } from "@/components/site-chrome"

// Manrope headings (modern, professional, friendly) + Inter body (readability)
const body = Inter({ subsets: ["latin"], variable: "--font-sans" })
const display = Manrope({ subsets: ["latin"], variable: "--font-display" })

export const metadata: Metadata = {
  // Without metadataBase, every relative OG/Twitter image resolves against
  // localhost and link previews break in production. Next warns about this at
  // build time and it's easy to ignore until someone shares a product on
  // WhatsApp and gets a blank card.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://vetneeds.ng"),
  title: {
    default: "VetNeeds — Poultry Feed, Pet Food & Farm Supplies in Nigeria",
    template: "%s | VetNeeds",
  },
  description:
    "Quality poultry feed, pet food and farm & pet accessories delivered across Nigeria. Secure Paystack checkout.",
  openGraph: {
    type: "website",
    siteName: "VetNeeds",
    locale: "en_NG",
  },
  // The shop sells feed to farmers as much as food to pet owners — the old
  // description said "dog and cat essentials", which is half the business.
  keywords: [
    "poultry feed Nigeria",
    "layer mash",
    "broiler starter",
    "fish feed",
    "pet food Nigeria",
    "dog food",
    "cat food",
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // suppressHydrationWarning: next-themes sets the theme class on <html>
    // before React hydrates, which is an intentional server/client mismatch.
    <html lang="en" suppressHydrationWarning>
      <body className={`${body.variable} ${display.variable} font-sans`}>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <SiteMain>{children}</SiteMain>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  )
}
