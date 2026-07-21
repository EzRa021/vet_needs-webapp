# VetNeeds — Implementation Roadmap

> **The working to-do list.** Pick items top-to-bottom (P0 → P3), tick them off
> as they land, and add notes/dates next to finished items. Based on the full
> app audit of 2026-07-16. Historical security/flow fixes live in `FIXES.md`
> (all its critical/high items are done).
>
> Legend: 🔧 = schema/API already exists, build the missing half · 🆕 = full
> new build · 🐛 = verified defect

---

## ⚠️ Manual steps still outstanding (blockers — do first)

- [x] Run migrations in Supabase SQL editor, in order: `000` → `001` → `002` → `003` → `004`
      *(verified applied against live DB, 2026-07-16)*
- [x] **Run `005_newsletter_and_contact.sql`** *(verified applied 2026-07-17:
      `subscribers` + `contact_messages` both live. The earlier "not created yet"
      note was stale.)*
- [x] **Run `006_order_idempotency.sql`** *(verified applied 2026-07-17:
      `orders.idempotency_key` is live, so checkout is not broken.)*
- [ ] 🔒 **Run `023_hide_cost_columns.sql` — before entering any cost prices.**
      `items` is "readable by all", so `cost_price` (your margin) is readable by anyone
      with the public anon key: `GET /rest/v1/items?select=cost_price`. *(Verified
      2026-07-17: anon can read it — null everywhere today, which is the only reason it
      hasn't mattered. The inventory view exists to make staff fill it in, so shut this
      first.)* 023 revokes the column (+ `pos_*`) from anon **and** authenticated (a
      competitor can register a free account). **Ships with** the public `/api/shop/items`
      routes on explicit selects and the admin item reads/writes on the service role —
      run together, or `select('*')` breaks for the storefront. The code half is safe to
      run ahead of the migration (verified: public explicit selects work today); the
      migration just closes the hole.
- [ ] 🚨 **Run `010_orders_server_authored.sql` — SECURITY. 009 WAS NOT ENOUGH.**
      **The ₦1 hole is still open until this runs.** 009 closed the UPDATE path
      (rewriting `total_amount` on a server-priced order). But 001's INSERT policy
      survived:
      `create policy "users create own orders" for insert with check (auth.uid() = user_id)`
      — it validates *who owns the row* and nothing else. So the same attack works one
      step earlier: don't tamper with a priced order, **author a poisoned one**:
      `POST /rest/v1/orders {user_id: self, total_amount: 1, order_items:[{expensive, quantity:10}]}`
      → initialize charges ₦1 → confirmPaystackPayment compares ₦1 to ₦1 and agrees →
      `mark_order_paid()` decrements stock from that client-supplied array. Goods ship
      for ₦1. **Same impact, different door.**
      010 drops the insert policy (orders now have *no* client write path at all) and
      adds an `orders_validate_totals()` trigger that re-prices every line from the
      catalogue on insert — a backstop that catches the *shape* of the bug, so a future
      route that forgets to price things fails loudly instead of silently underselling.
      ⚠️ Ships with `create-order/route.js` inserting via the service role — **run them
      together or checkout breaks.**
      *Lesson recorded: the real invariant is "orders are server-authored". Both 009 and
      010 are that same rule; 009 only patched the door I happened to be looking at.*
- [x] 🚨 **Run `009_order_write_lockdown.sql`** — *applied 2026-07-17. Necessary but
      **not sufficient** — see 010 above. Verified:*
      `cancel_my_order` RPC live and refusing anonymous callers; policy drop confirmed
      by the owner via `pg_policies` (a dropped policy isn't observable through
      PostgREST, so this one needed a human to look).*
      Kept for the record — **this was live**: 001's
      `users update own pending orders` policy lets them PATCH their own pending
      order's `total_amount` (RLS gates rows, not columns; `with check` only pins
      `status`). `initialize` then charges that column, and `confirmPaystackPayment()`
      compares Paystack's amount to that same column — so both agree and the order is
      marked paid. Requires no tooling: just their own anon JWT against PostgREST.
      009 drops the policy (customers get no order-update path at all) and adds a
      narrow `cancel_my_order()` RPC. Ships with the initialize route writing
      `payment_reference` via the service role instead — **run them together**, or
      starting a payment breaks.
- [x] **Run `008_addresses.sql`** *(verified applied 2026-07-17: table live with all
      15 columns; anon insert refused with 42501, so RLS is enforcing.)*
