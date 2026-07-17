# PetDo — Full Fix Plan (historical)

> ✅ All critical/high items below are done. The **living to-do list** for
> everything still ahead is [`ROADMAP.md`](./ROADMAP.md) — work from that file.

Master list of everything the shop needs to be safe and launchable, based on the full code audit
(2026-07-12). Items are ordered by priority. Status is updated as fixes land.

Currency decision: **Nigerian Naira (₦/NGN)** end-to-end (Paystack charges in kobo).
Tax: **7.5% VAT**. Shipping: flat **₦1,500** (until shipping zones are built).

---

## 🔴 CRITICAL — security & money (must be done before taking real payments)

| # | Fix | File(s) | Status |
|---|-----|---------|--------|
| C1 | **Rotate the leaked Supabase service-role key** in the Supabase dashboard (Settings → API → regenerate). The key was committed in `.env`. *Only you can do this — do it today.* | Supabase dashboard | ⚠️ YOU |
| C2 | Move secrets to `.env.local`, add `.env.example` template, remove secrets from `.env` | `.env`, `.env.local`, `.env.example` | ✅ |
| C3 | Delete the fake payment simulator that lets anyone mark any order "paid" | `app/api/checkout/process-payment/` | ✅ |
| C4 | Server must compute prices/totals from the database — never trust the browser's prices | `app/api/checkout/create-order/route.js` | ✅ |
| C5 | Paystack initialize: require login, verify order ownership, take amount from the DB order (not the request) | `app/api/payment/paystack/initialize/route.js` | ✅ |
| C6 | Paystack verify: check paid amount matches order total; mark paid atomically | `app/api/payment/paystack/verify/route.js` | ✅ |
| C7 | Add Paystack **webhook** (signature-verified) as the source of truth for payment — browser redirect becomes UX only | `app/api/payment/paystack/webhook/route.js` | ✅ |
| C8 | Fix search-filter injection in items API (raw user input in `.or(...)`) | `app/api/shop/items/route.js` | ✅ |
| C9 | Stock: check availability at order time; decrement atomically on payment (SQL RPC) | `supabase/migrations/001_stock_and_orders.sql` | ✅ SQL provided — run in Supabase |
| C10 | Audit Supabase **RLS policies** (orders must be readable/updatable only by owner; items read-only to public) | Supabase dashboard / SQL file | ✅ SQL provided — run in Supabase |
| C11 | Remove raw card fields (`cardNumber`, `cvv`, …) from checkout store — PCI risk, unused | `stores/checkoutStore.js` | ✅ |

## 🟠 HIGH — broken shopping flow

| # | Fix | File(s) | Status |
|---|-----|---------|--------|
| H1 | Add Supabase **middleware** so sessions refresh and don't randomly expire | `middleware.ts` | ✅ |
| H2 | Checkout kicks out logged-in users (redirect fires while auth is still loading, and during render) | `app/checkout/page.jsx` | ✅ |
| H3 | Cart is cleared too early (on order creation) which breaks the review page redirect logic; clear it after successful payment instead | `stores/checkoutStore.js`, `app/checkout/verify/page.jsx`, `app/checkout/review/page.jsx` | ✅ |
| H4 | **Currency mismatch**: UI shows `$` + US tax/states but Paystack charges ₦. Switch everything to NGN, 7.5% VAT, Nigerian states | all pages, `stores/cartStore.js`, `lib/utils.ts` | ✅ |
| H5 | **Product detail page** — customers can't click a product at all today | `app/shop/product/[id]/page.jsx` | ✅ |
| H6 | Header search does nothing (shop page ignores `?search=` URL param) | `components/header.jsx`, `app/shop/page.jsx` | ✅ |
| H7 | Cart badge shows number of distinct items, not total quantity | `components/header.jsx` | ✅ |
| H8 | Missing pages that the app links to: `/reset-password`, `/auth/auth-code-error` | new pages | ✅ |
| H9 | Department filter on items API silently returns wrong rows (needs `!inner` join) | `app/api/shop/items/route.js` | ✅ |

## 🟡 MEDIUM — needed soon after launch

- **M1 — Admin dashboard**: add/edit products, upload images, view & manage orders, RBAC (admin role via Supabase custom claims).
- **M2 — Order confirmation email** (Resend or Supabase SMTP) after webhook confirms payment.
- **M3 — "My Orders" account page** with order status + details.
- **M4 — Address book** (save shipping addresses per user).
- **M5 — Guest checkout.**
- ~~**M6 — Billing address form**~~ — dropped. The placeholder and its dead store
  slice were removed instead: Paystack hosts the card form, so nothing here reads
  a billing address. Revisit only if a provider requires AVS.
- **M7 — Real Nigerian shipping zones/rates** instead of flat fee.
- **M8 — TypeScript migration** + remove `ignoreBuildErrors`, Zod validation on all API routes and forms.
- **M9 — Normalize `order_items`** into its own table (price audit trail, queryable).
- **M10 — SEO**: server-render catalog, per-product metadata, sitemap, robots.txt, JSON-LD.
- **M11 — Image optimization**: remove `images.unoptimized`, host product images in Supabase Storage, replace hot-linked Unsplash logo.
- **M12 — De-duplicate code**: two `use-toast`/`use-mobile` hooks, duplicate `globals.css`, unused shadcn components.

## 🟢 LOW — growth features

Wishlist, reviews & ratings, coupons/promotions, related & recently-viewed products,
returns portal, invoices (PDF), multi-language/currency, blog/CMS, PWA + push
notifications, analytics dashboard, audit logs, CI (GitHub Actions) + Sentry, tests.

---

## Manual steps for YOU (cannot be done from code)

1. **Rotate the service-role key** (C1) — Supabase dashboard → Project Settings → API.
2. **Run the SQL migrations in order** in the Supabase SQL editor:
   1. `supabase/migrations/000_initial_schema.sql` — base tables
      (departments, categories, items, orders) + optional sample products.
      Needed because the new Supabase project starts empty.
   2. `supabase/migrations/001_stock_and_orders.sql` — payment columns,
      atomic stock function, RLS policies.
3. **Set the Paystack webhook URL** in the Paystack dashboard:
   `https://YOUR-DOMAIN/api/payment/paystack/webhook`, and put `PAYSTACK_SECRET_KEY`
   in `.env.local`.
4. `git init` the project so changes are tracked (recommended).
