-- ============================================================
-- PetDo — flexible category TREE (departments → categories → …)
-- Unlimited depth, self-referencing, POS-mappable.
--
-- A "department" is simply a category with no parent (depth 0).
-- Any node can have children, so the shop can model:
--   Pet  → Pet Kibbles / Pet Accessories / Frozen Entries / …
--   Feed → Poultry Feeds / Fish Feed / …
-- …and add sub-departments / sub-categories later with NO schema change.
--
-- Run AFTER 000_initial_schema.sql and 001_stock_and_orders.sql.
-- Idempotent and safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extend the categories table into a tree
-- ------------------------------------------------------------
-- Defensive: add every column the tree needs. `create table if not exists`
-- in 000 will NOT retrofit columns onto an already-existing table, so we add
-- them here explicitly. Safe to re-run.
alter table public.categories
  add column if not exists slug text,
  add column if not exists image_url text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists path text,               -- materialized slug path e.g. 'feed/poultry-feeds'
  add column if not exists depth integer not null default 0,
  add column if not exists pos_external_id text,    -- id in the GNX POS (for import/sync)
  add column if not exists pos_source text,         -- which POS/source this node came from
  add column if not exists meta_title text,
  add column if not exists meta_description text;

-- parent_id: added separately so the self-FK is only declared when genuinely
-- missing. (An inline `add column if not exists ... references` re-declares the
-- constraint and fails if categories.id is not uuid.) The column type is matched
-- to categories.id, so this works whether the PK is uuid or bigint/integer.
do $$
declare
  id_type text;
begin
  select data_type into id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'categories' and column_name = 'id';

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'categories' and column_name = 'parent_id'
  ) then
    execute format('alter table public.categories add column parent_id %s', id_type);
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'categories'
      and constraint_name = 'categories_parent_id_fkey'
  ) then
    alter table public.categories
      add constraint categories_parent_id_fkey
      foreign key (parent_id) references public.categories (id) on delete set null;
  end if;
end $$;

create index if not exists categories_parent_id_idx on public.categories (parent_id);

-- slug must be unique among SIBLINGS (not globally) so two branches can both
-- have e.g. "accessories". Two partial indexes express this without needing a
-- COALESCE expression index (which Postgres rejects as an index element).
alter table public.categories drop constraint if exists categories_slug_key;
drop index if exists categories_slug_key;

create unique index if not exists categories_root_slug_key
  on public.categories (slug) where parent_id is null;
create unique index if not exists categories_child_slug_key
  on public.categories (parent_id, slug) where parent_id is not null;

create unique index if not exists categories_path_key on public.categories (path);
create index if not exists categories_path_prefix_idx on public.categories (path text_pattern_ops);
create unique index if not exists categories_pos_key
  on public.categories (pos_source, pos_external_id)
  where pos_external_id is not null;

