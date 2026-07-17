# PetDo — Design System (MASTER)

> **LOGIC:** When building a specific page, first check
> `design-system/petdo/pages/[page-name].md`. If that file exists, its rules
> **override** this Master file. If not, strictly follow the rules below.

**Source of truth.** These are the rules the app is *actually* built on —
verified against the code, not generated defaults.

**Project:** PetDo — e-commerce storefront + admin dashboard selling **poultry
feed, pet food, and farm/pet accessories** in Nigeria.
**Audience:** poultry/fish farmers (bulk feed) and urban pet owners.
**Vibe:** trustworthy, warm, professional — a specialist agri-and-pet-care
store. Not a generic SaaS or bootstrap template.

> ⚠️ The palette and typography below are **pinned by the client**. Do not
> substitute them — including when a tool or skill recommends something else.
> An earlier auto-generated version of this file proposed Claymorphism, an
> orange palette and Varela Round; all of that was rejected and is listed under
> Anti-patterns.

---

## Colors

HSL CSS variables in `app/globals.css`, consumed via Tailwind semantic tokens.
**Never hardcode hex in components** — use `bg-primary`, `text-muted-foreground`, etc.

| Role | Hex | Token | Use |
|------|-----|-------|-----|
| Primary — Deep Forest Green | `#1F6B45` | `--primary` | Brand, primary CTAs, active nav |
| Secondary — Warm Earth | `#C49A4A` | `--earth` | Discount badges, stars, cart count |
| Accent — Veterinary Blue | `#2F80ED` | `--info` | **Sparingly** — links, informational icons |
| Success | `#4CAF50` | `--success` | Confirmations, healthy stock, trend up |
| Destructive | — | `--destructive` | Errors, out-of-stock, trend down, delete |
| Background | `#FAFBF8` | `--background` | Page canvas |
| Surface 2 | `#F5F7F2` | `--surface-2` | Alternating sections, image placeholders |
| Card | `#FFFFFF` | `--card` | Cards, elevated surfaces |
| Text primary | `#1E293B` | `--foreground` | Body copy |
| Text secondary | `#64748B` | `--muted-foreground` | Supporting copy |

**Dark mode** is a full sibling, not an afterthought: deep green-tinted surfaces,
lighter primary (`145 48% 46%`). Both themes defined together in `globals.css`.

**Rules**
- Veterinary blue is an accent, **not** a second brand colour. Never a CTA.
- Never convey meaning by colour alone — pair with icon or text (WCAG).
- Body text ≥ 4.5:1 contrast in both themes.
- No manual `dark:` colour overrides in components.

---

## Typography

| Role | Font | Token |
|------|------|-------|
| Display / headings | **Manrope** | `--font-display` → `font-display` |
| Body | **Inter** | `--font-sans` → `font-sans` |

- `h1`–`h4` get `font-display font-bold tracking-tight` automatically (base layer).
- **`tabular-nums` on all money, stock and data columns** — stops digits jittering.
- Storefront headings: large, editorial. Admin headings: `text-xl`, dense.

---

## Shape, elevation, motion

- **Radius:** `--radius: 1rem` (16px cards); scale `sm/md/lg/xl`.
- **Shadows:** `shadow-card` → `shadow-card-hover`. Use the scale, no ad-hoc values.
- **Motion:** 150–300ms, `transform`/`opacity` only, 1–2 elements per view,
  respect `prefers-reduced-motion`. No decorative-only animation.
- **Icons:** Lucide only. Never emoji as structural icons.

---

## Storefront signature — "feed sack"

Boldness is spent in **one** place: a feed-sack / rubber-stamp language drawn
from the subject's real artifacts. Utilities in `globals.css`:

| Utility | What it is |
|---------|-----------|
| `.eyebrow` | Stencilled uppercase label with an earth dot — on every section header |
| `.grain` | Grain-scatter dot texture for warm panels |
| `.stamp` | Rotated dashed "Quality Assured" rubber seal |
| `.card-lift` | Card hover elevation |

**Hero imagery** is a cut-out (transparent PNG) floating on the grain panel —
no frame, `object-contain` so it's never cropped, `drop-shadow` so the shadow
follows the cut-out's real edges, and a soft radial glow behind it for depth.
Do not re-introduce a bordered/filled frame: it fights the transparency.

