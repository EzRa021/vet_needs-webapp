import type React from "react"
import { Providers } from './providers'
import type { Metadata } from "next"
import { Inter, Manrope } from "next/font/google"
import "./globals.css"
import { SiteHeader, SiteFooter, SiteMain } from "@/components/site-chrome"
import { PRODUCTION_URL } from "@/lib/site-url"

// Manrope headings (modern, professional, friendly) + Inter body (readability)
const body = Inter({ subsets: ["latin"], variable: "--font-sans" })
const display = Manrope({ subsets: ["latin"], variable: "--font-display" })

export const metadata: Metadata = {
  // Without metadataBase, every relative OG/Twitter image resolves against
  // localhost and link previews break in production. Next warns about this at
  // build time and it's easy to ignore until someone shares a product on
  // WhatsApp and gets a blank card.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || PRODUCTION_URL),
  title: {
    default: "Jvigor — Pet Food & Pet Care in Ibadan",
    template: "%s | Jvigor",
  },
  description:
    "Dog and cat food, fresh-frozen meat, supplements and pet essentials. Delivered to your door in Ibadan or ready to collect from our store. Secure Paystack checkout.",
  openGraph: {
    type: "website",
    siteName: "Jvigor",
    locale: "en_NG",
  },
  // Pet only for now — poultry and farm feed are paused (030). What a pet
  // owner in Ibadan types into a search box.
  keywords: [
    "pet food Ibadan",
    "pet shop Ibadan",
    "dog food Ibadan",
    "cat food Ibadan",
    "pet supplies Nigeria",
    "dog food Nigeria",
    "cat food Nigeria",
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
