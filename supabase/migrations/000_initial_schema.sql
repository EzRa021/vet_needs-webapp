-- ============================================================
-- PetDo — base schema (standard e-commerce)
-- Run this FIRST on a fresh Supabase project, then run
-- 001_stock_and_orders.sql (payments, stock function, RLS for
-- the core tables).
--
-- Tables: departments, categories, items, item_images, orders,
--         reviews, wishlists, coupons, coupon_redemptions,
--         promotions (banners/ads), settings
-- ============================================================

-- Shared helper: keep updated_at fresh automatically
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 1. Departments (top-level shop sections, e.g. "Dogs", "Cats")
-- ------------------------------------------------------------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text unique,
  description text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. Categories (belong to a department; sub-categories via parent_id)
-- ------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  image_url text,
  department_id uuid references public.departments (id) on delete set null,
  parent_id uuid references public.categories (id) on delete set null, -- sub-categories
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists categories_department_id_idx on public.categories (department_id);
create index if not exists categories_parent_id_idx on public.categories (parent_id);

-- ------------------------------------------------------------
-- 3. Items (products)
--    Columns the app already uses: name, description, price,
--    stock, image_url, category_id. Everything else is the
--    advanced layer (discounts, ratings, availability, SEO...).
-- ------------------------------------------------------------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  -- identity
  name text not null,
  slug text unique,
  sku text unique,
  brand text,
  description text,                      -- short description (cards, lists)
  long_description text,                 -- full details for the product page
  -- pricing (NGN) — POS mapping: sellingPrice → price,
  -- discounted price → price + compare_at_price (old price), costPrice → cost_price
  price numeric(12, 2) not null check (price >= 0),          -- current selling price (per piece or per kg)
  compare_at_price numeric(12, 2) check (compare_at_price >= 0), -- old price → shows discount
  cost_price numeric(12, 2) check (cost_price >= 0),         -- what YOU pay (profit reports)
  -- VAT (per item, matching the GNX POS model)
  vat_enabled boolean not null default true,
  vat_rate numeric(5, 2) not null default 7.5 check (vat_rate >= 0),   -- percent, e.g. 7.5
  vat_inclusive boolean not null default true, -- true = price already contains VAT
  -- inventory — items sell per piece OR per kg (weight);
  -- stock is numeric so kg items can hold 12.500 etc.
  unit_type text not null default 'piece' check (unit_type in ('piece', 'kg')),
  stock numeric(12, 3) not null default 0,
  low_stock_threshold numeric(12, 3) not null default 10,
  allow_backorder boolean not null default false,
  -- availability
  is_active boolean not null default true,   -- admin on/off switch (hidden when false)
  is_available boolean generated always as (is_active and (stock > 0 or allow_backorder)) stored,
  is_featured boolean not null default false, -- show on the home page
  -- media (image_url = main image; extra images in item_images)
  image_url text,
  -- ratings (denormalized from reviews via trigger — never write directly)
  rating_avg numeric(3, 2) not null default 0 check (rating_avg between 0 and 5),
  rating_count integer not null default 0,
  -- shipping / logistics
  weight_grams integer,
  -- flexible extras: e.g. {"size": "10kg", "flavour": "Chicken", "age": "Adult"}
  attributes jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  -- SEO
  meta_title text,
  meta_description text,
  -- relations & bookkeeping
  category_id uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_category_id_idx on public.items (category_id);
create index if not exists items_price_idx on public.items (price);
create index if not exists items_name_idx on public.items (name);
create index if not exists items_is_available_idx on public.items (is_available);
create index if not exists items_is_featured_idx on public.items (is_featured) where is_featured;
create index if not exists items_tags_idx on public.items using gin (tags);

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4. Item images (gallery — more than one image per product)
-- ------------------------------------------------------------
create table if not exists public.item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists item_images_item_id_idx on public.item_images (item_id, sort_order);

