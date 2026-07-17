# Graph Report - .  (2026-07-16)

## Corpus Check
- 121 files · ~424,511 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 780 nodes · 1392 edges · 97 communities (40 shown, 57 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.76)
- Token cost: 48,063 input · 0 output

## Community Hubs (Navigation)
- Storefront Pages
- Authentication Pages
- Carousel Component
- Toast Notifications
- Shop & Category Browsing
- My Orders & Command Palette
- Sidebar Component
- TypeScript Configuration
- API Route Handlers
- App Layout & Header
- Build Tooling & DevDeps
- Form Field Components
- Database Schema (SQL)
- Popover & Radio Controls
- shadcn/ui Config
- Button, Calendar, Pagination
- NPM Dependencies
- Item Layout Component
- PetDo Design System
- Menubar Component
- Security & Payment Fix Plan
- Context Menu Component
- alert-dialog.tsx
- input-group.tsx
- breadcrumb.tsx
- drawer.tsx
- empty.tsx
- navigation-menu.tsx
- GRAPH_REPORT.md
- toggle.tsx
- 002_category_tree.sql
- 001_stock_and_orders.sql
- button-group.tsx
- input-otp.tsx
- Cart Badge Total Quantity (H7)
- middleware.ts
- sonner.tsx
- next.config.mjs
- autoprefixer
- class-variance-authority
- cmdk
- date-fns
- Design Anti-Patterns (forbidden)
- Cart Clear-After-Payment Timing (H3)
- Checkout Auth Redirect Race (H2)
- Secret Management via .env.local (C2)
- input-otp
- lucide-react
- next
- next-themes
- @radix-ui/react-alert-dialog
- @radix-ui/react-aspect-ratio
- @radix-ui/react-avatar
- @radix-ui/react-checkbox
- @radix-ui/react-collapsible
- @radix-ui/react-context-menu
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-hover-card
- @radix-ui/react-label
- @radix-ui/react-menubar
- @radix-ui/react-navigation-menu
- @radix-ui/react-popover
- @radix-ui/react-progress
- @radix-ui/react-radio-group
- @radix-ui/react-scroll-area
- @radix-ui/react-select
- @radix-ui/react-separator
- @radix-ui/react-slider
- @radix-ui/react-slot
- @radix-ui/react-tabs
- @radix-ui/react-toast
- @radix-ui/react-toggle
- @radix-ui/react-toggle-group
- @radix-ui/react-tooltip
- react-day-picker
- react-hook-form
- react-resizable-panels
- recharts
- sonner
- @supabase/ssr
- @supabase/supabase-js
- tailwind-merge
- tailwindcss-animate
- @tanstack/react-query
- @tanstack/react-query-devtools
- vaul
- @vercel/analytics
- zod
- zustand
- postcss.config.mjs
- tailwind.config.js

## God Nodes (most connected - your core abstractions)
1. `cn()` - 115 edges
2. `Button` - 25 edges
3. `useToast()` - 25 edges
4. `createClient()` - 19 edges
5. `useCartStore` - 17 edges
6. `formatNaira()` - 16 edges
7. `compilerOptions` - 16 edges
8. `createClient()` - 13 edges
9. `Input` - 12 edges
10. `react` - 11 edges

## Surprising Connections (you probably didn't know these)
- `OrderDetailsDialog()` --calls--> `formatNaira()`  [EXTRACTED]
  app/account/orders/page.jsx → lib/pricing.js
- `AlertDialogHeader()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert-dialog.tsx → lib/utils.ts
- `AlertDialogFooter()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert-dialog.tsx → lib/utils.ts
- `BreadcrumbSeparator()` --calls--> `cn()`  [EXTRACTED]
  components/ui/breadcrumb.tsx → lib/utils.ts
- `BreadcrumbEllipsis()` --calls--> `cn()`  [EXTRACTED]
  components/ui/breadcrumb.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Paystack Payment Flow (initialize → verify → webhook → stock decrement)** — fixes_paystack_initialize, fixes_paystack_verify, fixes_paystack_webhook_source_of_truth, fixes_atomic_stock_decrement, fixes_server_side_price_computation, fixes_cart_clear_timing [EXTRACTED 1.00]
- **Critical Security Hardening Before Real Payments** — fixes_service_role_key_rotation, fixes_secret_management, fixes_fake_payment_simulator_removal, fixes_search_filter_injection, fixes_rls_policies, fixes_pci_card_field_removal [EXTRACTED 1.00]
- **PetDo Design Token Layer Consumed by Component Specs** — design_system_petdo_master_color_palette, design_system_petdo_master_spacing_tokens, design_system_petdo_master_shadow_depths, design_system_petdo_master_button_specs, design_system_petdo_master_card_specs, design_system_petdo_master_input_specs, design_system_petdo_master_modal_specs [EXTRACTED 1.00]

