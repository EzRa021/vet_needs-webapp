import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { LEGAL } from "@/lib/legal"

// Shared shell for /privacy and /terms so the two can't drift in look or in
// "last updated" handling.
export function LegalPage({ title, intro, children }) {
  return (
    <div className="container max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-1 text-sm text-muted-foreground"
      >
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">{title}</span>
      </nav>

      <header className="mb-10">
        <h1 className="mb-3 font-display text-3xl font-bold md:text-4xl">{title}</h1>
        <p className="text-muted-foreground">{intro}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Last updated: <span className="font-medium text-foreground">{LEGAL.lastUpdated}</span>
        </p>
      </header>

      <div className="space-y-10">{children}</div>

      <footer className="mt-12 rounded-2xl border bg-muted/40 p-6">
        <h2 className="font-display font-semibold">Questions about this page?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Email us at{" "}
          <a href={`mailto:${LEGAL.supportEmail}`} className="text-primary hover:underline">
            {LEGAL.supportEmail}
          </a>{" "}
          or use the{" "}
          <Link href="/contact" className="text-primary hover:underline">
            contact form
          </Link>
          .
        </p>
      </footer>
    </div>
  )
}

export function Section({ id, heading, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-3 font-display text-xl font-semibold">{heading}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground [&_a]:text-primary [&_a:hover]:underline [&_strong]:font-medium [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  )
}

export function List({ items }) {
  return (
    <ul className="ml-5 list-disc space-y-1.5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}