**Primary nav device:** "Shop by animal" (Poultry / Dogs / Cats / Fish) — for
this audience the first question is *what are you feeding?*, not a generic grid.

Everything around the signature stays quiet and disciplined.

---

## Admin dashboard

Different density, **same brand** — a differently-coloured admin reads as a
different app.

- **Density 8/10:** `gap-4`, `p-4 md:p-5`, tight card padding.
- Canvas `bg-muted/30` so white cards read as elevated.
- **KPI cards must show trend**, not just a number: % delta vs previous period
  with ↑/↓ icon **and** text. Show "No prior data" — never a fake `+100%`.
- Charts: Recharts via shadcn `ChartContainer`. Trend over time → area/line;
  subtle gridlines, abbreviated axes (`₦120k`), full date in tooltip.
- Every list needs: skeleton, distinct "no data" vs "no matches" empty states,
  and an error state with a recovery path.

---

## Components

shadcn/ui (new-york, radix base) — see `components.json`. Compose, don't reinvent.

- Forms: `FieldGroup` + `Field` (+ `FieldSet`/`FieldLegend`). Never raw `div` + `space-y`.
- Spacing: `gap-*`, never `space-x/y-*`. Equal dims: `size-*`, not `w-4 h-4`.
- Icons in buttons: `data-icon="inline-start|inline-end"`, no size classes.
- `Empty` for empty states, `Alert` for callouts, `Skeleton`/`Spinner` for loading.
- Dialog/Sheet/Drawer always need a Title (`sr-only` if hidden).
- **Long forms get their own page**, not a dialog (see product editor).
- CRUD is independent pages: `/list`, `/new`, `/[id]`, `/[id]/edit`.

**Components of record**
- `components/product-card.jsx` — the only product card, used everywhere.
- `components/brand-image.jsx` — all imagery; `#F5F7F2` placeholder fallback.
- `components/auth-shell.jsx` — split-screen auth layout.
- `components/admin/admin-nav.js` — admin nav registry (new module = one entry).
- `lib/pricing.js` — **all** money maths/formatting (NGN).
- `lib/order-status.js` — order status labels/colours/copy.

---

## Money & units (business rules that drive UI)

- Currency is **NGN** everywhere. Format via `formatNaira()` — never hand-roll.
- Products sell **per piece or per kg**; kg items show `₦x / kg` and allow
  fractional quantities.
- **VAT is per item** (`vat_enabled`, `vat_rate`, `vat_inclusive`), matching the
  GNX POS. Inclusive → show "VAT included", add nothing at checkout. Exclusive →
  add at checkout. This has caused a real bug — always spell it out in the UI.
- Payment status is owned by the Paystack webhook. Staff can never set it by hand.

---

## Anti-patterns (do not do)

- ❌ Substituting the pinned palette/fonts because a tool suggests otherwise
- ❌ Blue or amber as primary — a generic dashboard default
- ❌ Claymorphism, heavy gradients, purple *(rejected earlier draft)*
- ❌ Orange `#F97316` / Varela Round / Nunito Sans *(rejected earlier draft)*
- ❌ Hardcoded hex or manual `dark:` overrides in components
- ❌ Emoji as icons
- ❌ Recolouring the storefront pattern for admin, or vice versa
- ❌ Marketing-page spacing inside the dashboard
- ❌ Colour as the only signal for status/trend

---

## Imagery

Real, warm, natural-light, product-style photography: feed bags, chickens, dogs,
cats, fish, farmers and pet owners. Stored in `public/images/petshop-naija/`.
Missing files degrade to a branded placeholder via `BrandImage` — never a broken
image, never random stock.

---

## Pre-delivery checklist

- [ ] Semantic tokens only — no hardcoded colour
- [ ] Contrast ≥ 4.5:1, verified in **both** themes
- [ ] Status/trend uses icon + text, not colour alone
- [ ] `tabular-nums` on all money/stock/data columns
- [ ] Loading (skeleton), empty, and error states all designed
- [ ] Responsive at 375 / 768 / 1024 / 1440
- [ ] Visible focus rings; icon-only buttons have `sr-only` labels
- [ ] Reduced motion respected
