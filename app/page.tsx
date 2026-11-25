"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Truck,
  ShieldCheck,
  Headphones,
  Store,
  Dog,
  Cat,
  Fish,
  BadgeCheck,
  PawPrint,
  Scale,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/product-card";
import BrandImage from "@/components/brand-image";
import PromoBanner from "@/components/promo-banner";
import ProductRail from "@/components/product-rail";
import { StarRating } from "@/components/star-rating";
import {
  Reveal,
  RevealOnLoad,
  RevealGroup,
  RevealItem,
} from "@/components/motion/reveal";
import { usePromotion, useBestSellers } from "@/stores/shopStore";
import { useTopReviews } from "@/stores/reviewStore";
import { useRecentlyViewed } from "@/stores/recentlyViewedStore";
import { useHydrated } from "@/hooks/use-hydrated";

// Served from /public/images — Next only serves static files from public/.
const IMG = "/images";

const useFeaturedItems = () =>
  useQuery({
    queryKey: ["items", "featured"],
    queryFn: async () => {
      const res = await fetch(
        "/api/shop/items?featured=true&limit=8&sortBy=created_at&sortOrder=desc",
      );
      if (!res.ok) throw new Error("Failed to load featured products");
      return (await res.json()).data;
    },
    staleTime: 60 * 1000,
  });

const useNewArrivals = () =>
  useQuery({
    queryKey: ["items", "new-arrivals"],
    queryFn: async () => {
      const res = await fetch(
        "/api/shop/items?limit=4&sortBy=created_at&sortOrder=desc",
      );
      if (!res.ok) throw new Error("Failed to load new arrivals");
      return (await res.json()).data;
    },
    staleTime: 60 * 1000,
  });

// The real category tree — departments with their categories nested.
const useHomeTaxonomy = () =>
  useQuery({
    queryKey: ["taxonomy"],
    queryFn: async () => {
      const res = await fetch("/api/shop/taxonomy");
      if (!res.ok) throw new Error("Failed to load categories");
      return (await res.json()).data;
    },
    staleTime: 5 * 60 * 1000,
  });

// Departments get an icon by slug where we have a sensible one; anything the
// shop adds later still renders, just with the default mark.
const DEPARTMENT_ICONS: Record<string, any> = {
  pet: PawPrint,
  pets: PawPrint,
  fish: Fish,
  cat: Cat,
  cats: Cat,
  dog: Dog,
  dogs: Dog,
};

const iconFor = (slug: string) => DEPARTMENT_ICONS[slug] || PawPrint;

// What a pet owner in Ibadan needs to know before they buy: how it reaches
// them, what it costs to get it there, and that paying is safe. Only claims
// the shop actually makes — no "vet-approved", no "nationwide".
const TRUST_POINTS = [
  {
    icon: Truck,
    title: "Door delivery in Ibadan",
    text: "See the price for your area before you pay",
  },
  {
    icon: Store,
    title: "Store pickup",
    text: "Collect from the store nearest you",
  },
  { icon: ShieldCheck, title: "Secure payment", text: "Protected by Paystack" },
  {
    icon: Headphones,
    title: "Friendly support",
    text: "Real people, ready to help",
  },
];

// How an order reaches the customer — a real sequence, so it's numbered.
const HOW_IT_WORKS = [
  {
    title: "Choose your area",
    text: "Pick your part of Ibadan at checkout and the delivery price shows straight away. No surprises at the end.",
  },
  {
    title: "Pay securely",
    text: "Checkout runs through Paystack, so we never see your card details.",
  },
  {
    title: "Delivered, or ready to collect",
    text: "We bring it to your door, or have it waiting at your store with a pickup code.",
  },
];