-- ------------------------------------------------------------
-- 4b. Item history — separate table referencing the item
--     (replaces the embedded `history` array used by the GNX
--      desktop POS; same event types, but queryable and it
--      doesn't bloat the item row).
-- ------------------------------------------------------------
create table if not exists public.item_history (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  type text not null
    check (type in ('creation', 'adjustment', 'price_update', 'vat_update', 'sale', 'restock')),
  created_by text not null default 'system', -- auth uid or 'system'/'webhook'
  details jsonb not null default '{}'::jsonb, -- previous/new values, reason, order id...
  created_at timestamptz not null default now()
);

create index if not exists item_history_item_id_idx on public.item_history (item_id, created_at desc);

-- Auto-log item changes (creation, stock adjustments, price & VAT updates)
create or replace function public.log_item_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor text := coalesce(auth.uid()::text, 'system');
begin
  if tg_op = 'INSERT' then
    insert into public.item_history (item_id, type, created_by, details)
    values (new.id, 'creation', v_actor, jsonb_build_object(
      'initialStock', new.stock,
      'unitType', new.unit_type,
      'price', new.price,
      'vatEnabled', new.vat_enabled,
      'vatRate', new.vat_rate,
      'vatInclusive', new.vat_inclusive
    ));
    return new;
  end if;

  -- stock change: logged as 'sale' when triggered by mark_order_paid
  -- (which sets the app.sale_order_id transaction flag), otherwise as a
  -- manual 'adjustment' / 'restock'
  if new.stock is distinct from old.stock then
    insert into public.item_history (item_id, type, created_by, details)
    values (
      new.id,
      case
        when nullif(current_setting('app.sale_order_id', true), '') is not null then 'sale'
        when new.stock > old.stock then 'restock'
        else 'adjustment'
      end,
      v_actor,
      jsonb_build_object(
        'previousValue', old.stock,
        'newValue', new.stock,
        'changeAmount', new.stock - old.stock,
        'unitType', new.unit_type
      ) || coalesce(
        jsonb_build_object('orderId', nullif(current_setting('app.sale_order_id', true), '')),
        '{}'::jsonb
      )
    );
  end if;

  -- price change
  if new.price is distinct from old.price
     or new.compare_at_price is distinct from old.compare_at_price
     or new.cost_price is distinct from old.cost_price then
    insert into public.item_history (item_id, type, created_by, details)
    values (new.id, 'price_update', v_actor, jsonb_build_object(
      'previousPrice', old.price, 'newPrice', new.price,
      'previousCompareAtPrice', old.compare_at_price, 'newCompareAtPrice', new.compare_at_price,
      'previousCostPrice', old.cost_price, 'newCostPrice', new.cost_price
    ));
  end if;

  -- VAT change
  if new.vat_enabled is distinct from old.vat_enabled
     or new.vat_rate is distinct from old.vat_rate
     or new.vat_inclusive is distinct from old.vat_inclusive then
    insert into public.item_history (item_id, type, created_by, details)
    values (new.id, 'vat_update', v_actor, jsonb_build_object(
      'previousVatEnabled', old.vat_enabled, 'newVatEnabled', new.vat_enabled,
      'previousVatRate', old.vat_rate, 'newVatRate', new.vat_rate,
      'previousVatInclusive', old.vat_inclusive, 'newVatInclusive', new.vat_inclusive
    ));
  end if;

  return new;
end;
$$;

drop trigger if exists items_log_changes on public.items;
create trigger items_log_changes
  after insert or update on public.items
  for each row execute function public.log_item_changes();

-- ------------------------------------------------------------
-- 5. Orders
--    (001_stock_and_orders.sql adds payment_reference + paid_at
--     and the mark_order_paid() function — run it after this.)
-- ------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- money breakdown (all NGN)
  currency text not null default 'NGN',
  subtotal numeric(12, 2) check (subtotal >= 0),
  shipping_fee numeric(12, 2) check (shipping_fee >= 0),
  tax_amount numeric(12, 2) check (tax_amount >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  coupon_code text,
  -- lifecycle
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'canceled', 'refunded')),
  -- fulfilment
  shipping_address text,
  tracking_number text,
  order_items jsonb not null default '[]'::jsonb,
  notes text,
  admin_notes text, -- internal, never shown to the customer
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 6. Reviews & ratings (one review per user per product)
-- ------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  title text,
  comment text,
  is_approved boolean not null default true, -- flip default to false for pre-moderation
  created_at timestamptz not null default now(),
  unique (item_id, user_id)
);

