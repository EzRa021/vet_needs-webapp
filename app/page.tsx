"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Truck,
  ShieldCheck,
  Headphones,
  Leaf,
  Sparkles,
  Bird,
  Dog,
  Cat,
  Fish,
  BadgeCheck,
  Wheat,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import ProductCard from "@/components/product-card";
import BrandImage from "@/components/brand-image";
import PromoBanner from "@/components/promo-banner";
import ProductRail from "@/components/product-rail";
import { StarRating } from "@/components/star-rating";
import { usePromotion, useBestSellers } from "@/stores/shopStore";
import { useTopReviews } from "@/stores/reviewStore";
import { useRecentlyViewed } from "@/stores/recentlyViewedStore";

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
  pet: Dog,
  pets: Dog,
  feed: Wheat,
  feeds: Wheat,
  poultry: Bird,
  fish: Fish,
  cat: Cat,
  cats: Cat,
  dog: Dog,
  dogs: Dog,
};

const iconFor = (slug: string) => DEPARTMENT_ICONS[slug] || Leaf;

const TRUST_POINTS = [
  {
    icon: Truck,
    title: "Nationwide Delivery",
    text: "Fast shipping across Nigeria",
  },
  { icon: ShieldCheck, title: "Secure Payment", text: "Protected by Paystack" },
  { icon: Leaf, title: "Quality Guaranteed", text: "Farm-fresh, vet-approved" },
  {
    icon: Headphones,
    title: "Friendly Support",
    text: "Real people, ready to help",
  },
];