export default function HomePage() {
  const { data: featured, isLoading: featuredLoading } = useFeaturedItems();
  const { data: newArrivals, isLoading: arrivalsLoading } = useNewArrivals();
  // The header shares this query and usually has it cached before the page
  // hydrates; until then, render what the server sent (loading) — see
  // hooks/use-hydrated.js.
  const hydrated = useHydrated();
  const { data: taxonomyData, isLoading: taxonomyFetching } = useHomeTaxonomy();
  const taxonomyLoading = taxonomyFetching || !hydrated;
  const taxonomy = hydrated ? taxonomyData : undefined;
  const { promotion: hero } = usePromotion("home_hero");
  const { data: topReviews } = useTopReviews(3);
  const { data: bestSellers } = useBestSellers(4);
  const { items: recentlyViewed } = useRecentlyViewed();

  // Departments are the roots of the tree; categories are their children.
  const departments = taxonomy || [];

  // A live home_hero promotion takes over the hero's words, artwork and primary
  // CTA. With none set, we fall back to the designed default copy.
  const heroImage = hero?.image_url || `${IMG}/hero-banner.png`;
  const heroCta = hero?.link_url || "/shop";
  const heroCtaLabel = hero ? "Shop now" : "Shop pet food";

  return (
    <main className="flex-1">
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden border-b bg-surface-2 grain">
        <div className="container grid items-center gap-8 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:py-24">
          {/* Copy */}
          <div className="space-y-7">
            {/* Hero copy plays on mount, not on scroll — it is already in view,
                and a scroll trigger would leave it blank until the user moved.
                Delays cascade top-to-bottom so the eye follows the headline. */}
            <RevealOnLoad as="p" className="eyebrow">
              Pet food &amp; care in Ibadan
            </RevealOnLoad>
            <RevealOnLoad className="space-y-7" delay={0.08}>
              {hero ? (
                <>
                  <h1 className="font-display text-[2.75rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4rem]">
                    {hero.title}
                  </h1>
                  {hero.subtitle && (
                    <p className="max-w-[520px] text-lg text-muted-foreground">
                      {hero.subtitle}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <h1 className="font-display text-[2.75rem] font-extrabold leading-[0.98] tracking-tight sm:text-6xl lg:text-[4.25rem]">
                    Good food for
                    <br />
                    <span className="text-primary">happy, healthy</span>
                    <br />
                    pets.
                  </h1>
                  <p className="max-w-[520px] text-lg text-muted-foreground">
                    Dry food, fresh-frozen meat by the kilo, supplements and
                    everyday essentials for your dogs, cats and other pets —
                    delivered to your door in Ibadan, or ready to collect from
                    our store.
                  </p>
                </>
              )}
            </RevealOnLoad>

            {/* Departments — driven by the real category tree, so anything the
                shop adds in the admin shows up here automatically. */}
            {(taxonomyLoading || departments.length > 0) && (
              <RevealOnLoad delay={0.16}>
                <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  What are you shopping for?
                </p>
                <div className="flex flex-wrap gap-2">
                  {taxonomyLoading
                    ? Array.from({ length: 2 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-28 rounded-full" />
                      ))
                    : departments.map((dept) => {
                        const Icon = iconFor(dept.slug);
                        return (
                          <Link
                            key={dept.id}
                            href={`/shop/category/${dept.id}`}
                            className="group flex items-center gap-2 rounded-full border-2 border-border bg-background px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-primary hover:text-primary"
                          >
                            <Icon className="h-4 w-4 text-primary" />
                            {dept.name}
                          </Link>
                        );
                      })}
                </div>
              </RevealOnLoad>
            )}

            <RevealOnLoad
              className="flex flex-col gap-3 sm:flex-row"
              delay={0.24}
            >
              <Button
                size="lg"
                className="h-12 px-8 text-base shadow-lg shadow-primary/20"
                asChild
              >
                <Link href={heroCta}>
                  {heroCtaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base"
                asChild
              >
                <Link href="#delivery">How delivery works</Link>
              </Button>
            </RevealOnLoad>
          </div>

          {/* Image — cut-out PNG floating on the hero, no frame.
              object-contain shows the whole image; drop-shadow follows the
              cut-out's real edges instead of a rectangle. */}
          <RevealOnLoad
            className="relative mx-auto w-full max-w-[540px]"
            direction="left"
            delay={0.12}
            duration={0.6}
          >
            {/* Soft organic glow behind the subject, so a transparent PNG
                still has depth without a visible panel. */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 -z-10 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
            />
            {/* The artwork's own ratio, so it fills the frame with no dead space */}
            <div className="relative aspect-[854/807] w-full">
              <BrandImage
                src={heroImage}
                alt={hero?.title || "A cat, five dogs and a rabbit — the pets Jvigor feeds and cares for"}
                fill
                priority
                className="object-contain drop-shadow-2xl"
                sizes="(max-width: 1024px) 100vw, 55vw"
                placeholderLabel="Hero image"
                icon={PawPrint}
              />
            </div>

            {/* Rubber-stamp quality seal.
                Sat at top-4 inside the frame at a flat 96/112px, which on a
                phone covered a good part of the animals. Now it straddles the
                top edge instead of resting on the artwork, and scales with the
                viewport rather than staying poster-sized on a 375px screen. */}
            <div className="stamp absolute -top-2 left-0 h-16 w-16 text-[8px] font-extrabold leading-tight tracking-[0.12em] shadow-lg sm:-top-3 sm:h-20 sm:w-20 sm:text-[9px] lg:h-24 lg:w-24 lg:text-[10px] lg:tracking-[0.15em]">
              <BadgeCheck className="mb-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 lg:mb-1 lg:h-5 lg:w-5" />
              <span>Quality</span>
              <span>Assured</span>
            </div>

            {/* How it's sold: bags of dry food, fresh meat weighed out */}
            <div className="absolute bottom-2 right-0 flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 shadow-xl">
              <Scale className="h-5 w-5 text-earth" />
              <div className="leading-tight">
                <p className="text-sm font-bold">By the bag or by the kilo</p>
                <p className="text-xs text-muted-foreground">
                  Dry food in bags, fresh meat weighed out
                </p>
              </div>
            </div>
          </RevealOnLoad>
        </div>
      </section>

      {/* ===== Trust strip ===== */}
      <section className="border-b bg-card">
        <RevealGroup className="container grid grid-cols-2 gap-6 px-4 py-8 md:grid-cols-4 md:px-6">
          {TRUST_POINTS.map(({ icon: Icon, title, text }) => (
            <RevealItem key={title} className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{title}</p>
                <p className="text-xs text-muted-foreground">{text}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* ===== Categories ===== */}
      <section className="section">
        <div className="container px-4 md:px-6">
          <Reveal className="mb-8 flex items-end justify-between">
            <div>
              <p className="eyebrow mb-2">Browse the store</p>
              <h2 className="text-3xl font-bold md:text-4xl">
                Shop by category
              </h2>
            </div>
            <Button
              variant="ghost"
              className="hidden text-primary sm:inline-flex"
              asChild
            >
              <Link href="/shop">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </Reveal>

          {taxonomyLoading ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-2xl" />
              ))}
            </div>
          ) : departments.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-16 text-center">
              <PawPrint className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium">No categories yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a department in the admin and it will appear here.
              </p>
            </div>
          ) : (
            <RevealGroup className="grid gap-5 sm:grid-cols-2" stagger={0.1}>
              {departments.map((dept) => {
                const Icon = iconFor(dept.slug);
                return (
                  <RevealItem
                    key={dept.id}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-card"
                  >
                    <Link href={`/shop/category/${dept.id}`} className="block">
                      <div className="relative aspect-[16/7] overflow-hidden bg-surface-2">
                        <BrandImage
                          src={dept.image_url}
                          alt={dept.name}
                          fill
                          sizes="(max-width: 640px) 100vw, 50vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                          placeholderLabel={dept.name}
                          icon={Icon}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-5">
                          <div>
                            <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-primary backdrop-blur">
                              <Icon className="h-3 w-3" />
                              Department
                            </span>
                            <h3 className="font-display text-2xl font-bold text-white">
                              {dept.name}
                            </h3>
                          </div>
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/90 text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </Link>

                    {/* The department's real categories */}
                    {dept.children?.length > 0 ? (
                      <div className="flex flex-wrap gap-2 p-5">
                        {dept.children.map((cat) => (
                          <Link
                            key={cat.id}
                            href={`/shop/category/${cat.id}`}
                            className="rounded-full border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
                          >
                            {cat.name}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="p-5 text-sm text-muted-foreground">
                        {dept.description ||
                          "Browse everything in this department."}
                      </p>
                    )}
                  </RevealItem>
                );
              })}
            </RevealGroup>
          )}
        </div>
      </section>

      {/* ===== Admin-managed banner (renders only when one is live) ===== */}
      <div className="container px-4 md:px-6">
        <PromoBanner placement="home_banner" />
      </div>

      {/* ===== Featured =====
          Eyebrow used to read "Bestsellers" over `is_featured` products — but
          featured is an admin flag, not sales. Real best sellers now have their
          own rail below, computed from paid orders (015). */}
      <section className="section bg-surface-2">
        <div className="container px-4 md:px-6">
          <Reveal className="mb-8 flex items-end justify-between">
            <div>
              <p className="eyebrow mb-2">Handpicked</p>
              <h2 className="text-3xl font-bold md:text-4xl">
                Featured products
              </h2>
            </div>
            <Button
              variant="ghost"
              className="hidden text-primary sm:inline-flex"
              asChild
            >
              <Link href="/shop">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </Reveal>

          {featuredLoading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-2xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : featured && featured.length > 0 ? (
            <RevealGroup className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              {featured.map((item) => (
                <RevealItem key={item.id}>
                  <ProductCard item={item} />
                </RevealItem>
              ))}
            </RevealGroup>
          ) : (
            <div className="rounded-2xl border border-dashed py-16 text-center">
              <PawPrint className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium">No featured products yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Mark items as featured to show them here.
              </p>
              <Button className="mt-4" asChild>
                <Link href="/shop">Browse the shop</Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ===== Delivery & pickup =====
          Was a "Bulk & farm orders" band selling poultry feed. The shop is pet
          only now, and the question a new customer actually has is how the
          order reaches them — so this answers it, in the order it happens. */}
      <section id="delivery" className="section scroll-mt-24">
        <div className="container px-4 md:px-6">
          <Reveal className="relative grid gap-8 overflow-hidden rounded-3xl border bg-primary p-8 text-primary-foreground md:grid-cols-[0.9fr_1.1fr] md:items-center md:p-12">
            <div className="relative z-10 space-y-4">
              <Badge className="border-transparent bg-earth text-earth-foreground">
                Ibadan delivery &amp; pickup
              </Badge>
              <h2 className="text-2xl font-bold text-primary-foreground md:text-4xl">
                To your door, or ready at the store.
              </h2>
              <p className="max-w-md text-primary-foreground/85">
                We deliver across Ibadan, priced by your area. Rather collect?
                Your order waits at the store nearest you.
              </p>
              <Button
                size="lg"
                variant="secondary"
                className="h-12 px-8 font-semibold"
                asChild
              >
                <Link href="/shop">
                  Start shopping
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <ol className="relative z-10 flex flex-col gap-3">
              {HOW_IT_WORKS.map((step, i) => (
                <li
                  key={step.title}
                  className="flex gap-4 rounded-2xl bg-primary-foreground/10 p-4 md:p-5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-foreground font-display text-sm font-bold tabular-nums text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className="mt-0.5 text-sm text-primary-foreground/85">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* ===== Best sellers =====
          Actual sales, not an admin flag. Renders nothing until products have
          been bought — an empty "best sellers" rail on a new shop advertises
          that nobody has bought anything. */}
      <section className="section pt-0">
        <div className="container px-4 md:px-6">
          <ProductRail
            title="Best sellers"
            description="What pet owners buy most"
            items={bestSellers}
            href="/shop"
            hrefLabel="Shop all"
          />
        </div>
      </section>

      {/* ===== Recently viewed =====
          Only ever populated for a returning visitor, so it costs a first-time
          shopper nothing. */}
      <section className="section pt-0">
        <div className="container px-4 md:px-6">
          <ProductRail title="Recently viewed" items={recentlyViewed} />
        </div>
      </section>

      {/* ===== New arrivals ===== */}
      <section className="section pt-0">
        <div className="container px-4 md:px-6">
          <Reveal className="mb-8 flex items-end justify-between">
            <div>
              <p className="eyebrow mb-2">Just in</p>
              <h2 className="text-3xl font-bold md:text-4xl">New arrivals</h2>
            </div>
            <Button
              variant="ghost"
              className="hidden text-primary sm:inline-flex"
              asChild
            >
              <Link href="/shop?sortBy=created_at&sortOrder=desc">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </Reveal>

          {arrivalsLoading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
              ))}
            </div>
          ) : newArrivals && newArrivals.length > 0 ? (
            <RevealGroup className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              {newArrivals.map((item) => (
                <RevealItem key={item.id}>
                  <ProductCard item={item} />
                </RevealItem>
              ))}
            </RevealGroup>
          ) : null}
        </div>
      </section>

      {/* ===== Reviews =====
          Real customer reviews. This section used to render three invented
          customers with invented quotes under the heading "Real results from
          customers across Nigeria" — fabricated social proof. It now renders
          nothing at all until real reviews exist, which is the honest empty
          state: no testimonials beats fake ones. */}
      {topReviews && topReviews.length > 0 && (
        <section className="section bg-surface-2">
          <div className="container px-4 md:px-6">
            <Reveal className="mb-10 text-center">
              <p className="eyebrow mb-2 justify-center">Reviews</p>
              <h2 className="text-3xl font-bold md:text-4xl">
                Trusted by pet owners
              </h2>
              <p className="mt-2 text-muted-foreground">
                What customers say about what they bought
              </p>
            </Reveal>
            <RevealGroup className="grid gap-6 md:grid-cols-3" stagger={0.08}>
              {topReviews.map((review) => {
                const name = review.author_name || "Jvigor customer";
                return (
                  <RevealItem
                    key={review.id}
                    as="figure"
                    className="flex flex-col rounded-2xl border bg-card p-6 shadow-card"
                  >
                    <StarRating value={review.rating} className="mb-3" />
                    {review.title && (
                      <p className="mb-1.5 font-semibold">{review.title}</p>
                    )}
                    <blockquote className="flex-1 text-sm leading-relaxed text-muted-foreground">
                      “{review.comment}”
                    </blockquote>
                    <figcaption className="mt-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {name[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{name}</p>
                        {review.item?.name && (
                          <Link
                            href={`/product/${review.item_id}`}
                            className="line-clamp-1 text-xs text-muted-foreground hover:text-primary"
                          >
                            on {review.item.name}
                          </Link>
                        )}
                      </div>
                    </figcaption>
                  </RevealItem>
                );
              })}
            </RevealGroup>
          </div>
        </section>
      )}

      {/* ===== CTA band ===== */}
      <section className="section">
        <div className="container px-4 md:px-6">
          <Reveal className="relative overflow-hidden rounded-3xl border bg-card px-6 py-12 text-center md:px-12 md:py-16">
            <h2 className="text-2xl font-bold md:text-4xl">
              Give your pets the care they deserve
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground md:text-lg">
              Food, health products and everyday essentials for your dogs and
              cats, at fair prices, from a pet shop right here in Ibadan.
            </p>
            <Button
              size="lg"
              className="mt-6 h-12 px-8 text-base font-semibold"
              asChild
            >
              <Link href="/shop">
                Start Shopping
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
