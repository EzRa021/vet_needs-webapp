import Link from "next/link"
import { Award, Users, Truck, ShieldCheck, PawPrint, Bone, Snowflake, HeartPulse, Store } from "lucide-react"

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
    "Jvigor is a pet food and pet care shop in Ibadan: dog and cat food, fresh-frozen meat, health products and accessories, delivered to your door or ready to collect.",
}

const VALUES = [
  { icon: PawPrint, title: "Pets come first", text: "We stock food and care products that keep dogs, cats and other pets healthy and happy." },
  { icon: Award, title: "Products you can trust", text: "Every bag and product comes from suppliers we know, stored and handled properly." },
  { icon: Users, title: "Real help", text: "Not sure what to feed your new puppy? Ask us. We'll give you a straight answer." },
  { icon: Truck, title: "Your way", text: "Delivered to your door anywhere in Ibadan, or ready to collect from your nearest store." },
]

// What the shop actually sells — its pet departments. (This strip used to
// show invented figures: "5,000+ orders", "36 states served", "4.8/5".)
const RANGE = [
  { icon: Bone, title: "Dry food", text: "Kibble for dogs and cats, in bags" },
  { icon: Snowflake, title: "Fresh-frozen meat", text: "Weighed out by the kilo" },
  { icon: HeartPulse, title: "Health & supplements", text: "Vitamins and everyday vet products" },
  { icon: Store, title: "Accessories", text: "The essentials for home and walks" },
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
              Everything your pet needs, <span className="text-primary">right here in Ibadan</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Jvigor is a pet food and pet care shop. We stock good food,
              health products and everyday essentials for dogs, cats and other
              pets, and get them to you the way that suits you: to your door,
              or ready at the store.
            </p>
            <Button size="lg" asChild>
              <Link href="/shop">Explore Products</Link>
            </Button>
          </RevealOnLoad>
          <RevealOnLoad
            className="relative mx-auto aspect-[854/807] w-full max-w-[560px]"
            direction="left"
            delay={0.12}
          >
            <BrandImage
              src={`${IMG}/hero-banner.png`}
              alt="A cat, five dogs and a rabbit"
              fill
              priority
              className="object-contain drop-shadow-2xl"
              sizes="(max-width: 1024px) 100vw, 50vw"
              placeholderLabel="Pets"
            />
          </RevealOnLoad>
        </div>
      </section>

      {/* What we stock */}
      <section className="border-b bg-card">
        <RevealGroup className="container grid grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4 md:px-6">
          {RANGE.map(({ icon: Icon, title, text }) => (
            <RevealItem key={title} className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold leading-tight">{title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
              </div>
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
              alt="A vet checking a dog"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              placeholderLabel="Pet care image"
            />
          </Reveal>
          <Reveal className="order-1 space-y-4 lg:order-2" direction="left" delay={0.1}>
            <h2 className="text-3xl font-bold">Why we do it</h2>
            <p className="text-muted-foreground">
              A healthy pet starts with the right food. But finding good pet food
              in Ibadan often means going from shop to shop, or ordering from
              Lagos and waiting.
            </p>
            <p className="text-muted-foreground">
              We keep it simple. Order online with fair Naira prices and secure
              Paystack checkout. Choose your area and see the delivery price
              straight away, or collect from the store nearest you.
            </p>
            <p className="text-muted-foreground">
              Every product we stock is chosen for quality, safety and value,
              because the pets in your care deserve nothing less.
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
              From the suppliers we choose to how we answer your questions.
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
            <h2 className="text-2xl font-bold text-primary-foreground md:text-3xl">Ready when your pet is</h2>
            <p className="mx-auto mt-3 max-w-2xl text-primary-foreground/85">
              Food, health products and essentials for your dogs, cats and other
              pets, delivered across Ibadan or ready to collect.
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
