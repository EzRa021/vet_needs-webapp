"use client"

import { useState } from "react"
import Link from "next/link"
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Send,
  CheckCircle2,
  Facebook,
  Instagram,
  Twitter,
  Loader2,
  TriangleAlert,
  MessageCircle,
} from "lucide-react"
import { whatsappLink } from "@/lib/legal"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Reveal, RevealOnLoad } from "@/components/motion/reveal"
import { Alert, AlertDescription } from "@/components/ui/alert"

const CONTACT_INFO = [
  { icon: MapPin, title: "Address", lines: ["Lagos, Nigeria", "Nationwide delivery"] },
  { icon: Phone, title: "Phone", lines: ["+234 800 000 0000", "Mon–Sat, 8am–6pm"] },
  { icon: Mail, title: "Email", lines: ["support@vetneeds.ng", "orders@vetneeds.ng"] },
  { icon: Clock, title: "Business Hours", lines: ["Mon–Fri: 8am – 6pm", "Sat: 9am – 4pm", "Sun: Closed"] },
]

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  subject: "general",
  message: "",
  website: "", // honeypot
}

export default function ContactPage() {
  const whatsapp = whatsappLink("Hi VetNeeds — I have a question")
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setField = (k: string) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || "Couldn't send your message. Please try again.")
        return
      }

      setForm(EMPTY_FORM)
      setFormSubmitted(true)
    } catch {
      setError("Check your connection and try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex-1">
      {/* Header band */}
      <section className="border-b bg-surface-2">
        <RevealOnLoad className="container px-4 py-12 md:px-6 md:py-16">
          <nav className="mb-3 flex items-center text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">Contact</span>
          </nav>
          <h1 className="text-4xl font-extrabold md:text-5xl">Get in touch</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            Questions about feed, an order, or bulk supply for your farm? Our team
            is happy to help — reach out any time.
          </p>
        </RevealOnLoad>
      </section>

      <div className="container grid gap-8 px-4 py-12 md:px-6 md:py-16 lg:grid-cols-3">
        {/* Form */}
        <Reveal className="lg:col-span-2">
          <Card className="shadow-card">
            <CardContent className="p-6 md:p-8">
              <h2 className="mb-6 text-2xl font-bold">Send us a message</h2>

              {formSubmitted ? (
                <div className="flex flex-col items-center rounded-2xl border border-success/30 bg-success/10 p-8 text-center">
                  <CheckCircle2 className="mb-3 h-12 w-12 text-success" />
                  <h3 className="text-lg font-semibold">Message sent!</h3>
                  <p className="mt-1 text-muted-foreground">
                    Thank you for reaching out. We'll get back to you as soon as we can.
                  </p>
                  <Button variant="outline" className="mt-5" onClick={() => setFormSubmitted(false)}>
                    Send another message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <TriangleAlert className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="first-name">First Name</Label>
                      <Input
                        id="first-name"
                        placeholder="Ada"
                        required
                        value={form.firstName}
                        onChange={setField("firstName")}
                        disabled={sending}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name">Last Name</Label>
                      <Input
                        id="last-name"
                        placeholder="Okonkwo"
                        required
                        value={form.lastName}
                        onChange={setField("lastName")}
                        disabled={sending}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      value={form.email}
                      onChange={setField("email")}
                      disabled={sending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+234 800 000 0000"
                      value={form.phone}
                      onChange={setField("phone")}
                      disabled={sending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Select
                      value={form.subject}
                      onValueChange={(v) => setForm((f) => ({ ...f, subject: v }))}
                      disabled={sending}
                    >
                      <SelectTrigger id="subject">
                        <SelectValue placeholder="Select a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General Inquiry</SelectItem>
                        <SelectItem value="order">Order Status</SelectItem>
                        <SelectItem value="bulk">Bulk / Farm Supply</SelectItem>
                        <SelectItem value="return">Returns &amp; Refunds</SelectItem>
                        <SelectItem value="product">Product Information</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="How can we help you?"
                      className="min-h-[150px]"
                      required
                      value={form.message}
                      onChange={setField("message")}
                      disabled={sending}
                    />
                  </div>

                  {/* Honeypot — hidden from people, irresistible to bots */}
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    value={form.website}
                    onChange={setField("website")}
                    className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
                  />

                  <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={sending}>
                    {sending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {sending ? "Sending…" : "Send Message"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </Reveal>

        {/* Info */}
        <Reveal className="space-y-6" delay={0.1}>
          <Card className="shadow-card">
            <CardContent className="space-y-6 p-6">
              <h2 className="text-xl font-bold">Contact information</h2>
              {CONTACT_INFO.map(({ icon: Icon, title, lines }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    {lines.map((l) => (
                      <p key={l} className="text-sm text-muted-foreground">{l}</p>
                    ))}
                  </div>
                </div>
              ))}

              {/* Fastest way to reach a Nigerian shop — customer-initiated, so
                  no API and no risk. Only shows once a real number is set. */}
              {whatsapp && (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 font-medium text-success transition-colors hover:bg-success/20"
                >
                  <MessageCircle className="h-5 w-5 shrink-0" />
                  Chat with us on WhatsApp
                </a>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="p-6">
              <h2 className="mb-4 text-xl font-bold">Follow us</h2>
              <div className="flex gap-2">
                {[Facebook, Instagram, Twitter].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border text-muted-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="sr-only">Social link</span>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  )
}
