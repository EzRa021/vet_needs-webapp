import Link from "next/link"
import { Leaf, Award, Users, Truck, ShieldCheck, Sprout } from "lucide-react"

import { Button } from "@/components/ui/button"
import BrandImage from "@/components/brand-image"
import {
  Reveal,
  RevealOnLoad,
  RevealGroup,
  RevealItem,
} from "@/components/motion/reveal"

// Served from /public/images — Next only serves static files from public/.
const IMG = "/images"

export const metadata = {
  title: "About Us",
  description:
    "VetNeeds supplies quality poultry feed, pet food and farm & pet accessories to farmers and pet owners across Nigeria.",
}

const VALUES = [
  { icon: Leaf, title: "Animal Wellbeing", text: "We stock feed and food that keeps livestock and pets healthy and thriving." },
  { icon: Award, title: "Quality Assured", text: "Every bag and product is sourced from trusted, vetted suppliers." },
  { icon: Users, title: "Customer First", text: "Friendly support from people who understand farming and pet care." },
  { icon: Truck, title: "Reliable Delivery", text: "Fast, dependable shipping to farms and homes nationwide." },
]

const STATS = [
  { value: "5,000+", label: "Orders delivered" },
  { value: "300+", label: "Products stocked" },
  { value: "36", label: "States served" },
  { value: "4.8/5", label: "Customer rating" },
]

export default function AboutPage() {
  return (
    <div className="flex-1">
      {/* Hero */}
      <section className="border-b bg-surface-2">
        <div className="container grid items-center gap-10 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-2">
          <RevealOnLoad className="space-y-5">
            <nav className="flex items-center text-sm text-muted-foreground">
              <Link href="/" className="hover:text-primary">Home</Link>
              <span className="mx-2">/</span>
              <span className="text-foreground">About</span>
            </nav>
            <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
              Helping Nigeria's animals <span className="text-primary">grow strong</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              VetNeeds is a specialist agri-and-pet-care store. We supply premium
              poultry feed, pet food and farm &amp; pet accessories — connecting
              trusted producers with the farmers and pet owners who rely on them.
            </p>
            <Button size="lg" asChild>
              <Link href="/shop">Explore Products</Link>
            </Button>
          </RevealOnLoad>
          <RevealOnLoad
            className="relative aspect-[4/3] overflow-hidden rounded-3xl border shadow-xl"
            direction="left"
            delay={0.12}
          >
            <BrandImage
              src={`${IMG}/farmer-with-chickens.jpg`}
              alt="Farmer caring for healthy chickens"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              placeholderLabel="Farm image"
            />
          </RevealOnLoad>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b bg-card">
        <RevealGroup className="container grid grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4 md:px-6">
          {STATS.map((s) => (
            <RevealItem key={s.label} className="text-center">
              <p className="font-display text-3xl font-extrabold text-primary md:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* Story */}
      <section className="section">
        <div className="container grid items-center gap-10 px-4 md:px-6 lg:grid-cols-2">
          <Reveal
            className="relative order-2 aspect-[4/3] overflow-hidden rounded-3xl border shadow-card lg:order-1"
            direction="right"
          >
            <BrandImage
              src={`${IMG}/trust-vet-with-dog.jpg`}
              alt="Vet caring for a dog"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              placeholderLabel="Pet care image"
            />
          </Reveal>
          <Reveal className="order-1 space-y-4 lg:order-2" direction="left" delay={0.1}>
            <h2 className="text-3xl font-bold">Our Story</h2>
            <p className="text-muted-foreground">
              VetNeeds began with a simple belief: healthy animals start with the
              right nutrition. From poultry farmers raising layers and broilers to
              families caring for dogs, cats and fish, everyone deserves reliable
              access to quality feed and care products.
            </p>
            <p className="text-muted-foreground">
              What started as a single supply point has grown into a trusted online
              store serving customers across Nigeria — with fair Naira pricing,
              secure Paystack checkout and dependable delivery to farms and homes.
            </p>
            <p className="text-muted-foreground">
              Every product we stock is chosen for quality, safety and value,
              because the animals in your care deserve nothing less.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Values */}
      <section className="section bg-surface-2">
        <div className="container px-4 md:px-6">
          <Reveal className="mb-10 text-center">
            <h2 className="text-3xl font-bold">What We Stand For</h2>
            <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
              Our values guide everything — from the suppliers we choose to how we
              treat every customer.
            </p>
          </Reveal>
          <RevealGroup className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ icon: Icon, title, text }) => (
              <RevealItem key={title} className="rounded-2xl border bg-card p-6 text-center shadow-card card-lift">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container px-4 md:px-6">
          <Reveal className="relative overflow-hidden rounded-3xl bg-primary p-8 text-center text-primary-foreground md:p-12">
            <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-primary-foreground/80" />
            <h2 className="text-2xl font-bold text-primary-foreground md:text-3xl">Join the VetNeeds family</h2>
            <p className="mx-auto mt-3 max-w-2xl text-primary-foreground/85">
              Quality feed, food and accessories for your flock, herd and pets —
              trusted by thousands across Nigeria.
            </p>
            <Button size="lg" variant="secondary" className="mt-6 font-semibold" asChild>
              <Link href="/shop">Shop Now</Link>
            </Button>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