- [x] **Run `012_full_text_search.sql`** — *applied 2026-07-17 and verified live:
      websearch + prefix autocomplete both return ranked hits (name match 0.99 vs
      description match 0.56 — the ranking `ilike` never had), cross-field works, and
      junk input (`!!! & | ' foo`) returns results rather than a 500.*
      *First attempt failed with `42P17 generation expression is not immutable`:
      `array_to_string(anyarray, text)` is STABLE (array output calls the element
      type's output function, which can be session-dependent). Fixed with a wrapper
      typed to `text[]`, where that reasoning doesn't apply, plus explicit
      `'english'::regconfig` casts (the 1-arg `to_tsvector(text)` is also only STABLE).*
- [ ] **Run `022_stock_notifications.sql`** + **point a cron at
      `POST /api/admin/stock-notifications/send`** (every 5–15 min; "back in stock"
      decays in hours, not seconds). Without the cron, requests queue as `ready` and
      nobody is ever told.
- [ ] **Set `LEGAL.whatsapp`** (digits only, e.g. `2348012345678`) — the footer's
      "Chat on WhatsApp" button stays hidden until you do.
- [ ] **Run `021_stock_reason.sql`** — until it runs, Adjust Stock errors (no
      `adjust_stock` function) and the edit form no longer sends stock, so **stock
      can't be changed at all**. Replaces `log_item_changes()` with the same function
      plus a reason; everything else about it is unchanged.
- [ ] 🚨 **Run `020_coupon_scope.sql`** — ⚠️ **breaking: coupons stop working until it
      runs.** It replaces `validate_coupon(text, uuid, numeric)` with
      `(text, uuid, jsonb)` and both callers already send the new shape, so the old
      function no longer matches. (The old one is dropped, not kept — two overloads
      make `rpc('validate_coupon')` ambiguous, PGRST203.) Also **fixes a live bug**:
      the function was never granted to `anon`, so guests using a coupon at checkout
      got "Could not apply that code".
- [ ] **Run `019_rate_limits.sql`** — rate limiting **fails open** until it runs, so
      nothing breaks; the public write endpoints (contact, newsletter, coupon, order)
      simply aren't limited yet.
- [ ] **Run `017_reports.sql`** — `/admin/reports` shows its error state until then.
      Also normalises `settings.vat_rate` from a decimal (`0.075`) to a percent
      (`7.5`) so it matches `items.vat_rate`; the settings field and product form
      ship with it. **If you had set a VAT rate in Settings, check it after running** —
      it should now read 7.5, not 0.075.
- [ ] **Run `016_refunds.sql`** — until it runs, `/admin/refunds` shows its error
      state and customers can't request one. **Note the webhook dependency:** refunds
      settle asynchronously, so `refund.processed` is what flips an order to
      `refunded`. Without the webhook URL configured (see below), an approved refund
      really does reach Paystack and really does pay the customer — but the order sits
      in "Sent to Paystack" indefinitely.
- [ ] **Run `015_best_sellers.sql`** — the best-sellers rail simply doesn't render
      until then (the API returns `[]` rather than failing). **Then schedule a
      refresh** — the view is deliberately not rebuilt on the payment path, so it
      never updates on its own: either `select cron.schedule('best-sellers', '0 * * * *',
      'select public.refresh_best_sellers()')` if pg_cron is enabled, or point an
      external cron at `POST /api/admin/best-sellers/refresh`. Without one it stays
      frozen at whatever it held when the migration ran.
- [ ] **Run `014_shipping_zones.sql`** — until it runs, checkout keeps using the flat
      settings fee (the resolver falls back on purpose, so nothing breaks). Seeds a
      single "Nationwide" catch-all at your current flat rate, so **behaviour is
      identical until you add real zones** in Admin → Delivery.
- [x] **Run `013_shop_facets.sql`** *(applied 2026-07-17 and verified: 18 products,
      10 brands, price 2800–25000, and 9 of 12 attribute keys kept — `length`,
      `storage`, `count` correctly dropped as single-valued.)*
- [ ] **Run `011_guest_checkout.sql`** — guest checkout is live in code; until this
      runs, checking out signed-out fails (no `orders.email` column). Also fixes two
      latent bugs that bite the moment guests exist: `coupon_redemptions.user_id`
      NOT NULL (a guest + coupon would break `mark_order_paid()` *after* Paystack took
      the money) and the guest idempotency gap (NULLs are distinct in unique indexes,
      so 006's index doesn't cover guests). **Run 010 first.**
- [ ] **Confirm `007_reviews_integrity.sql` ran in FULL** — introspection shows its
      three columns (`author_name`, `is_verified_purchase`, `updated_at`) already on
      `reviews`, but the columns are the *harmless* half. The half that matters is
      the `reviews_guard()` trigger, which is what actually closes the
      self-approval hole — and a trigger can't be checked from outside the DB.
      If in doubt just re-run the file: it is idempotent.
      Verify in the SQL editor with:
      `select tgname from pg_trigger where tgrelid = 'public.reviews'::regclass;`
      → expect `reviews_guard_trigger` **and** `reviews_refresh_rating`.
- [x] Promote first admin *(verified: 1 admin profile exists)*
- [x] Set `PAYSTACK_SECRET_KEY` in `.env.local` *(verified: `sk_test_…` present)*
- [ ] **Fill the placeholders in `lib/legal.js`** — `/privacy` and `/terms` currently
      render literal `[Registered business name]`, `[RC number]`,
      `[Registered business address]`, `[X] days` return window and
      `[X–Y working days]` delivery. Then get both pages reviewed by someone
      qualified in Nigerian consumer/data-protection law. Paystack compliance needs
      these live and truthful.
- [ ] Set webhook URL in Paystack dashboard → `https://DOMAIN/api/payment/paystack/webhook`
      ⚠️ Paystack cannot reach `localhost` — needs a deploy or a tunnel (cloudflared/ngrok).
      Until then the browser-return `/checkout/verify` path still completes payments in dev;
      the webhook is the reliability net for closed tabs. **Required before real money.**
- [ ] Swap `sk_test_` → `sk_live_` and set `NEXT_PUBLIC_APP_URL` to the real domain at launch
- [ ] Supabase Auth: set Site URL + redirect URLs (`/auth/callback`, `/reset-password`);
      configure SMTP before launch (built-in mailer is ~2/hr and lands in spam)
- [ ] **Set `RESEND_API_KEY` + `EMAIL_FROM`** (see `.env.example`) — order emails are
      built and wired but no-op with a console line until both exist. `EMAIL_FROM` must
      be a verified sender on a domain you own.
- [ ] Optional: Google/Facebook OAuth provider config (code is already wired)
- [ ] Cleanup: delete root `images/` folder and `public/images/hero-banner-original.png`

---

## P0 — Defects & dead ends (small, verified — do in days)

- [x] 🐛 `/account/profile` is a live 404 — **done 2026-07-16**: personal details
      (name/phone → profiles), change password (verifies current password first),
      change email (confirmation-link flow).
      *Follow-up same day:* added `components/account-nav.jsx` and moved the
      heading/container into `app/account/layout.jsx` — Orders/Profile now share one
      shell and are navigable (previously reachable only via the header dropdown).
      Addresses/Wishlist render as disabled "Soon" instead of linking to 404s.
- [x] 🐛 Promotions never render on the storefront — **done 2026-07-16**: public
      `GET /api/shop/promotions?placement=` (RLS enforces live-only), `usePromotion`
      hook, `PromoBanner` component. `home_hero` overrides hero copy/image/CTA with
      fallback to default; `home_banner` + `shop_banner` strips render when live.
      *(`popup` placement selectable in admin but not rendered — deliberate; needs
      dismiss/frequency rules. Tracked in P2 below.)*
- [x] 🐛 Settings not wired into pricing — **done 2026-07-16**: `lib/settings.js`
      (cached 60s reader w/ safe defaults + `invalidateSettingsCache()` on admin save),
      `calcTotals(items, {discount, shippingFlat, freeShippingOver})`, create-order uses
      `getPricingConfig()` server-side, public `GET /api/shop/settings` +
      `useStoreSettings()` for display. Admin notice corrected.
      *Note: `vat_rate` setting remains a default-for-new-products only — each item
      carries its own VAT (deliberate, matches the POS model).*
- [x] 🐛 Free-shipping threshold unused — **done 2026-07-16**: "Add ₦X more for free
      delivery" progress bar + "Free" shipping label in cart/checkout/review.
      Threshold is judged on the post-discount goods total so a coupon can't unlock
      free delivery the order didn't earn.
- [x] 🐛 Footer newsletter form discards the email — **done 2026-07-16**: migration
      `005` (`subscribers`, unique on `lower(email)`, `subscribe_email()` upsert RPC),
      `POST /api/newsletter`, footer wired w/ loading + honeypot. Re-subscribing
      reactivates instead of erroring, and the response never reveals whether an
      address was already on the list (would leak your customers).
- [x] 🐛 Contact form goes nowhere — **done 2026-07-16**: migration `005`
      (`contact_messages` + status workflow), `POST /api/contact`, form rebuilt with
      **controlled inputs** (they were uncontrolled — `handleSubmit` never even read
      the DOM, so the message was unreachable), validation, error alert, honeypot.
      *Still to do: the admin inbox to read them — see P2 below.*
- [x] 🐛 Dark mode unreachable — **done.** `ThemeProvider` mounted in
      `app/providers.js` (`attribute="class"`, `defaultTheme="system"`),
      `suppressHydrationWarning` on `<html>`, new `components/theme-toggle.jsx`
      (light/dark/system dropdown, `mounted` guard so there's no hydration flash)
      in the storefront header, and a cycling theme button in the admin sidebar
      footer. Also removed the drifting `STATUS_CONFIG` in
      `app/account/orders/page.jsx` — it hardcoded `dark:` colours and said
      "Awaiting Payment" where admin said "Awaiting payment"; now both read from
      `lib/order-status.js`.
- [x] 🐛 Success page is generic — **done.** Now fetches the real order by id
      (RLS-scoped, so the id in the URL can't read someone else's) and shows its
      actual status, date, items, discount/shipping/VAT/total and address, plus a
      fulfilment timeline driven by `FULFILMENT_FLOW`. Real states replace the
      lies: no `orderId` and "order not found" are honest errors instead of an
      endless "Loading order details…" spinner. **The fake "estimated delivery"
      is gone rather than reimplemented** — no setting or column backs a delivery
      promise, so it was invented. If we want it back, add a
      `delivery_estimate_days` setting and derive it from `created_at`.
- [x] 🐛 Billing "same as shipping" checkbox — **done: removed, not built.**
      Billing was dead end-to-end — no `orders` column, `create-order` never
      accepted it, and nothing ever read `billingInfo`; it was a write-only
      store slice behind a checkbox that revealed "Billing address fields appear
      here when unchecked". Paystack hosts the card form and collects what it
      needs there, so a billing address here would be data nobody reads. Removed
      the section, `billingInfo`/`updateBillingInfo`/`setSameAsShipping` from
      `stores/checkoutStore.js`, and the orphaned `Checkbox` import. Revisit only
      if a payment provider actually demands AVS.
- [x] 🐛 No `error.tsx` / `not-found.tsx` — **done.** Added `app/error.tsx`
      (storefront boundary, retry + digest reference), `app/not-found.tsx`
      (404 routing back to the catalogue, now prerendered as `/_not-found`),
      `app/admin/error.tsx` (staff would otherwise get app/error's "Browse the
      shop" exit; shows `error.message` since it's a staff-only surface), and
      `app/global-error.tsx` for root-layout failures — dependency-free with its
      own `<html>`/`<body>` and inline brand colours, because if the layout threw
      then Providers never mounted and any `components/` import could be the
      thing that just crashed.
      *`notFound()` is now wired up on `/shop/category/[id]` (unknown taxonomy id
      → real 404). The product page still doesn't 404 on a missing id. Route
      `loading.tsx` files beyond the existing 2 are still open.*
- [x] 🐛 create-order has no idempotency — **done (⚠️ needs migration 006 run).**
      `006_order_idempotency.sql` adds `orders.idempotency_key` + a partial unique
      index on `(user_id, idempotency_key)`. The API takes `idempotencyKey`, does a
      fast-path lookup, and — the part that actually makes it safe — catches the
      `23505` unique violation from a simultaneous request and returns the winner's
      order as a success. A pre-check alone can't work: two requests 20ms apart both
      check before either inserts, so only the constraint can pick a winner.
      The key lives in `checkoutStore` and is regenerated by `syncCartSignature()`
      only when the cart or coupon actually changes — signature-based, not
      mount-based, so leaving checkout and coming back with the same cart is still
      the same attempt rather than a twin order. `resetCheckout()` also issues a
      fresh key so the next purchase can't return the last one.
- [x] 🐛 Category page duplicates shop logic — **done.** Extracted the browsing
      engine (search/filters/sort/grid/pagination) into `components/product-browser.jsx`;
      `/shop` and `/shop/category/[id]` are now thin shells around it. ~750 lines
      of page code → ~150.
      **The duplication had already rotted into real bugs**, all gone with the copy:
      prices rendered as **dollars** (`${priceRange[0]}`) on a Naira store; a price
      slider hard-capped at **1000** when products cost thousands of ₦; a "Featured"
      sort option the API doesn't support (silently fell back to name); raw
      `fetch`/`useState` instead of the cached `useItems` query; pagination capped at
      5 pages with no ellipsis; no search at all; `FilterSidebar` declared *inside*
      render, remounting on every keystroke; and a dead `handleAddToCart` duplicating
      what ProductCard already does.
      Improvements while consolidating: real breadcrumb trail walked from the
      taxonomy tree (Home / Shop / Pet / Pet Kibbles), sub-category drill-down chips,
      and `notFound()` on an unknown id. `?category=` on `/shop` is preserved —
      nothing in-app links that way, but promo-banner `link_url` is admin-authored
      and `000_initial_schema.sql` suggests exactly that URL.
- [x] 🐛 Footer Privacy/Terms links go to `#` — **done (⚠️ placeholders must be
      filled before launch — see the manual steps at the top).** Added `/privacy`
      and `/terms` (both static-prerendered) plus `components/legal-page.jsx` as a
      shared shell so the two can't drift.
      The privacy policy was written **from the actual schema** — profiles, orders,
      reviews, wishlists, subscribers, contact_messages — not from boilerplate: a
      policy describing data we don't collect, or omitting data we do, is the whole
      failure mode. It's accurate that Paystack collects card details on its own
      pages and they never touch our systems, and that RLS is what stops one
      customer reading another's orders.
      Business facts nobody but the owner knows (legal entity, RC number, address,
      return window, delivery estimate) are **bracketed placeholders in
      `lib/legal.js`**, deliberately not guessed — a wrong registered entity or an
      invented refund window is worse than a visibly unfinished page.
      *Not done: these are not legal advice and need review by someone qualified in
      Nigerian consumer/data-protection law. Footer social links still point at `#`.*

## P1 — Standard e-commerce table stakes (1–2 weeks)

- [x] 🆕 **Order emails** — **built and wired (⚠️ inert until you add
      `RESEND_API_KEY` + `EMAIL_FROM` — see `.env.example`).**
      Confirmed (from the payment path), shipped (with tracking), delivered.
      - **Two rules baked in, both because of what these are attached to:**
        1. *Not configured is not an error.* No key → logs what it would have sent
           and returns. Throwing would mean a missing env var takes down **checkout**,
           since the receipt is sent from the payment path.
        2. *A failed email never fails the caller.* Every send is caught. A paid order
           must be marked paid whether or not Resend is reachable — a missing receipt
           is a support ticket; an unpaid-but-charged order is a refund.
      - **Send-once falls out of existing code, not a new flag:** both `/checkout/verify`
        and the webhook confirm the same payment, but `mark_order_paid()` returns true
        to exactly one of them. Gating on `marked === true` is the natural hook —
        without it every customer gets two receipts.
      - Shipped/delivered fire only on a real transition (`current.status !== data.status`),
        so editing a tracking number on an already-shipped order doesn't re-announce it.
        `processing` gets no email — "we're packing it" is noise.
      - Guest emails carry the tokenised `/order/[id]?token=` link; account holders get
        the account URL, so no token ever lands in an inbox that doesn't need one.
      - Templates are table-layout HTML with inline styles + a text/plain alternative.
        Email clients aren't browsers (Gmail strips `<style>`, Outlook renders via
        Word) — this is the rare place 2005 markup is correct.
      - Added `.env.example` (the repo had none).
- [x] 🆕 **Image upload pipeline** — **done. No migration, no manual step: the bucket
      is created and verified live.** (It was listed as blocked on "create a bucket" —
      but bucket creation is a Storage API call, not DDL, so the service role could do
      it. `product-images`: public read, 5MB cap, JPEG/PNG/WebP/AVIF only.)
      - **Storage needs no RLS policies, by design.** Uploads go through
        `POST /api/admin/uploads` with the service role behind `getStaffUser()` — the
        same rule as orders: the client asks, the server writes. Browser-direct
        uploads would have needed policies I can't create without SQL anyway.
      - `components/admin/image-upload.jsx`: drag-drop + click, **and keeps the URL
        input** — existing products have external `image_url`s and pasting a URL must
        keep working, or this "upgrade" breaks every product that predates the bucket.
      - `components/admin/product-gallery.jsx`: the `item_images` manager. The table
        and the storefront gallery have existed since 000 with **no way for an admin to
        put a row in it**. Multi-upload (sequential, not `Promise.all` — a batch of 10
        shouldn't open 10 parallel uploads on a Nigerian mobile connection), reorder,
        remove. Gallery rows need an item_id, so on a new product it says "save first"
        rather than showing a dropzone that can't work.
      - Client filenames are discarded entirely (collisions, `../`, leaking whatever
        was on someone's desktop); the extension is derived from the whitelisted MIME.
      - **Category image field added** — the API already accepted `image_url` and the
        storefront cards already wanted it; only the dialog was missing it. Promotions
        upgraded from URL-only.
      - `next.config.mjs`: added Supabase `remotePatterns` even though `unoptimized:
        true` makes it unnecessary today — dropping `unoptimized` (P3) would otherwise
        silently break every uploaded photo.
      *Verified live: service-role upload ok; public URL fetches 200 image/png; anon
      upload refused by RLS; SVG refused by the bucket's mime whitelist (SVG is script
      -bearing, so keeping it out matters).*
- [x] 🔧 **Reviews** — **done.** ⚠️ *"DB 100% ready" was wrong — see 007.*
      - **`007_reviews_integrity.sql` (security).** 000's policy was
        `for update using (auth.uid() = user_id) with check (auth.uid() = user_id)`
        with no column restriction, so **an author could PATCH their own row and set
        `is_approved = true`** — staff hide an abusive review, the author un-hides it.
        A moderation queue built on that would have been decorative. Closed with a
        `reviews_guard()` BEFORE trigger (SECURITY DEFINER) that forces `is_approved`
        for non-staff, pins `user_id`/`item_id`/`created_at` on update (a review
        can't be moved onto another product), snapshots `author_name`, and computes
        `is_verified_purchase` server-side from paid+ orders (a plain column would
        have let anyone badge themselves "Verified purchase", since the insert policy
        only checks `user_id`). `author_name` is a snapshot because `profiles` is
        readable only by its owner or staff — the storefront *cannot* join it.
      - **Storefront**: `components/product-reviews.jsx` — histogram, list, write/edit/
        delete own review, verified badge. `components/star-rating.jsx` — display +
        an input built as a **radiogroup** (one choice of five) so keyboard/AT users
        get arrow-key selection.
      - **`/admin/reviews`**: hide/restore/delete, filters, pagination. PATCH accepts
        **only `is_approved`** — staff moderate, they don't rewrite a customer's words
        under that customer's name. Uses the staff's own session, so RLS stays the
        enforcement layer.
      - **Home testimonials were fabricated** — three invented customers with invented
        quotes ("Adaeze O., Lagos — Poultry Farmer") under the heading "Real results
        from customers across Nigeria". Replaced with `useTopReviews()` (approved, 4★+,
        must have a comment). The section now **renders nothing until real reviews
        exist** — an empty section beats fake social proof.
      - Fixed a hardcoded off-brand `fill-yellow-400` star on the product page
        (everything else uses `earth`) and linked the rating to `#reviews`.
- [x] 🔧 **Wishlist** — **done.** The heart was fake (`onClick={(e) => e.preventDefault()}`
      under a "visual only for now" comment): it looked interactive and saved nothing.
      Now real, end-to-end, no migration needed — `wishlists` + RLS already existed.
      - `stores/wishlistStore.js`: `useWishlistIds()` (one cached Set shared by every
        card — a per-card query would fire N requests per grid), `useWishlist()` (full
        rows + product data), `useToggleWishlist()` (optimistic, rolls back on error so
        the UI never claims something is saved when the write failed; treats `23505` as
        success since "already saved" is the state the customer wanted).
      - `components/wishlist-button.jsx`: shared by ProductCard + product page so saved
        state can't disagree. Handles the card's `<Link>` wrapper (preventDefault +
        stopPropagation), `aria-pressed`, and redirects signed-out users to login with a
        `?redirect=` back. `revealOnHover` keeps unsaved hearts hidden until hover but
        **saved hearts always visible** — otherwise you couldn't see what you'd saved
        while scrolling, and it would vanish the instant you clicked it.
      - `/account/wishlist` (nav flipped to `ready: true`), header badge sharing the same
        query so it updates optimistically. Deactivated products render as "No longer
        available" rather than a working add-to-cart for something unpurchasable.
      - Product page had **no** heart at all; added one (most useful when out of stock —
        it's the only action left).
      *Verified against live DB: embed resolves (no PGRST201), anon insert blocked 42501.*
- [x] 🆕 **Account area** — **done (⚠️ needs migration 008 run).**
      `008_addresses.sql`: address book with **the single-default rule enforced by the
      database, not by hopeful client code** — a partial unique index on `(user_id)
      where is_default`, plus a trigger that demotes the previous default (without it
      the index would just reject the second default with 23505 and the customer could
      never change it), auto-defaults a customer's first address, and promotes another
      on delete so you can't end up with addresses but no default. RLS is private per
      user — **staff don't need it either**: the delivery address is snapshotted onto
      the order at checkout, so editing or deleting an address never rewrites an order
      already placed.
      Columns mirror the existing `shippingInfo` shape so the picker needs no
      translation layer. **No email column** — email is account-level, and create-order
      takes it from the signed-in user.
      `/account/addresses` CRUD (nav flipped to `ready: true`) + a checkout picker that
      prefills from the default once, keeps the form editable, and says plainly that
      edits there don't change the saved address.
      Also extracted `NIGERIAN_STATES` (was trapped inside the checkout page) into
      `lib/nigeria.js`, so the two forms can't offer different lists.
      *Remaining from this bullet: guest checkout is its own item below.*
- [x] 🆕 **Guest checkout** — **done (⚠️ needs migration 011 run).**
      `011_guest_checkout.sql`: `user_id` nullable, `email` as contact of record, and
      an unguessable `guest_token` that acts as the order's **capability**.
      **Note what 011 did NOT need: an insert policy for anon.** 010 made orders
      server-authored, so guests get order creation by the same server-priced,
      trigger-validated path. Had guest checkout come first it would have needed
      "anon can insert orders" — which is the ₦1 hole again, wearing a different hat.
      - **Claiming is on email CONFIRMATION, never signup.** Claiming at signup would
        be account takeover: register `victim@example.com`, never confirm it, inherit
        their order history. The trigger fires on `email_confirmed_at` going non-null
        (and on INSERT, since OAuth users arrive already confirmed — the provider did
        the verifying). It also nulls the token: an emailed link must not outlive the
        claim.
      - RLS needs no new read policy and gets none: a guest order has `user_id` null,
        so `auth.uid() = user_id` is `null = null` → never true. **Nobody can select
        one.** `get_guest_order(id, token)` is the single narrow door, and it never
        returns the token itself.
      - **Two latent bugs found and fixed before they could bite:**
        1. `coupon_redemptions.user_id` is **NOT NULL**, and `mark_order_paid()`
           inserts `v_order.user_id`. A guest paying with a coupon would have raised
           *inside* mark_order_paid — Paystack takes the money, order never goes
           `paid`. Now nullable.
        2. 006's idempotency index is `unique (user_id, idempotency_key)`. **NULLs are
           distinct in Postgres unique indexes**, so for guests every row compares
           unequal and a double-click inserts twice — the protection would have
           silently not applied to exactly the customers who can't see their order
           history to notice. Added a partial unique index on `idempotency_key` where
           `user_id is null`.
      - Paying is a full round-trip to Paystack, which wipes the non-persisted
        `checkoutStore` — so the guest's token rides in the `callback_url` and is
        carried through `/checkout/verify` to the receipt. Otherwise they'd land on
        their own receipt unable to read it.
      - `/order/[id]?token=` is the durable tracking link (what the confirmation email
        will use). Wrong token and nonexistent order give the **same** answer — the
        page is public and must not confirm which orders exist.
      - Checkout offers sign-in, never enforces it.
- [x] 🆕 **URL-driven shop filters** — **done.** search/department/category/sortBy/
      sortOrder/page now live in `searchParams`; the Zustand filters slice is gone
      (`useShopStore` deleted — nothing else used it; `useItems(filters)` now takes
      filters as an argument). Filtered views are shareable and bookmarkable, and the
      back button steps through filtering.
      Fell out of it for free: **the global-singleton problem disappeared.** A locked
      category browser no longer has to claim the store on mount and reset it on
      unmount to stop `/shop` inheriting a category filter — URL state is per-page by
      construction. The `initialSearch`/`initialCategory` prop-drilling went too:
      `?search=` (header) and `?category=` (promo banner `link_url`) now work by simply
      being read.
      Details that matter: `replace` not `push`, so 12 filter tweaks aren't 12
      back-presses; defaults omitted from the URL so shared links stay canonical; any
      filter change drops `page` (page 7 of the old result set is meaningless and
      usually empty); `?sortBy=` is validated against a whitelist client-side too, so
      a hand-typed URL can't render a broken page; and **paging scrolls to top while
      filtering doesn't** — page 3 renders where page 2 was, so without it the shopper
      is left staring at row 4 of a grid that silently changed.
      Both pages needed a `Suspense` boundary (useSearchParams).
      *Not done: SEO still needs SSR/`generateMetadata` — see the P2 SEO pass.*
- [x] 🆕 **Print invoice / packing slip** — **done** (built with the order-actions work;
      `/admin/orders/[id]/print`, invoice + packing slip, print CSS). *Checkbox was
      stale.*
- [x] 🆕 Customer order actions — **done** *(009 verified applied 2026-07-17:
      `cancel_my_order` live and refusing anonymous callers).*
      🚨 **Building cancel surfaced a live payment vulnerability — see the 009 blocker
      at the top.** Cancel needed a customer write path on `orders`, which meant
      reading 001's update policy, which turned out to allow rewriting `total_amount`.
      The defensive comments ("the amount comes from the database, never the request
      body"; "amount must match the order total exactly") were both true and both
      worthless, because *the database value was the attacker's input*. Two
      independent-looking checks read the same poisoned column.
      - `cancel_my_order()` RPC: SECURITY DEFINER, `for update` lock (a cancel racing
        the payment webhook must not both win), pending-only, ownership checked,
        touches one column. It's a function because "may set status to exactly
        'canceled', on their own order, only while pending, changing nothing else"
        **cannot be expressed as an RLS policy** — that's the same limitation that
        caused the bug.
      - Reorder: carries **ids + quantities only, never the old prices**. order_items
        is a snapshot of what was paid then; replaying it would quote a price the shop
        no longer offers. `useCartSync()` fills in today's price and says what changed.
        Delisted/sold-out lines are skipped and named, rather than added and failed at
        checkout.
      - **Track-order page** `/account/orders/[id]` (⚠️ *replaces the dialog* — a row
        now links to a real page: an order is something people bookmark, send to
        support and print, none of which a dialog can do). Timeline + status
        description + tracking number with copy button.
        `components/fulfilment-timeline.jsx` extracted from the success page so both
        tell the same story; it now marks the **current** step (the thing the customer
        opened the page to find) and, for canceled/refunded, states what happened
        instead of drawing a progress track that implies the order is still coming.
      - **Printable receipt** — `window.print()` + a `@media print` block in
        `globals.css`. Per-element choices use Tailwind's `print:` variant; the block
        handles what a page can't opt out of: site chrome, and **forcing light tokens
        so printing from dark mode doesn't dump a full sheet of ink**. Print-only
        letterhead from `lib/legal.js`, since a receipt must say who issued it.
      Removed ~175 lines of now-dead dialog from the list page, and trimmed its query
      to the 5 columns the table actually renders.
- [x] 🆕 Stock-aware cart — **done.** No migration needed.
      The cart is a localStorage **snapshot** that survives for weeks — holding the
      price, name and stock from whenever the item was added. The server always
      recomputed prices at order time, so a stale cart could never produce a stale
      *charge*; the bug was that the shopper was **shown a total they wouldn't be
      billed**, and only found out at the last step.
      - `useCartSync()` (`stores/cartSync.js`) refetches the cart's ids on cart open
        (`staleTime: 0`) and `reconcile()`s the snapshot: prices refreshed, quantities
        clamped to stock, sold-out/withdrawn lines flagged.
      - **Nothing is auto-removed** — a cart that quietly empties itself looks broken
        and hides why. Unavailable lines stay visible, greyed, excluded from totals,
        and block checkout with the reason on the line.
      - `CartChangesNotice` says per line what moved ("X went up from ₦a to ₦b",
        "only 2 left — reduced from 5"). Silently correcting the total would read as
        the shop being shifty.
      - `+` disables at stock, and `addItem` clamps on **merge** (adding 3 to a cart
        holding 2 must not pass a stock of 4 — stock is per product, not per click).
      - `/checkout` is reachable directly, so it bounces back to the cart if any line
        is unavailable rather than letting create-order reject the whole order.
      **Key detail:** `items readable by all` means inactive products still come back
      from the query — so "switched off" is checked explicitly and "deleted" is
      inferred from a missing row. They're different messages to the customer.
- [x] 🆕 kg items: fractional quantity input — **done.** No migration; the server
      already accepted fractional kg (create-order rounds to 3dp and only enforces
      whole numbers for per-piece items). **The UI was the whole limitation** — the
      shop couldn't sell 2.5 kg of feed despite the schema and POS supporting it.
      - `lib/units.js` — one home for step (0.5 kg / 1 piece), min, snapping and
        display, so the product page, cart and store can't disagree about what "2.5"
        means. Mirrors create-order's 3dp rounding.
      - `components/quantity-input.jsx` — shared stepper. kg is **typable** (nobody
        presses + fourteen times for 7 kg) with a local draft buffer, since
        committing per keystroke makes typing a decimal point impossible. Pieces stay
        read-only whole numbers.
      - **Bug found and fixed while doing it:** `updateQuantity` removed the line when
        `quantity < 1` — so setting 0.5 kg would have *deleted* the item.
      - **Second bug, caught by testing the math rather than assuming it:** snapping
        rounds to nearest, so 0.1 kg → 0; the store's clamp had no min floor and would
        have left a quantity-0 line in the cart. Now floors before capping.
      *Verified `lib/units.js` directly (float drift 0.1+0.2, repeated += 0.5 over 10
      steps, snapping, junk input, display): all pass.*

## P2 — Growth features (2–4 weeks)

- [x] 🔧 Full-text search — **done (⚠️ needs migration 012 — search is broken until
      it runs; see blockers).**
      **What it replaced:** `name.ilike.*term*,description.ilike.*term*` — a sequential
      scan with leading wildcards (no index can serve it), no ranking (a name match and
      a passing mention in paragraph four scored the same), no cross-field matching
      ("bovans layer" found nothing, because brand and name are different columns), and
      no stemming ("feeds" missed "feed").
      - `items.fts` is a **generated** column, not a trigger: Postgres maintains it on
        every write, so no code path can forget to reindex a product. Weighted
        A=name, B=brand/sku, C=tags, D=descriptions, GIN-indexed.
      - **`search_items()` builds the tsquery in SQL, on purpose.** Autocomplete needs
        prefix matching (`lay:*`), which means constructing tsquery syntax — and doing
        that in JS means hand-escaping user input into a query language, where one
        stray `&`/`!`/`'` either errors or is injectable. In SQL the input stays a
        parameter. It also swallows unparseable queries into "no results" rather than a
        500: a search box must never break the shop.
      - `GET /api/shop/search-suggest` returns products **and categories** — "Poultry
        Feeds" is often what the shopper means, and jumping them to the category beats
        listing four of its products. Half a failure returns the other half.
      - `components/search-autocomplete.jsx`: a real **combobox** (`role`,
        `aria-expanded`, `aria-activedescendant`, arrow keys across the
        product/category boundary, Escape). 250ms debounce (~8 requests otherwise for
        "layer mash"); highlight starts at −1 so **Enter runs the typed search** rather
        than silently picking whatever's first; hover and keyboard share one highlight;
        previous results stay on screen while fetching to stop the panel flickering.
      - The mobile drawer had to become a controlled `Sheet` — otherwise it stayed open
        on top of the page you'd just navigated to.
- [x] 🔧 Faceted filtering on shop — **done (⚠️ needs migration 013).**
      Price slider, brand, in-stock, and per-`attributes` facets, all URL-driven like
      the rest of the shop state.
      **Two rules came out of reading the live data first (18 products, 10 brands,
      12 attribute keys) rather than designing from the schema:**
      1. **Facets are scoped to the current result set.** `attributes` is
         heterogeneous — `bag_size` on feed, `life_stage` on pet food, `material` on
         accessories. A global facet list would offer "Bag size" while browsing Pet
         Accessories, matching nothing.
      2. **A one-option facet is not a filter.** The real data has `length: 1.5m`,
         `storage: Frozen`, `count: 3` — single-valued. Showing them is a control that
         cannot change the result. `shop_facets()` only returns keys with 2+ distinct
         values in scope; same test for brands.
      - **One RPC, not several selects:** facet counts must be computed over the same
        scope as the grid or the numbers lie, and multiple round-trips each re-deriving
        the scope can disagree with each other.
      - Counts describe "what's available here", so the facets query deliberately
        ignores the facet *selections* — narrowing by brand must not make the other
        brands vanish from the panel you're using.
      - Attribute keys are whitelisted (`\w{1,40}`, max 6) before touching the jsonb
        path; brand repeats as OR; attribute values replace (`->>key = X AND = Y` can
        never match).
      - In-stock means **buyable** (`allow_backorder OR stock IS NULL OR stock > 0`),
        not `stock > 0` — otherwise backorder products vanish from the one filter that
        claims to show what you can buy.
      - Facet chips in the results area, since on mobile the panel is behind a sheet
        and "why am I seeing 3 products?" shouldn't need a modal to answer. Sort moved
        *out* of the mobile sheet — it's the most-used control.
      - `useItems`' serialiser needed fixing: it did `value.toString()` on everything,
        which would have sent `attrs` as `[object Object]`.
- [x] 🆕 `shipping_zones` — **done (⚠️ needs migration 014).**
      Flat ₦1,500 nationwide wasn't a simplification, it was a loss: Lagos intra-city
      and a 25kg feed run to Sokoto don't cost the same, so the shop was either
      overcharging Lagos or eating the difference everywhere else.
      - A zone owns `states[]` + fee. **An empty `states[]` is the catch-all**, which
        is what makes this adoptable gradually: price Lagos, leave the rest on the
        fallback, refine later.
      - `resolve_shipping()` prefers a zone **naming the state** over the catch-all
        regardless of sort order — otherwise adding a fallback would silently reprice
        Lagos. Case/space-insensitive so hand-entered "lagos" matches.
      - **Per-zone `free_over`**, because a global threshold can't express "free in
        Lagos over ₦50k, never free to Sokoto". `null` = never free here, and null is
        preserved rather than coerced to 0.
      - **The seed deliberately invents nothing**: one "Nationwide" catch-all at the
        existing flat fee, so behaviour is byte-identical until someone who knows real
        delivery costs adds zones. Made-up rates are rates customers get charged.
      - `create-order` resolves the fee from the **order's** state server-side; the
        browser's quote is display-only, so nobody ships to Sokoto at Lagos rates.
      - Falls back to `settings.shipping_flat_fee` if 014 hasn't run, the table is
        empty, or the lookup fails — shipping is on the order path and must always
        produce a number.
      - `/admin/shipping` (Admin → Delivery) warns when states have **no rate and no
        catch-all**, since that silently falls back to the old flat fee — exactly the
        guessing this replaces.
      - **Cart quotes too**, from the signed-in customer's default address state —
        showing the nationwide rate and then changing the number at checkout is the
        thing shoppers actually resent. Both lines say what they're based on
        ("Estimated for Lagos" / "Confirmed at checkout"), because an unexplained fee
        that moves after you've decided to buy reads as bait-and-switch rather than a
        better estimate. Signed-out visitors keep the nationwide figure — `useAddresses`
        is gated on the session, so there's nothing to quote from.
- [x] 🆕 Best sellers + Recently viewed — **done (⚠️ needs migration 015).**
      **🐛 Found while doing it: the home page already had a "Bestsellers" eyebrow —
      over `is_featured` products.** Featured is an admin flag, not sales. Relabelled
      "Handpicked"; real best sellers now come from paid orders.
      - **Materialized**, because the source is jsonb: counting units means unnesting
        `order_items` across every paid order, which no index makes cheap and which
        would run on every home page load. It goes stale — correct trade for a
        merchandising signal; nobody is harmed by a few hours' lag.
      - **Refresh is NOT on the payment path.** Rebuilding an aggregate over every
        order to confirm one payment would put latency and a failure mode on the one
        flow that must never wobble. `refresh_best_sellers()` (CONCURRENTLY, so the
        rail stays readable) + staff-gated `POST /api/admin/best-sellers/refresh` for
        a cron. A failed concurrent refresh warns rather than raises — the next tick
        gets it.
      - **⚠️ MVs can't have RLS**, and `units_sold` per product is commercial
        information. The view is granted to `service_role` only; the storefront reads
        `get_best_sellers()`, which returns rank and no numbers.
      - Counts only `paid/processing/shipped/delivered` — `pending` is a hope, and
        counting `refunded` would promote products people sent back. Joins back to
        `items` so a delisted product can't linger on the home page.
      - **Recently viewed stores IDS ONLY** in localStorage, hydrated via `?ids=`.
        Storing names/prices would go stale exactly like the cart snapshot did and
        need the same reconcile dance — so don't create the problem. Per-device and
        works signed-out, which is honest for "what you were just looking at".
      - `?ids=` is uuid-validated and capped at 24; **an all-invalid list returns
        nothing, not everything** — silently dropping the filter would dump the
        catalogue.
      - `ProductRail` renders **nothing** when empty. "You haven't viewed anything
        yet" is a box that tells you what you already know, and an empty best-sellers
        rail on a new shop advertises that nobody has bought anything.
- [x] 🆕 Returns/refund flow — **done (⚠️ needs migration 016).**
      **🐛 The bug, stated plainly: `refunded` was a dropdown value.** Staff picked it,
      the order said "Refunded", the customer was told they'd been repaid, and the
      money stayed in the merchant account. Nothing called Paystack — the refund API
      was never wired at all.
      The admin API even contained the correct rule and then broke it: *"'paid' is
      deliberately absent: only the Paystack webhook / verify flow may mark an order
      paid ... letting an operator set 'paid' would bypass payment verification"* —
      while leaving `refunded` hand-settable. Same class of lie pointed the other way,
      and worse, because the customer is told money is coming back.
      - **`refunded` is now unreachable by hand** — removed from `SETTABLE` and from
        every `ALLOWED_FROM` list. The only writer is `apply_refund_result()`, called
        by the `refund.processed` webhook.
      - **Refunds are asynchronous**, so there are two states, not one: `approved`
        (we asked Paystack) and `processed` (Paystack confirmed the money moved). The
        order flips to `refunded` only at the second. Collapsing them would rebuild
        the original lie with extra steps — which is exactly what "mark it refunded
        when we click approve" would have been.
      - **`restock` defaults to FALSE.** `mark_order_paid()` already decremented, so
        restocking is a real decision — feed returned because it was mouldy must not
        go back on the shelf, and a wrong default silently corrupts inventory.
      - Partial refunds supported; amount validated against the order total server-side
        (a typo'd zero would otherwise refund more than was ever paid).
      - One-open-request-per-order unique index: a customer clicking twice would
        otherwise let staff approve two refunds for the same money.
      - `apply_refund_result()` is idempotent — Paystack retries webhooks, and
        restocking twice would invent inventory.
      - The customer UI never says "refunded" until it is: "Refund requested" →
        "Refund on its way — can take a few working days" → "Refunded".
      - Guests can request too (token-scoped, same pattern as 011).
      *⚠️ Depends on the Paystack webhook being reachable — see the webhook blocker.
      Without it, refunds reach Paystack and settle, but the order never flips to
      `refunded` (an approved request will sit in "Sent to Paystack" forever).*
- [x] 🆕 Admin reports — **done (⚠️ needs migration 017).** `/admin/reports`: date
      range + presets, revenue chart, top products/categories, CSV exports.
      **🐛 THE ONE THAT MATTERS — a VAT report built the obvious way would have
      under-reported tax to FIRS.** `lib/pricing.js` splits VAT two ways: *added* VAT
      (`vat_inclusive = false`) lands in `orders.tax_amount`, while *included* VAT is
      computed as `includedTax`, shown, and **thrown away — nothing stores it**.
      `items.vat_inclusive` defaults to TRUE, so a typical order stores
      `tax_amount = 0.00` and every naira of VAT is buried inside the line prices.
      Summing `tax_amount` — the obvious implementation — would have reported ≈₦0 VAT
      collected, and that's the number that gets filed. So included VAT is
      **recomputed from the `order_items` snapshot** (which carries
      `vat_enabled`/`vat_rate`/`vat_inclusive` per line), using the same arithmetic as
      pricing: `line × rate / (1 + rate)`. The UI shows the split explicitly rather
      than one number that invites the same misreading.
      **🐛 Second find: `settings.vat_rate` was a dead control in the wrong unit.**
      Stored `'0.075'` (decimal) while `items.vat_rate` is `7.5` (percent) — two units
      for one concept. It was invisible because *nothing read it*: the product form
      hardcoded 7.5, so an admin could change "Default VAT rate" and every new product
      ignored it. 017 normalises the value to percent (guarded so a re-run can't turn
      7.5 into 750), the settings field now validates 0–100, and the product form
      actually uses it — which is what the setting always claimed to do.
      Other decisions: `refunded` excluded (refunded VAT isn't VAT you owe); the daily
      series is **gap-filled** so a day with no sales plots as zero instead of vanishing
      (a chart that skips empty days makes a bad week look continuous); top products use
      the **name as sold** from the snapshot, so renaming a product doesn't retro-relabel
      last month's sales; uncategorised revenue is bucketed rather than dropped, so the
      panels reconcile with the summary; the RPCs are SECURITY DEFINER and each checks
      `is_staff()` **itself** — a definer function granted to `authenticated` without
      that check is a public revenue feed; CSV ships a UTF-8 BOM or Excel renders every
      ₦ as `â‚¦`.
- [~] 🆕 Bulk product ops — **multi-select + activate/deactivate/move/price±% + CSV
      export done. No migration.**
      Bulk edits are the easiest place in an admin to do a lot of damage in one click,
      so the care went there rather than into the UI:
      - **Price maths runs server-side, per row.** PostgREST can't express
        `price * 1.1` in a bulk update, so the route reads each price and computes the
        new one — the client never sends a price. Bounded to **-90%…+500%**: -100%
        makes everything free and a fat-fingered 5000 prices feed at ₦1.2m, and both
        are one keystroke away.
      - **The price dialog previews real before/after** on real products
        ("₦25,000 → ₦27,500"). An abstract "+10%" is easy to nod at; a wrong sign only
        becomes obvious next to an actual naira figure.
      - `log_item_changes()` (000) fires per row, so a bulk reprice leaves the same
        per-product history trail as a manual edit. That's the audit story, and it's why
        "no undo" is survivable.
      - **Move verifies the destination exists** rather than trusting an id from a form
        — a typo'd id would otherwise orphan every selected product.
      - **Selection clears on any filter/page change.** Carrying it across means acting
        on rows you can no longer see, which is how a bulk edit hits products nobody
        chose. "Select all" is labelled as this page's rows, because that's what it is.
      - CSV export includes the VAT columns (`vat_rate`, inclusive vs added) — the
        thing 017 showed people get wrong.
      *Not done: **CSV import**, deliberately. An import that writes prices and stock
      from a spreadsheet needs a dry-run diff ("12 products change, 3 unmatched SKUs,
      1 price drops 90%") and an explicit apply, or it's a silent catalogue-corrupter
      with a friendly file picker. That's its own piece of work, not a tail on this one.*
- [x] 🔧 **Admin inbox** for `contact_messages` — **done. No migration needed.**
      005 shipped the table, the RLS and the whole status workflow; **only the reading
      half was never built**, so the contact form was writing to a table with no reader
      and no nav entry. *(Verified live: 0 messages, 0 subscribers — the trap was real
      but hadn't sprung yet.)*
      - `/admin/messages` + an **unread badge in the sidebar** — the failure mode here
        is nobody noticing, so the count is the feature. Only rendered when > 0; a
        permanent "0" trains people to ignore the spot.
      - Opening a `new` message marks it read. Making staff click a second button to
        say "yes I read it" is how a queue stops reflecting reality.
      - Reply is a **mailto**, not an in-app composer: replies then come from the
        shop's real inbox, the thread lives where staff already work, and the customer
        can just hit reply.
      *Verified: anon can read neither `contact_messages` nor `subscribers` (RLS).*
- [x] 🔧 **Admin subscribers list + CSV + unsubscribe** — **done** *(018 verified live)*.
      **🐛 `is_active`/`unsubscribed_at` described a capability that didn't exist:**
      005's RLS lets only staff update `subscribers`, so a subscriber had no way to
      actually leave. Marketing with no working unsubscribe isn't just rude — it's how
      a sending domain gets blocklisted.
      - `018` adds an `unsubscribe_token`. **Not just `?email=`**: unsubscribe links get
        followed by mail clients and prefetchers, and an email-only link lets anyone
        unsubscribe anyone by typing an address. The token proves the request came from
        that inbox's mail.
      - The page **does not unsubscribe on load** — scanners follow links in email, and
        auto-unsubscribing would silently drop people who never clicked. One deliberate
        press.
      - `unsubscribe()` is silent about whether the token matched: a "not found" would
        make the endpoint an oracle for which addresses are on the list.
      - The confirmation says transactional email still comes through — "unsubscribed"
        must not imply you've also stopped getting your own receipts.
      - CSV export **excludes `unsubscribe_token`**: it's a capability, and a CSV is the
        easiest thing in the world to forward.
      *Not done: nothing sends newsletters yet, so nothing links to /unsubscribe. The
      route is ready for when a campaign feature exists (P3) — transactional emails
      correctly carry no unsubscribe link.*
- [x] 🆕 SEO pass — **done. No migration.**
      Product and category pages were `"use client"`, so **every product had the same
      generic `<title>` and no description or image in the HTML** — a crawler and a
      WhatsApp preview saw nothing. Split each into a server `page.jsx`
      (`generateMetadata` + JSON-LD) over a client child (`product-detail.jsx`,
      `category-browser.jsx`); the interactive half is unchanged.
      - **JSON-LD only asserts what's true.** `aggregateRating` is emitted *only* when
        `rating_count > 0` — a rating with reviewCount 0, or an invented 5, is what
        earns a structured-data penalty, and it'd be a lie in the same breath as the
        review system built to kill fake testimonials. `availability` comes from real
        stock (including `allow_backorder`), not optimism.
      - `metadataBase` added — without it every relative OG image resolves against
        localhost and link previews are blank in production.
      - Category metadata reads `meta_title`/`meta_description` **already in the schema
        since 000** with no form exposing them; the moment they're editable it works.
      - `robots.js` disallows `/admin`, `/account`, `/checkout`, `/cart`, `/api`,
        `/auth` — and **`/order/`, because guest order links carry a token** (011).
      - Root description/keywords fixed: it said "dog and cat essentials", which is
        half the business — the shop sells poultry feed to farmers.
      **🐛 Two bugs caught by verifying instead of trusting the build:**
      1. `app/sitemap.js` used `lib/supabase/server`, which reads cookies → forced the
         route dynamic ("couldn't be rendered statically because it used `cookies`") and
         **fell through my own catch to 6 static routes**, silently dropping every
         product. A sitemap has no session; it now uses a plain anon client.
      2. `categories.updated_at` **doesn't exist** (that table predates the
         `set_updated_at` trigger the others got). The query failed, and the same catch
         would have hidden it forever. Uses `created_at`, and the query now throws
         instead of being swallowed.
      *Verified live: 41 URLs — 6 static, 17 categories, 18 products, all with real
      lastModified. `/sitemap.xml` and `/robots.txt` both static (1h revalidate).*
- [~] 🆕 API hardening — **rate limiting + Zod on the public write endpoints done
      (⚠️ needs migration 019).**
      - **Rate limiting lives in the DB (019), not in memory.** An in-memory counter is
        per-instance and dies on every deploy — on serverless each cold start gets a
        fresh empty limiter, so the "limit" is whatever the platform's scaling decides.
        Fixed window (one upsert per request) rather than a sliding log (a row per
        request + a range scan) — burst-at-the-boundary isn't a threat worth paying for
        on a contact form.
      - **`check_rate_limit()` is service-role only.** The key is the caller's IP,
        derived server-side; if a client could call it directly it could burn through
        *someone else's* budget. A limiter you can use to lock other people out is
        worse than no limiter.
      - **Fails OPEN** on any error, and if 019 hasn't run. None of these endpoints are
        the security boundary — prices, ownership and payment are enforced elsewhere —
        so a broken counter table must not take the shop down.
      - Honeypots are checked **before** the limit, so bots don't eat a real visitor's
        budget on a shared office IP.
      - Budgets are per-endpoint and tuned to real behaviour: coupons are the tightest
        (20/5min) because codes are guessable by design — that's the one real
        brute-force surface.
      - **Zod now used** (it was installed and imported nowhere): contact, newsletter,
        validate-coupon. Replaces ladders of `String(x || '').trim()`; the max-lengths
        aren't decoration — without them contact accepted a 4MB "message".
      - `lib/api.js`: `ok`/`fail`/`parseBody`/`clientIp`. `error` stays a **string**
        because every caller already does `json.error || '…'` — changing the shape
        would silently degrade a dozen toasts to fallback text.
      **🐛 Two inconsistencies found while wiring it:**
      1. **validate-coupon refused guests** ("Please sign in to use a code") — but
         `create-order` accepts a guest's coupon with `p_user: null`, so the code
         *would* have worked at the next step. Guest checkout (011) broke this and
         nothing noticed. Now allowed; only the per-customer limit is skipped.
      2. My own admin inbox used subject labels (`delivery`, `wholesale`) the contact
         form never sends, while its real values (`bulk`, `return`) would have rendered
         as raw slugs.
      *Not done: **auth rate limiting** — login/signup go from the browser straight to
      Supabase, so our routes never see them; that's Supabase's own limiter (and its
      SMTP cap). Admin endpoints are unlimited: they're staff-gated, and the threat
      model is abuse by strangers.*
- [x] 🔧 Coupon scope — **done (⚠️ needs migration 020 — coupons break until it runs;
      the code and the migration change `validate_coupon`'s signature together).**
      **🐛 Fixed a live bug first: `validate_coupon` was granted to
      `authenticated, service_role` — not `anon`.** Guest checkout (011) let guests use
      coupons, and create-order calls the RPC with the *caller's* session — anon for a
      guest. So a guest entering a valid code got **"Could not apply that code"**:
      permission-denied, dressed up as an invalid coupon. 011 created it; nothing
      noticed because coupons+guests only became possible then.
      **The signature had to change.** `validate_coupon(code, user, SUBTOTAL)` gets one
      number — it cannot know that ₦8,000 of a ₦20,000 order is feed, so it cannot
      compute "10% off feed". It now takes the **lines** and prices them from the
      catalogue itself, which also deletes the subtotal arithmetic the two callers were
      each doing (same rule as orders: the server prices things, not the caller).
      - **Category scope expands to descendants** — "off Feed" that missed Poultry
        Feeds *beneath* Feed would match nothing, because that's where products live.
      - **Min spend is judged on the whole order; the discount only on the eligible
        part.** "Spend ₦20,000" means the order to a shopper; "10% off feed" doesn't
        mean 10% off the dog toys.
      - A **fixed** ₦ discount is capped at the eligible subtotal, or "₦2,000 off feed"
        quietly discounts everything else.
      - **`first_order_only` requires an account, and says so.** A guest has no history
        to check, so the code would be reusable forever from a fresh browser. This is
        the one place guest checkout genuinely can't work — better to state it than to
        leak a permanent discount.
      - `generate_coupon_codes()` mints bulk one-time codes **in SQL**: generating them
        app-side means a round-trip each and a collision race on `coupons.code`. The
        alphabet excludes 0/O and 1/I — these get read off paper and typed by hand.
- [~] 🆕 Admin categories: ~~category image field~~ *(done — the API already accepted
      `image_url` and the home page already rendered it; only the form was missing it,
      so departments could never have artwork)*. ~~Dialog → independent pages~~ *(done:
      `/admin/categories/new` + `/admin/categories/[id]/edit` via a shared
      `category-form.jsx`, matching the products CRUD. `category-dialog.jsx` deleted;
      delete stays a dialog — it's one irreversible yes/no, not a form. Dropped dead
      code from the old parent-picker: `isSelfOrDescendant` and `excludePath()` were
      computed and never used.)*
      ~~meta_title/meta_description~~ *(done — **the columns have existed since 000 and
      `generateMetadata` already read them**; the API payload just never carried them, so
      they could only ever be null. Now editable, with live char counts against the 70/160
      that search engines actually render, and each field states what it falls back to.)*
      ~~Reordering~~ *(done — **arrows, not drag-and-drop**. A collapsible nested tree needs
      before/after/inside drop-zones, which is a dependency plus real a11y work, and it's the
      one interaction that's hostile on a phone. Arrows are keyboard-native and work today.
      **Renumbers the sibling list rather than swapping two values** — every `sort_order` is
      0 by default, so a swap would be 0↔0 and the buttons would look broken. Only writes the
      rows that actually moved, and passes `regenerate_slug: false` so reordering can't
      re-slug a category and break its links.)*
      *Not done: drag-drop proper — arrows cover the need; revisit if the tree grows.*
- [x] 🔧 Product form: `attributes` + `tags` — **done. No migration.**
      **They weren't in the API's column whitelist**, so a form alone wouldn't have
      helped: every product created through the admin had `{}` and `[]` forever, and
      could never be filtered (013) or found by tag (012, weight C). Only the seed data
      ever had any — which is why the facets *looked* fine.
      - Keys are constrained to `\w` because they become jsonb paths in the facet
        filter (`attributes->>bag_size`) and labels on the page; values are stringified
        so `"10"` and `10` don't become two facets.
      - Empty values are dropped — an empty attribute is noise on the spec table and a
        dead facet.
      - The editor **suggests keys already in use**, because the whole feature rests on
        staff spelling a key the same way twice: "bag_size" on two products is a filter,
        "bag_size" + "bagsize" is two dead ones. The field says so.
      - Tags: comma/Enter to add, backspace-to-remove, deduped and lowercased.
- [x] 🔧 Stock adjustment reason — **done (⚠️ needs migration 021).**
      "Layer Mash: 40 → 12" was a permanent mystery — sold offline? mouldy?
      miscounted? stolen? Four different business problems, flattened into one row
      saying `adjustment`.
      - **It had to be an RPC.** The reason must be set in the *same transaction* as
        the UPDATE for the history trigger to see it (the trigger already does this
        for sales via `app.sale_order_id`), and two supabase-js calls are two
        transactions. `adjust_stock()` sets the config, updates, and clears it —
        transaction-local, so nothing leaks onto a pooled connection.
      - **Takes a DELTA, not a new total, and locks the row.** Two staff counting the
        same shelf: "set to 40" twice ends at 40; "+15" twice ends at +30 — and only
        the second is what actually happened.
      - Reasons are split by direction (you don't "restock" a bag you threw away) and
        coded, not free text — 40 rows saying "adjustment" can't tell you what spoilage
        cost you.
      - **Closed the loophole**: the edit form's stock field is read-only AND omitted
        from the payload entirely. Read-only alone wasn't enough — a form opened before
        someone used Adjust Stock would submit its stale total, silently reverting their
        adjustment and logging a reasonless change on top. Still editable on create;
        an opening balance has no history to explain.
      - Older rows have no reason and simply don't show that line, rather than claiming
        "Unknown".
- [x] 🆕 `popup` promotion placement — **done. No migration.**
      The placement has been selectable since 000 with **nothing rendering it**: an
      admin could create a popup, see it listed as live, and it would never appear.
      A popup is the easiest thing in this codebase to make hostile, so the decisions
      are all about restraint:
      - **Dismissal lasts 14 days**, per promotion id. A popup you closed that returns
        on the next click isn't marketing, it's harassment — and it's why people install
        blockers.
      - **Never on `/cart` or `/checkout`.** Interrupting someone who is already buying,
        to advertise at them, loses the sale you'd already won.
      - 6s delay (not on arrival), Escape closes, click-away closes, a real hit-area ✕,
        and an actual **"No thanks"** button — "close" as the only exit makes people
        hunt for the way out.
      - A corrupt/blocked localStorage is treated as **dismissed**, not as "show
        forever".

## P3 — Advanced / differentiating

- [x] 🆕 ~~**Product variants**~~ — **NOT BUILT. The premise was wrong** *(2026-07-17)*.
      Checked the live catalogue before writing any schema: **all 18 products are
      distinct base names — there is no "Layer Mash 5/10/25kg"**. The motivating
      example didn't exist. Asked the owner, who clarified:
      > "yes, they sell in kg, it can be 0.5, 8.7, 0.3 etc"
      **That's continuous weight selling, not discrete size variants** — already
      `unit_type='kg'` + a fractional quantity, which exists. A variant table would
      have taught the cart, `order_items`, facets, search, best-sellers, stock and
      wishlist about variant ids — an enormous blast radius — to model something the
      shop doesn't sell.
      **🐛 The clarification exposed a live bug I'd shipped.** `lib/units.js` snapped
      kg onto a **0.5 grid**: `snapToStep(8.7) → 8.5`, `0.3 → 0.5`. On a per-kg product
      that's the wrong weight **and the wrong price**, applied silently — a customer
      types 8.7, gets billed for 8.5, and nothing errors. I invented that step
      ("half-bags/scoops are how feed is actually bought") without checking, while the
      GNX POS model and create-order's own 3dp rounding were both saying kg is
      continuous.
      Fixed: `snapToStep` → `normalizeQuantity`. kg rounds to **3dp** (exactly matching
      the server) and floors at **100g**, never snaps. ± remains a 0.5 nudge — a
      convenience, not a constraint. Pieces still round to whole numbers, which
      create-order enforces.
      *Verified against `lib/units.js` directly: 0.5 / 8.7 / 0.3 / 12.25 / 2.333 all
      survive; 2.3337→2.334; junk and negatives floor to 0.1; pieces stay whole.*
      *Revisit only if the shop starts stocking genuinely discrete packs (a sealed 5kg
      AND a sealed 25kg as separate things to pick).*
      **Found while analysing — worth fixing next:**
      - Old Dogs/Cats seed data is still live beside the real Pet/Feed taxonomy,
        creating customer-visible near-duplicates: *Adult Dog Kibble 10kg* (Pet Kibbles)
        vs *Premium Dry Dog Food 10kg* (Dog Food); *Frozen Chicken Necks (per kg)* vs
        *Raw Chicken Necks (per kg)*.
      - **"Multivitamin Supplement 500ml" has no category** — it appears in no
        department, no category page, no facet.
      - Attribute keys split on one concept: `size=5kg` (Cat Food) vs `bag_size=10kg`
        (Pet Kibbles) — two dead facets instead of one. `size` also carries "Medium",
        "5kg" and "12 x 400g", which are three different kinds of thing.
- [ ] 🔧 **GNX POS import/sync** — `pos_external_id`/`pos_source` columns already on
      categories (and planned for items). Import screen mapping POS departments/
      categories/items; later two-way stock sync. *The most business-specific
      advanced feature; eliminates double data entry with the desktop POS.*
- [ ] 🆕 Abandoned-cart recovery emails.
- [ ] 🆕 Phone/OTP login (Supabase SMS provider) — strong fit for this market.
- [ ] 🆕 Bundles & bulk pricing ("3 bags for ₦X").
- [ ] 🆕 Customer segments (big spenders, dormant 60d+) + campaign email.
- [ ] 🆕 `audit_log` table (actor, entity, action, diff) — item_history covers products
      only; orders/settings/role changes are unlogged.
- [ ] 🆕 Analytics events table (page views → dashboard funnel, feeds best-sellers).
- [x] 🆕 Back-in-stock notify-me — **done (⚠️ needs migration 022 + a cron on
      `POST /api/admin/stock-notifications/send`).**
      **Channel-agnostic queue, email-only UI.** `notify_by` exists from day one so a
      WhatsApp sender is a new reader of the same queue, not a migration — but the UI
      only offers what can actually deliver. Offering "WhatsApp me" with no sender is
      the same lie as the fake testimonials and the refunds that refunded nothing.
      - **The queue is a trigger, not a poll.** Stock rises from `adjust_stock`, a
        refund restock, an admin edit, a future POS sync — marking rows ready in the
        one place that sees every stock write means no path can forget. Fires only on
        the **transition** into buyable, or every bag moved would re-notify everyone.
      - **Sending is out-of-band.** A mail provider having a bad afternoon must never
        be able to fail a stock update.
      - **Sold out again before the send?** The row goes back to `pending`, not `sent`
        — "it's back!" landing on an Out of Stock button is worse than silence, and the
        next restock should still catch them.
      - No `RESEND_API_KEY`? Rows stay `ready`. Marking them sent would silently
        delete the waiting list.
      - Oldest first: on a small restock that's a queue rather than a lottery.
      - Public write / staff read (like 005) — a read policy here is "list everyone
        waiting on this product, with their emails".
- [x] 🆕 WhatsApp click-to-chat — **done.** `wa.me` link in the footer, customer-
      initiated: no API, no Meta verification, no template approval, **no risk to the
      number**. Set `LEGAL.whatsapp` (digits only, e.g. `2348012345678`) and it appears.
      **🐛 Caught in review:** the guard was supposed to hide the button while the
      number is a placeholder — but the placeholder was `[2348012345678]`, which strips
      to 13 valid-looking digits and **shipped a live button pointing at a number that
      isn't the shop's**. Now empty by default, plus an explicit bracket check. The
      lesson: a placeholder that contains digits defeats a digit-shaped validator.
      *Decision recorded: **not** doing QR-pairing WhatsApp (whatsapp-web.js/Baileys).
      It automates a normal account against Meta's terms — bans are permanent and take
      the number, which is on the footer, /terms, /privacy and every invoice. It also
      needs a persistent process + headless Chrome, which cannot live in Next's
      request/response model. If outbound WhatsApp is wanted: Cloud API, utility
      templates for order updates, marketing opt-in for back-in-stock.*
- [ ] 🆕 Product Q&A, product compare (on `attributes`), WhatsApp share button.
- [ ] 🆕 PWA (manifest, installability) for repeat farm buyers.
- [~] 🆕 Admin grab-bag — **inventory view + restock CSV done (⚠️ needs migration 023).**
      `/admin/inventory` (Catalog → Inventory, admin-only): stock value at cost, retail
      value, potential margin, out/low counts, and a **reorder CSV** (out + low stock,
      worst first — the sheet you take to the supplier).
      **🔒 Building this surfaced a live info leak and fixed it first.** "valuation =
      stock × cost_price" meant staff would start entering `cost_price` — which the
      public API (`select('*')`) and PostgREST (`items` is readable-by-all) were handing
      to any anonymous visitor. A competitor could read every margin with the anon key.
      Fixed in `023` (column revoke from anon + authenticated) + explicit public selects
      + admin reads via service role. *Verified: leak real (anon reads cost_price today,
      null-only so nothing lost yet); public selects unaffected; inventory totals correct
      (18 products, ₦12.2M retail, 18/18 missing cost → understated-value banner fires).*
      **The honest-caveat pattern again:** when cost prices are missing the page says
      "stock value is understated (N products count as ₦0)" rather than presenting a
      margin it can't stand behind — same discipline as the VAT report.
      *Still to do from this line: media library, reviews-reply, customer notes/ban,
      resend-confirmation button.*

## Platform hygiene (ongoing, weave into the above)

- [ ] TypeScript: remove `ignoreBuildErrors`, migrate `lib/` + API routes first.
- [ ] Tests: Vitest on money paths (`calcTotals`, coupon calc, payload whitelists),
      Playwright checkout smoke; GitHub Actions build+typecheck gate.
- [ ] Performance: drop `images.unoptimized` once Storage images land; cache headers/
      `revalidate` on taxonomy + items.
- [ ] Observability: Sentry; replace console.error-only logging.
- [ ] Git: repo still isn't initialized — `git init` + first commit so this roadmap
      has history.

---

**Suggested next five (highest impact):** order emails · image upload · reviews ·
guest checkout · settings→pricing wiring.