export default function HomePage() {
  const { data: featured, isLoading: featuredLoading } = useFeaturedItems();
  const { data: newArrivals, isLoading: arrivalsLoading } = useNewArrivals();
  const { data: taxonomy, isLoading: taxonomyLoading } = useHomeTaxonomy();
  const { promotion: hero } = usePromotion("home_hero");
  const { data: topReviews } = useTopReviews(3);
  const { data: bestSellers } = useBestSellers(4);
  const { items: recentlyViewed } = useRecentlyViewed();

  // Departments are the roots of the tree; categories are their children.
  const departments = taxonomy || [];

  // A live home_hero promotion takes over the hero's words, artwork and primary
  // CTA. With none set, we fall back to the designed default copy.
  const heroImage = hero?.image_url || `${IMG}/hero-banner.png`;
  const heroCta = hero?.link_url || "/shop?search=feed";
  const heroCtaLabel = hero ? "Shop now" : "Shop Poultry Feed";

  return (
    <main className="flex-1">
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden border-b bg-surface-2 grain">
        <div className="container grid items-center gap-8 px-4 py-14 md:px-6 md:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:py-24">
          {/* Copy */}
          <div className="space-y-7">
            <p className="eyebrow">Poultry feed · Pet food · Farm supply</p>
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
                  Feed that grows
                  <br />
                  <span className="text-primary">healthy flocks</span>
                  <br />
                  &amp; happy pets.
                </h1>
                <p className="max-w-[520px] text-lg text-muted-foreground">
                  From layer mash by the 25kg bag to premium dog, cat and fish
                  food — quality nutrition your animals thrive on, delivered
                  across Nigeria at fair Naira prices.
                </p>
              </>
            )}

            {/* Departments — driven by the real category tree, so anything the
                shop adds in the admin shows up here automatically. */}
            {(taxonomyLoading || departments.length > 0) && (
              <div>
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
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
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
                <Link href="/shop">Browse All Products</Link>
              </Button>
            </div>
          </div>

          {/* Image — cut-out PNG floating on the hero, no frame.
              object-contain shows the whole image; drop-shadow follows the
              cut-out's real edges instead of a rectangle. */}
          <div className="relative mx-auto w-full max-w-[720px]">
            {/* Soft organic glow behind the subject, so a transparent PNG
                still has depth without a visible panel. */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 -z-10 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
            />
            {/* 3:2 matches the artwork, so it fills the frame with no dead space */}
            <div className="relative aspect-[3/2] w-full">
              <BrandImage
                src={heroImage}
                alt={hero?.title || "Cats, dogs, chickens, rabbits and farm animals cared for with PetDo feed and pet food"}
                fill
                priority
                className="object-contain drop-shadow-2xl"
                sizes="(max-width: 1024px) 100vw, 55vw"
                placeholderLabel="Hero image"
                icon={Bird}
              />
            </div>

            {/* Rubber-stamp quality seal */}
            <div className="stamp absolute left-0 top-4 h-24 w-24 text-[10px] font-extrabold tracking-[0.15em] shadow-lg sm:h-28 sm:w-28">
              <BadgeCheck className="mb-1 h-5 w-5" />
              <span>Quality</span>
              <span>Assured</span>
            </div>

            {/* Weight tag chip */}
            <div className="absolute bottom-2 right-0 flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 shadow-xl">
              <Wheat className="h-5 w-5 text-earth" />
              <div className="leading-tight">
                <p className="text-sm font-bold">Sold by the bag</p>
                <p className="text-xs text-muted-foreground">
                  5kg · 10kg · 25kg
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Trust strip ===== */}
      <section className="border-b bg-card">
        <div className="container grid grid-cols-2 gap-6 px-4 py-8 md:grid-cols-4 md:px-6">
          {TRUST_POINTS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{title}</p>
                <p className="text-xs text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Categories ===== */}
      <section className="section">
        <div className="container px-4 md:px-6">
          <div className="mb-8 flex items-end justify-between">
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
          </div>

          {taxonomyLoading ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-2xl" />
              ))}
            </div>
          ) : departments.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-16 text-center">
              <Leaf className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium">No categories yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a department in the admin and it will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {departments.map((dept) => {
                const Icon = iconFor(dept.slug);
                return (
                  <div
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
                  </div>
                );
              })}
            </div>
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
          <div className="mb-8 flex items-end justify-between">
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
          </div>

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
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              {featured.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed py-16 text-center">
              <Leaf className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
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

      {/* ===== Promo band ===== */}
      <section className="section">
        <div className="container px-4 md:px-6">
          <div className="relative grid items-center gap-8 overflow-hidden rounded-3xl border bg-primary p-8 text-primary-foreground md:grid-cols-2 md:p-12">
            <div className="relative z-10 space-y-4">
              <Badge className="border-transparent bg-earth text-earth-foreground">
                Bulk & farm orders
              </Badge>
              <h2 className="text-2xl font-bold text-primary-foreground md:text-4xl">
                Feeding a farm? Save more when you buy in bulk.
              </h2>
              <p className="max-w-md text-primary-foreground/85">
                Stock up on poultry feed by the bag and keep your flock healthy
                all season. Reliable supply, delivered to your gate.
              </p>
              <Button
                size="lg"
                variant="secondary"
                className="h-12 px-8 font-semibold"
                asChild
              >
                <Link href="/shop?search=feed">
                  Shop Poultry Feed
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl">
              <BrandImage
                src={`${IMG}/farmer-with-chickens.jpg`}
                alt="Farmer with healthy chickens"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                placeholderLabel="Farm lifestyle image"
                icon={Leaf}
              />
            </div>
          </div>
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
            description="What farmers and pet owners buy most"
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
          <div className="mb-8 flex items-end justify-between">
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
          </div>

          {arrivalsLoading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
              ))}
            </div>
          ) : newArrivals && newArrivals.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              {newArrivals.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
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
            <div className="mb-10 text-center">
              <p className="eyebrow mb-2 justify-center">Reviews</p>
              <h2 className="text-3xl font-bold md:text-4xl">
                Trusted by farmers &amp; pet owners
              </h2>
              <p className="mt-2 text-muted-foreground">
                What customers say about what they bought
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {topReviews.map((review) => {
                const name = review.author_name || "PetDo customer";
                return (
                  <figure
                    key={review.id}
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
                  </figure>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== CTA band ===== */}
      <section className="section">
        <div className="container px-4 md:px-6">
          <div className="relative overflow-hidden rounded-3xl border bg-card px-6 py-12 text-center md:px-12 md:py-16">
            <h2 className="text-2xl font-bold md:text-4xl">
              Give your animals the care they deserve
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground md:text-lg">
              Join farmers and pet owners across Nigeria who trust PetDo for
              quality feed, food and accessories at fair prices.
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
          </div>
        </div>
      </section>
    </main>
  );
}