create index if not exists reviews_item_id_idx on public.reviews (item_id);

-- Keep items.rating_avg / rating_count in sync automatically
create or replace function public.refresh_item_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_item uuid := coalesce(new.item_id, old.item_id);
begin
  update public.items i
     set rating_avg = coalesce(r.avg_rating, 0),
         rating_count = coalesce(r.cnt, 0)
    from (
      select round(avg(rating)::numeric, 2) as avg_rating, count(*) as cnt
      from public.reviews
      where item_id = v_item and is_approved
    ) r
   where i.id = v_item;
  return null;
end;
$$;

drop trigger if exists reviews_refresh_rating on public.reviews;
create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_item_rating();

-- ------------------------------------------------------------
-- 7. Wishlists
-- ------------------------------------------------------------
create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, item_id)
);

create index if not exists wishlists_user_id_idx on public.wishlists (user_id);

-- ------------------------------------------------------------
-- 8. Coupons / discount codes
-- ------------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12, 2) not null check (discount_value > 0), -- percent (e.g. 10) or ₦ amount
  min_order_amount numeric(12, 2) not null default 0,
  max_discount_amount numeric(12, 2),           -- cap for percent coupons
  max_uses integer,                              -- null = unlimited
  used_count integer not null default 0,
  max_uses_per_user integer not null default 1,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Who used which coupon on which order (enforces per-user limits, auditing)
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  discount_amount numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create index if not exists coupon_redemptions_user_idx on public.coupon_redemptions (coupon_id, user_id);

-- ------------------------------------------------------------
-- 9. Promotions / banners / ads (home page hero, sale strips...)
-- ------------------------------------------------------------
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text,
  link_url text,          -- where clicking the banner goes (e.g. /shop?category=...)
  placement text not null default 'home_hero'
    check (placement in ('home_hero', 'home_banner', 'shop_banner', 'popup')),
  sort_order integer not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists promotions_placement_idx on public.promotions (placement, sort_order);

-- ------------------------------------------------------------
-- 10. Settings (store-wide configuration, key → JSON value)
-- ------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  description text,
  is_public boolean not null default false, -- public settings are readable by the storefront
  updated_at timestamptz not null default now()
);

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

insert into public.settings (key, value, description, is_public) values
  ('store_name', '"PetDo"', 'Shop display name', true),
  ('currency', '"NGN"', 'Store currency', true),
  ('shipping_flat_fee', '1500', 'Flat shipping fee in NGN', true),
  ('vat_rate', '0.075', 'VAT rate (7.5%)', true),
  ('support_email', '"support@example.com"', 'Customer support email', true),
  ('support_phone', '""', 'Customer support phone', true),
  ('free_shipping_threshold', 'null', 'Order total for free shipping (null = disabled)', true)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 11. Row Level Security for the NEW tables
--     (001_stock_and_orders.sql secures departments/categories/
--      items/orders; coupons stay server-only on purpose —
--      they are validated through the API with the service role.)
-- ------------------------------------------------------------
alter table public.item_images enable row level security;
alter table public.item_history enable row level security;
-- item_history: NO policies on purpose → internal audit trail, only the
-- service role (API/admin) can read or write it.
alter table public.reviews enable row level security;
alter table public.wishlists enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.promotions enable row level security;
alter table public.settings enable row level security;

