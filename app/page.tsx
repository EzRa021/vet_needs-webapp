"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Truck, ShieldCheck, Headphones, Store } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/product-card";
import PromoBanner from "@/components/promo-banner";
import ProductRail from "@/components/product-rail";
import { StarRating } from "@/components/star-rating";
import { Reveal } from "@/components/motion/reveal";
import HeroSlider from "@/components/home/hero-slider";
import { CategoryMenu, CategoryChips } from "@/components/home/category-menu";
import PromoTiles from "@/components/home/promo-tiles";
import DealCard, { pickDeal } from "@/components/home/deal-card";
import ProductTabs, { buildTabs } from "@/components/home/product-tabs";
import ProductLists from "@/components/home/product-lists";
import { usePromotion, useBestSellers } from "@/stores/shopStore";
import { useTopReviews } from "@/stores/reviewStore";
import { useRecentlyViewed } from "@/stores/recentlyViewedStore";
import { useHydrated } from "@/hooks/use-hydrated";

// Home page, marketplace layout (2026-11-25, client's brief): products on the
// first screen. Slider and categories, three tiles, the best deal beside a
// tabbed grid, best sellers, then the shop's story (delivery, reviews) lower
// down. Every section hides itself when it has too little to show, so a small
// catalogue never looks empty or repeats itself.

const fetchItems = async (qs: string) => {
  const res = await fetch(`/api/shop/items?${qs}`);
  if (!res.ok) throw new Error("Failed to load products");
  return (await res.json()).data as any[];
};

// The newest products — one request feeds the "New arrivals" tab and the
// category tabs (grouped from it).
const useLatestItems = () =>
  useQuery({
    queryKey: ["items", "home-latest"],
    queryFn: () => fetchItems("limit=48&sortBy=created_at&sortOrder=desc"),
    staleTime: 60 * 1000,
  });

const useFeaturedItems = () =>
  useQuery({
    queryKey: ["items", "featured"],
    queryFn: () => fetchItems("featured=true&limit=10&sortBy=created_at&sortOrder=desc"),
    staleTime: 60 * 1000,
  });

// Products with a "was" price, for the deal card and the On sale list.
const useOnSaleItems = () =>
  useQuery({
    queryKey: ["items", "on-sale"],
    queryFn: () => fetchItems("onSale=true&limit=24&sortBy=created_at&sortOrder=desc"),
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
  // The header shares the taxonomy query and usually has it cached before the
  // page hydrates; until then, render what the server sent (loading) — see
  // hooks/use-hydrated.js.
  const hydrated = useHydrated();
  const { data: taxonomyData, isLoading: taxonomyFetching } = useHomeTaxonomy();
  const taxonomyLoading = taxonomyFetching || !hydrated;
  const taxonomy = hydrated ? taxonomyData : undefined;

  const { data: slides } = usePromotion("home_hero");
  const { data: tilePromos } = usePromotion("home_tile");
  const { data: latest, isLoading: latestLoading } = useLatestItems();
  const { data: featured } = useFeaturedItems();
  const { data: onSale } = useOnSaleItems();
  const { data: bestSellers } = useBestSellers(6);
  const { data: topReviews } = useTopReviews(3);
  const { items: recentlyViewed } = useRecentlyViewed();

  const deal = pickDeal(onSale);
  const tabs = buildTabs({ latest, featured });
  const saleList = (onSale || [])
    .filter((i: any) => Number(i.compare_at_price) > Number(i.price))
    .sort(
      (a: any, b: any) =>
        (b.compare_at_price - b.price) / b.compare_at_price -
        (a.compare_at_price - a.price) / a.compare_at_price,
    );

  return (
    <main className="flex-1">
      <h1 className="sr-only">Jvigor — pet food and pet care in Ibadan</h1>

      {/* ===== Slider, categories, tiles ===== */}
      <div className="container flex flex-col gap-4 px-4 pt-4 md:px-6 md:pt-6">
        <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <CategoryMenu
            taxonomy={taxonomy}
            isLoading={taxonomyLoading}
            className="hidden lg:flex"
          />
          <HeroSlider promotions={slides} />
        </div>
        <CategoryChips
          taxonomy={taxonomy}
          isLoading={taxonomyLoading}
          className="lg:hidden"
        />
        <PromoTiles promotions={tilePromos} taxonomy={taxonomy} />
      </div>

      {/* ===== Best deal + tabbed products ===== */}
      <section aria-label="Products" className="container px-4 py-8 md:px-6 md:py-10">
        <div
          className={
            deal
              ? "grid items-start gap-6 lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)]"
              : undefined
          }
        >
          <DealCard deal={deal} />
          <ProductTabs tabs={tabs} isLoading={latestLoading} besideDeal={!!deal} />
        </div>
      </section>

      {/* ===== Best sellers =====
          Units actually sold in paid orders (015), not an admin flag. Hidden
          until at least three products have sold — an empty or one-item
          "best sellers" advertises that nobody is buying. */}
      {bestSellers && bestSellers.length >= 3 && (
        <section aria-labelledby="best-sellers" className="container px-4 pb-8 md:px-6 md:pb-10">
          <div className="mb-4 flex items-end justify-between gap-3 border-b pb-3">
            <div>
              <h2 id="best-sellers" className="font-display text-xl font-bold md:text-2xl">
                Best sellers
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">What pet owners buy most</p>
            </div>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link href="/shop">
                Shop all
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bestSellers.slice(0, 6).map((item: any) => (
              <li key={item.id}>
                <ProductCard item={item} layout="row" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ===== Admin-managed banner (renders only when one is live) ===== */}
      <div className="container px-4 md:px-6">
        <PromoBanner placement="home_banner" />
      </div>

      {/* ===== Recently viewed =====
          Only ever populated for a returning visitor, so it costs a first-time
          shopper nothing. */}
      <div className="container px-4 py-8 md:px-6 md:py-10">
        <ProductRail title="Recently viewed" items={recentlyViewed} />
      </div>

      {/* ===== Trust strip ===== */}
      <section aria-label="Why shop with us" className="border-y bg-card">
        <ul className="container grid grid-cols-2 gap-6 px-4 py-6 md:grid-cols-4 md:px-6">
          {TRUST_POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{title}</p>
                <p className="text-xs text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
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
            <div className="grid gap-6 md:grid-cols-3">
              {topReviews.map((review) => {
                const name = review.author_name || "Jvigor customer";
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

      {/* ===== Short lists before the footer ===== */}
      <div className="container px-4 pb-12 md:px-6 md:pb-16">
        <ProductLists
          lists={[
            { title: "Top selling", items: bestSellers },
            { title: "On sale", items: saleList },
            { title: "Featured", items: featured },
          ]}
        />
      </div>
    </main>
  );
}