-- ------------------------------------------------------------
-- 2. slugify helper
-- ------------------------------------------------------------
create or replace function public.slugify(txt text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(txt, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- ------------------------------------------------------------
-- 3. Backfill slug + path + depth (BEFORE creating triggers)
-- ------------------------------------------------------------
-- 3a. Ensure every node has a slug
update public.categories set slug = public.slugify(name) where slug is null or slug = '';

-- 3b. De-duplicate sibling slugs (rare, sample data) by appending a short id
update public.categories c
set slug = c.slug || '-' || left(c.id::text, 4)
where exists (
  select 1 from public.categories s
  where s.id <> c.id
    and coalesce(s.parent_id::text, 'root') = coalesce(c.parent_id::text, 'root')
    and s.slug = c.slug
);

-- 3c. Compute path + depth for the whole tree
with recursive tree as (
  select id, slug, parent_id, slug::text as path, 0 as depth
  from public.categories where parent_id is null
  union all
  select c.id, c.slug, c.parent_id, t.path || '/' || c.slug, t.depth + 1
  from public.categories c
  join tree t on c.parent_id = t.id
)
update public.categories c
set path = tree.path, depth = tree.depth
from tree where tree.id = c.id;

-- ------------------------------------------------------------
-- 4. Trigger: maintain path/depth, prevent cycles, cap depth
-- ------------------------------------------------------------
create or replace function public.categories_set_path()
returns trigger language plpgsql as $$
declare
  parent_path text;
  parent_depth int;
  max_depth constant int := 5; -- keep the tree browsable
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.slugify(new.name);
  end if;

  if new.parent_id is null then
    new.path := new.slug;
    new.depth := 0;
  else
    if new.parent_id = new.id then
      raise exception 'A category cannot be its own parent';
    end if;
    select path, depth into parent_path, parent_depth
      from public.categories where id = new.parent_id;
    if parent_path is null then
      raise exception 'Parent category % not found', new.parent_id;
    end if;
    -- cycle guard: parent must not be a descendant of this node
    if tg_op = 'UPDATE' and parent_path like old.path || '/%' then
      raise exception 'Cannot move a category under one of its own descendants';
    end if;
    new.path := parent_path || '/' || new.slug;
    new.depth := parent_depth + 1;
  end if;

  if new.depth > max_depth then
    raise exception 'Category nesting too deep (max % levels)', max_depth;
  end if;
  return new;
end;
$$;

drop trigger if exists categories_set_path_trg on public.categories;
create trigger categories_set_path_trg
  before insert or update of parent_id, slug, name on public.categories
  for each row execute function public.categories_set_path();

-- Trigger: when a node's path changes (moved/renamed), cascade to descendants
create or replace function public.categories_cascade_path()
returns trigger language plpgsql as $$
begin
  if new.path is distinct from old.path then
    update public.categories
    set path = new.path || substring(path from length(old.path) + 1),
        depth = depth + (new.depth - old.depth)
    where path like old.path || '/%';
  end if;
  return new;
end;
$$;

drop trigger if exists categories_cascade_path_trg on public.categories;
create trigger categories_cascade_path_trg
  after update on public.categories
  for each row execute function public.categories_cascade_path();

-- ------------------------------------------------------------
-- 5. Migrate any legacy `departments` rows into the tree as roots
--    (safe if the departments table is empty or already migrated)
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'departments') then

    -- 5a. Each department becomes a root category (matched by name)
    insert into public.categories (name, description, image_url, sort_order, is_active, parent_id, pos_source)
    select d.name, d.description, d.image_url, d.sort_order, d.is_active, null, 'legacy-department'
    from public.departments d
    where not exists (
      select 1 from public.categories c
      where c.parent_id is null and lower(c.name) = lower(d.name)
    );

    -- 5b. Re-parent existing categories that referenced a department
    update public.categories c
    set parent_id = root.id
    from public.departments d
    join public.categories root
      on root.parent_id is null and lower(root.name) = lower(d.name)
    where c.department_id = d.id and c.parent_id is null and c.id <> root.id;
  end if;
end $$;

-- ------------------------------------------------------------
-- 6. Subtree helper — returns a node + ALL its descendants.
--    Used by the items API so clicking "Feed" shows everything
--    nested under Feed, not just direct children.
-- ------------------------------------------------------------
create or replace function public.category_descendant_ids(p_root uuid)
returns uuid[] language sql stable as $$
  select coalesce(array_agg(c.id), array[p_root])
  from public.categories c
  where c.id = p_root
     or c.path like (select path from public.categories where id = p_root) || '/%';
$$;

grant execute on function public.category_descendant_ids(uuid) to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 7. Optional multi-placement: a product can ALSO appear in extra
--    merchandising nodes (e.g. "Promotions") without changing its
--    primary category_id. Wired later; table ready now.
-- ------------------------------------------------------------
create table if not exists public.item_categories (
  item_id uuid not null references public.items (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (item_id, category_id)
);
create index if not exists item_categories_category_idx on public.item_categories (category_id);

alter table public.item_categories enable row level security;
drop policy if exists "item_categories readable by all" on public.item_categories;
create policy "item_categories readable by all" on public.item_categories
  for select using (true);

-- ------------------------------------------------------------
-- 8. Seed the shop's REAL taxonomy (Pet + Feed) — idempotent
-- ------------------------------------------------------------
-- 8a. Departments (roots)
insert into public.categories (name, slug, description, sort_order, pos_source)
select v.name, v.slug, v.description, v.sort_order, 'seed'
from (values
  ('Pet',  'pet',  'Food, treats and accessories for pets', 0),
  ('Feed', 'feed', 'Poultry, fish and livestock feed',      1)
) as v(name, slug, description, sort_order)
where not exists (
  select 1 from public.categories c where c.parent_id is null and c.slug = v.slug
);

-- 8b. Categories under each department
insert into public.categories (name, slug, description, sort_order, parent_id, pos_source)
select v.name, v.slug, v.description, v.sort_order, root.id, 'seed'
from (values
  -- Pet
  ('Pet', 'Pet Kibbles',      'pet-kibbles',      'Dry kibble for dogs & cats',        0),
  ('Pet', 'Pet Accessories',  'pet-accessories',  'Bowls, leashes, toys & grooming',   1),
  ('Pet', 'Frozen Entries',   'frozen-entries',   'Frozen raw & prepared pet meals',   2),
  ('Pet', 'Vet Sundries',     'vet-sundries',     'Health, supplements & vet products',3),
  ('Pet', 'Pasta Pet Scraps', 'pasta-pet-scraps', 'Pasta & mixed pet scraps',          4),
  -- Feed
  ('Feed', 'Poultry Feeds', 'poultry-feeds', 'Starter, grower & layer mash', 0),
  ('Feed', 'Fish Feed',     'fish-feed',     'Floating & sinking fish feed',  1)
) as v(dept, name, slug, description, sort_order)
join public.categories root on root.parent_id is null and root.slug = public.slugify(v.dept)
where not exists (
  select 1 from public.categories c where c.parent_id = root.id and c.slug = v.slug
);

-- ============================================================
-- Notes for the app:
--   • /api/shop/departments  → categories where parent_id IS NULL
--   • /api/shop/categories?parent=<id> → direct children of a node
--   • items filter by category/department → category_descendant_ids()
--   • The old sample departments (e.g. Dogs/Cats from 000) are migrated
--     to roots; delete them from the admin if unwanted.
-- ============================================================