-- Product gallery: public read
drop policy if exists "item images readable by all" on public.item_images;
create policy "item images readable by all" on public.item_images
  for select using (true);

-- Reviews: everyone reads approved ones (authors always see their own);
-- users write/edit/delete only their own
drop policy if exists "approved reviews readable" on public.reviews;
create policy "approved reviews readable" on public.reviews
  for select using (is_approved or auth.uid() = user_id);

drop policy if exists "users write own reviews" on public.reviews;
create policy "users write own reviews" on public.reviews
  for insert with check (auth.uid() = user_id);

drop policy if exists "users edit own reviews" on public.reviews;
create policy "users edit own reviews" on public.reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete own reviews" on public.reviews;
create policy "users delete own reviews" on public.reviews
  for delete using (auth.uid() = user_id);

-- Wishlists: fully private per user
drop policy if exists "users manage own wishlist" on public.wishlists;
create policy "users manage own wishlist" on public.wishlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Promotions: public can read only live ones
drop policy if exists "live promotions readable" on public.promotions;
create policy "live promotions readable" on public.promotions
  for select using (
    is_active and starts_at <= now() and (ends_at is null or ends_at > now())
  );

-- Settings: public can read only public keys
drop policy if exists "public settings readable" on public.settings;
create policy "public settings readable" on public.settings
  for select using (is_public);

-- coupons / coupon_redemptions: NO policies on purpose → only the
-- service role (API) can read or write them.

-- ============================================================
-- 12. OPTIONAL sample data so the shop isn't empty on first run.
--     Delete this section (or the rows, later) if unwanted.
-- ============================================================
-- NOTE: the real taxonomy tree (Pet + Feed and their categories) is created
-- in 002_category_tree.sql. Here we seed departments/categories the flat way
-- so 000 works standalone; 002 upgrades them into the tree. Names match so
-- 002 finds and reuses these rows.
insert into public.departments (name, description)
values
  ('Pet',  'Food, treats and accessories for pets'),
  ('Feed', 'Poultry, fish and livestock feed')
on conflict (name) do nothing;

insert into public.categories (name, description, department_id)
select v.name, v.description, d.id
from (values
  ('Pet Kibbles',      'Dry kibble for dogs & cats',         'Pet'),
  ('Pet Accessories',  'Bowls, leashes, toys & grooming',    'Pet'),
  ('Frozen Entries',   'Frozen raw & prepared pet meals',    'Pet'),
  ('Vet Sundries',     'Health, supplements & vet products', 'Pet'),
  ('Pasta Pet Scraps', 'Pasta & mixed pet scraps',           'Pet'),
  ('Poultry Feeds',    'Starter, grower & layer mash',       'Feed'),
  ('Fish Feed',        'Floating & sinking fish feed',       'Feed')
) as v(name, description, dept)
join public.departments d on d.name = v.dept
where not exists (select 1 from public.categories c where c.name = v.name);

-- Realistic sample products (Nigerian agri + pet catalogue)
insert into public.items
  (name, sku, brand, description, price, compare_at_price, stock, unit_type, is_featured, category_id, attributes, tags)
select v.name, v.sku, v.brand, v.description, v.price, v.compare_at_price, v.stock, v.unit_type, v.is_featured, c.id,
       v.attributes::jsonb, v.tags::text[]