## Communities (97 total, 57 thin omitted)

### Community 0 - "Storefront Pages"
Cohesion: 0.08
Nodes (42): metadata, STATS, VALUES, CartPage(), CheckoutPage(), NIGERIAN_STATES, ReviewOrderPage(), OrderSuccessPage() (+34 more)

### Community 1 - "Authentication Pages"
Cohesion: 0.13
Nodes (28): ForgotPasswordPage(), LoginPageContent(), RegisterPage(), ResetPasswordPage(), AuthShell(), COMPANY_LINKS, Footer(), TODO: wire to a newsletter service/table (+20 more)

### Community 2 - "Carousel Component"
Cohesion: 0.05
Nodes (34): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+26 more)

### Community 3 - "Toast Notifications"
Cohesion: 0.07
Nodes (37): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+29 more)

### Community 4 - "Shop & Category Browsing"
Cohesion: 0.10
Nodes (28): CategoryPage(), ShopPageContent(), AccordionContent, AccordionItem, AccordionTrigger, Badge(), BadgeProps, badgeVariants (+20 more)

### Community 5 - "My Orders & Command Palette"
Cohesion: 0.09
Nodes (26): MyOrdersPage(), OrderDetailsDialog(), STATUS_CONFIG, useMyOrders(), Command, CommandEmpty, CommandGroup, CommandInput (+18 more)

### Community 6 - "Sidebar Component"
Cohesion: 0.07
Nodes (28): Sidebar, SidebarContent, SidebarContext, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel (+20 more)

