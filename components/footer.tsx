"use client"

import Link from "next/link"
import { useState } from "react"
import {
  PawPrint,
  Facebook,
  Instagram,
  Twitter,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  Send,
  Loader2,
  MessageCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { LEGAL, whatsappLink } from "@/lib/legal"

const SHOP_LINKS = [
  { label: "All Products", href: "/shop" },
  { label: "New Arrivals", href: "/shop?sortBy=created_at&sortOrder=desc" },
  { label: "My Orders", href: "/account/orders" },
  { label: "Cart", href: "/cart" },
]

const COMPANY_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
]

const SUPPORT_LINKS = [
  { label: "Help Center", href: "/contact" },
  { label: "Returns & Refunds", href: "/contact" },
  { label: "Delivery Information", href: "/contact" },
]

export default function Footer() {
  const { toast } = useToast()
  const whatsapp = whatsappLink("Hi VetNeeds — I have a question about")
  const [email, setEmail] = useState("")
  const [subscribing, setSubscribing] = useState(false)
  const [honeypot, setHoneypot] = useState("") // bots fill this; humans can't see it

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || subscribing) return

    setSubscribing(true)
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "footer", website: honeypot }),
      })
      const json = await res.json()

      if (!res.ok) {
        toast({
          title: "Couldn't subscribe",
          description: json.error || "Please try again.",
          variant: "destructive",
        })
        return
      }

      setEmail("")
      toast({
        title: "You're subscribed! 🎉",
        description: "We'll send you deals and pet care tips — no spam, ever.",
      })
    } catch {
      toast({
        title: "Couldn't subscribe",
        description: "Check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setSubscribing(false)
    }
  }

  return (
    <footer className="border-t bg-card">
      {/* Newsletter band */}
      <div className="border-b">
        <div className="container flex flex-col items-center gap-6 px-4 py-10 md:flex-row md:justify-between md:px-6">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-bold">Get deals & pet care tips</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Join our newsletter — exclusive offers for your furry friends, once a week.
            </p>
          </div>
          <form onSubmit={handleSubscribe} className="flex w-full max-w-md gap-2">
            <div className="relative flex-1">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                required
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 pl-9"
                aria-label="Email address for newsletter"
                disabled={subscribing}
              />
            </div>
            {/* Honeypot — hidden from people, irresistible to bots */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
            />
            <Button type="submit" className="h-11 px-5" disabled={subscribing}>
              {subscribing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Subscribe
            </Button>
          </form>
        </div>
      </div>

      {/* Main columns */}
      <div className="container px-4 py-12 md:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 space-y-4 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5" aria-label="VetNeeds home">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <PawPrint className="h-5 w-5" />
              </div>
              <span className="font-display text-xl font-bold">VetNeeds</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Quality poultry feed, pet food and farm &amp; pet accessories —
              delivered across Nigeria. Trusted by farmers and pet owners alike.
            </p>
            <div className="flex gap-2">
              {[
                { icon: Facebook, label: "Facebook" },
                { icon: Instagram, label: "Instagram" },
                { icon: Twitter, label: "Twitter" },
              ].map(({ icon: Icon, label }) => (
                <Link
                  key={label}
                  href="#"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide">Shop</h3>
            <nav className="flex flex-col space-y-2.5">
              {SHOP_LINKS.map((l) => (
                <Link key={l.label} href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide">Company</h3>
            <nav className="flex flex-col space-y-2.5">
              {COMPANY_LINKS.map((l) => (
                <Link key={l.label} href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  {l.label}
                </Link>
              ))}
            </nav>
            <h3 className="mb-4 mt-6 text-sm font-semibold uppercase tracking-wide">Support</h3>
            <nav className="flex flex-col space-y-2.5">
              {SUPPORT_LINKS.map((l) => (
                <Link key={l.label} href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide">Contact</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                Lagos, Nigeria
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                {LEGAL.supportEmail}
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                {LEGAL.supportPhone}
              </p>
              {/* Click-to-chat: customer-initiated, so no API, no approval, no
                  risk to the number. Renders only once a real number is set. */}
              {whatsapp && (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 font-medium text-success transition-colors hover:bg-success/20"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  Chat on WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t">
        <div className="container flex flex-col items-center gap-4 px-4 py-6 text-center sm:flex-row sm:justify-between sm:text-left md:px-6">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} VetNeeds. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs text-muted-foreground hover:text-primary">Privacy Policy</Link>
            <Link href="/terms" className="text-xs text-muted-foreground hover:text-primary">Terms of Service</Link>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-success" />
            Secure payments powered by Paystack
          </p>
        </div>
      </div>
    </footer>
  )
}