from (values
  -- Poultry Feeds
  ('Layer Mash 25kg', 'FEED-PLT-001', 'TopFeeds',
   'Complete layer mash for laying hens', 13500.00, 15000.00, 120, 'piece', true, 'Poultry Feeds',
   '{"bag_size": "25kg", "stage": "Layer", "animal": "Poultry"}', '{feed,poultry,layer}'),
  ('Broiler Starter 25kg', 'FEED-PLT-002', 'TopFeeds',
   'High-protein starter for broiler chicks', 14200.00, null, 90, 'piece', true, 'Poultry Feeds',
   '{"bag_size": "25kg", "stage": "Starter", "animal": "Poultry"}', '{feed,poultry,broiler}'),
  ('Grower Mash 25kg', 'FEED-PLT-003', 'Vital Feed',
   'Balanced grower mash for growing birds', 12800.00, null, 75, 'piece', false, 'Poultry Feeds',
   '{"bag_size": "25kg", "stage": "Grower", "animal": "Poultry"}', '{feed,poultry,grower}'),
  -- Fish Feed
  ('Floating Fish Feed 15kg', 'FEED-FSH-001', 'Coppens',
   'Floating pellets for catfish & tilapia', 18500.00, 20000.00, 60, 'piece', true, 'Fish Feed',
   '{"bag_size": "15kg", "type": "Floating", "animal": "Fish"}', '{feed,fish,floating}'),
  ('Sinking Fish Feed 15kg', 'FEED-FSH-002', 'Aqua Pro',
   'Sinking pellets for bottom feeders', 16000.00, null, 45, 'piece', false, 'Fish Feed',
   '{"bag_size": "15kg", "type": "Sinking", "animal": "Fish"}', '{feed,fish,sinking}'),
  -- Pet Kibbles
  ('Adult Dog Kibble 10kg', 'PET-KIB-001', 'PetDo Select',
   'Balanced dry food for adult dogs', 24500.00, 27000.00, 50, 'piece', true, 'Pet Kibbles',
   '{"bag_size": "10kg", "flavour": "Chicken", "life_stage": "Adult", "animal": "Dog"}', '{pet,dog,kibble}'),
  ('Cat Kibble 4kg', 'PET-KIB-002', 'PetDo Select',
   'Complete dry food for adult cats', 15500.00, null, 40, 'piece', false, 'Pet Kibbles',
   '{"bag_size": "4kg", "flavour": "Fish", "life_stage": "Adult", "animal": "Cat"}', '{pet,cat,kibble}'),
  -- Pet Accessories
  ('Stainless Steel Pet Bowl', 'PET-ACC-001', 'PawEssentials',
   'Non-slip stainless steel feeding bowl', 3500.00, null, 100, 'piece', false, 'Pet Accessories',
   '{"material": "Stainless steel", "size": "Medium"}', '{pet,accessory,bowl}'),
  ('Adjustable Dog Leash', 'PET-ACC-002', 'PawEssentials',
   'Durable padded leash for daily walks', 4200.00, 5000.00, 80, 'piece', false, 'Pet Accessories',
   '{"length": "1.5m", "material": "Nylon"}', '{pet,accessory,leash}'),
  -- Vet Sundries
  ('Multivitamin Supplement 500ml', 'PET-VET-001', 'VetCare',
   'Vitamin & mineral supplement for poultry & pets', 6500.00, null, 65, 'piece', false, 'Vet Sundries',
   '{"volume": "500ml", "type": "Supplement"}', '{vet,supplement,health}'),
  -- Frozen Entries (sold per kg)
  ('Frozen Chicken Necks (per kg)', 'PET-FRZ-001', 'FreshPets',
   'Raw frozen chicken necks for raw feeding', 2800.00, null, 40.000, 'kg', false, 'Frozen Entries',
   '{"storage": "Frozen", "animal": "Dog"}', '{pet,frozen,raw}')
) as v(name, sku, brand, description, price, compare_at_price, stock, unit_type, is_featured, cat, attributes, tags)
join public.categories c on c.name = v.cat
where not exists (select 1 from public.items i where i.sku = v.sku);

insert into public.promotions (title, subtitle, link_url, placement, sort_order)
select 'Quality Feed & Pet Care', 'Poultry feed, pet food & accessories — delivered nationwide', '/shop', 'home_hero', 0
where not exists (select 1 from public.promotions where placement = 'home_hero');