### Community 7 - "TypeScript Configuration"
Cohesion: 0.07
Nodes (29): ./*, dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+21 more)

### Community 8 - "API Route Handlers"
Cohesion: 0.13
Nodes (16): POST(), POST(), GET(), POST(), GET(), GET(), GET(), GET() (+8 more)

### Community 9 - "App Layout & Header"
Cohesion: 0.11
Nodes (19): body, display, metadata, Providers(), ANIMALS, Header(), NAV_LINKS, Avatar (+11 more)

### Community 10 - "Build Tooling & DevDeps"
Cohesion: 0.09
Nodes (21): devDependencies, postcss, tailwindcss, @types/node, @types/react, @types/react-dom, typescript, name (+13 more)

### Community 11 - "Form Field Components"
Cohesion: 0.17
Nodes (17): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+9 more)

### Community 12 - "Database Schema (SQL)"
Cohesion: 0.17
Nodes (20): items_log_changes, items_set_updated_at, orders_set_updated_at, public.categories, public.coupon_redemptions, public.coupons, public.departments, public.item_history (+12 more)

### Community 13 - "Popover & Radio Controls"
Cohesion: 0.11
Nodes (11): HoverCardContent, PopoverContent, Progress, RadioGroup, RadioGroupItem, ScrollArea, ScrollBar, Switch (+3 more)

### Community 14 - "shadcn/ui Config"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 15 - "Button, Calendar, Pagination"
Cohesion: 0.18
Nodes (12): ButtonProps, buttonVariants, Calendar(), CalendarDayButton(), Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem (+4 more)

### Community 16 - "NPM Dependencies"
Cohesion: 0.15
Nodes (13): clsx, embla-carousel-react, @hookform/resolvers, dependencies, clsx, embla-carousel-react, @hookform/resolvers, @radix-ui/react-accordion (+5 more)

### Community 17 - "Item Layout Component"
Cohesion: 0.18
Nodes (12): Item(), ItemActions(), ItemContent(), ItemDescription(), ItemFooter(), ItemGroup(), ItemHeader(), ItemMedia() (+4 more)

### Community 18 - "PetDo Design System"
Cohesion: 0.19
Nodes (13): App Store Style Landing Pattern, Button Component Specs, Card Component Specs, Claymorphism (Mobile) Style, PetDo Color Palette (playful orange + trust blue), PetDo Design System Master, Input Component Specs, Modal Component Specs (+5 more)

### Community 19 - "Menubar Component"
Cohesion: 0.17
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 20 - "Security & Payment Fix Plan"
Cohesion: 0.18
Nodes (11): Admin Dashboard with RBAC (M1), Atomic Stock Check & Decrement (C9), Fake Payment Simulator Removal (C3), Order Confirmation Email (M2), Normalize order_items Table (M9), Paystack Initialize Hardening (C5), Paystack Verify Amount Match (C6), Paystack Webhook as Payment Source of Truth (C7) (+3 more)

### Community 21 - "Context Menu Component"
Cohesion: 0.20
Nodes (9): ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut(), ContextMenuSubContent (+1 more)

### Community 22 - "alert-dialog.tsx"
Cohesion: 0.22
Nodes (8): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle

### Community 23 - "input-group.tsx"
Cohesion: 0.28
Nodes (8): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea()

### Community 24 - "breadcrumb.tsx"
Cohesion: 0.25
Nodes (7): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 25 - "drawer.tsx"
Cohesion: 0.25
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 26 - "empty.tsx"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 27 - "navigation-menu.tsx"
Cohesion: 0.25
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 28 - "GRAPH_REPORT.md"
Cohesion: 0.33
Nodes (7): GRAPH_REPORT.md, graphify query, Graphify Knowledge Graph Workflow, Currency Mismatch USD vs NGN (H4), NGN Currency Decision (₦, 7.5% VAT, flat ₦1,500 shipping), PetDo Full Fix Plan, Nigerian Shipping Zones/Rates (M7)

### Community 29 - "toggle.tsx"
Cohesion: 0.33
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 30 - "002_category_tree.sql"
Cohesion: 0.43
Nodes (4): categories_cascade_path_trg, public.categories, public.category_descendant_ids(), public.item_categories

### Community 31 - "001_stock_and_orders.sql"
Cohesion: 0.40
Nodes (5): public.categories, public.departments, public.items, public.mark_order_paid(), public.orders

### Community 32 - "button-group.tsx"
Cohesion: 0.50
Nodes (4): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants

### Community 33 - "input-otp.tsx"
Cohesion: 0.40
Nodes (4): InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot

### Community 34 - "Cart Badge Total Quantity (H7)"
Cohesion: 0.40
Nodes (5): Cart Badge Total Quantity (H7), Department Filter !inner Join (H9), Header Search URL Param Wiring (H6), Search-Filter Injection Fix (C8), TypeScript Migration + Zod Validation (M8)

## Ambiguous Edges - Review These
- `PetDo Color Palette (playful orange + trust blue)` → `Claymorphism (Mobile) Style`  [AMBIGUOUS]
  design-system/petdo/MASTER.md · relation: conceptually_related_to

## Knowledge Gaps
- **315 isolated node(s):** `metadata`, `VALUES`, `STATS`, `STATUS_CONFIG`, `NIGERIAN_STATES` (+310 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **57 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `PetDo Color Palette (playful orange + trust blue)` and `Claymorphism (Mobile) Style`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `cn()` connect `Form Field Components` to `Storefront Pages`, `Authentication Pages`, `Carousel Component`, `Toast Notifications`, `Shop & Category Browsing`, `My Orders & Command Palette`, `Sidebar Component`, `App Layout & Header`, `Popover & Radio Controls`, `Button, Calendar, Pagination`, `Item Layout Component`, `Menubar Component`, `Context Menu Component`, `alert-dialog.tsx`, `input-group.tsx`, `breadcrumb.tsx`, `drawer.tsx`, `empty.tsx`, `navigation-menu.tsx`, `toggle.tsx`, `button-group.tsx`, `input-otp.tsx`?**
  _High betweenness centrality (0.263) - this node is a cross-community bridge._
- **Why does `dependencies` connect `NPM Dependencies` to `Carousel Component`, `Build Tooling & DevDeps`, `autoprefixer`, `class-variance-authority`, `cmdk`, `date-fns`, `input-otp`, `lucide-react`, `next`, `next-themes`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-avatar`, `@radix-ui/react-checkbox`, `@radix-ui/react-collapsible`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-label`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-slot`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `@radix-ui/react-toggle`, `@radix-ui/react-toggle-group`, `@radix-ui/react-tooltip`, `react-day-picker`, `react-hook-form`, `react-resizable-panels`, `recharts`, `sonner`, `@supabase/ssr`, `@supabase/supabase-js`, `tailwind-merge`, `tailwindcss-animate`, `@tanstack/react-query`, `@tanstack/react-query-devtools`, `vaul`, `@vercel/analytics`, `zod`, `zustand`?**
  _High betweenness centrality (0.242) - this node is a cross-community bridge._
- **Why does `react` connect `Carousel Component` to `Authentication Pages`, `Toast Notifications`, `Sidebar Component`, `Button, Calendar, Pagination`, `NPM Dependencies`?**
  _High betweenness centrality (0.225) - this node is a cross-community bridge._
- **What connects `metadata`, `VALUES`, `STATS` to the rest of the system?**
  _315 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Storefront Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.08050655811849841 - nodes in this community are weakly interconnected._
- **Should `Authentication Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.13124274099883856 - nodes in this community are weakly interconnected._