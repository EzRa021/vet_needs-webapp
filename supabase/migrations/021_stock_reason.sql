-- ============================================================
-- 021_stock_reason.sql
-- "Why did the stock change?" — the one question item_history can't
-- currently answer.
--
-- Today a manual stock edit logs previousValue/newValue/changeAmount and
-- nothing else. So "Layer Mash 25kg: 40 → 12" is a permanent mystery:
-- sold offline? mouldy? miscounted? stolen? Those are four different
-- business problems and the log flattens them into one.
--
-- HOW: log_item_changes() already reads a transaction-local setting to
-- recognise a sale (`app.sale_order_id`, set by mark_order_paid). A
-- reason rides the same mechanism — but it MUST be set in the same
-- transaction as the UPDATE, and two supabase-js calls are two
-- transactions. Hence an RPC that does both.
--
-- Idempotent; safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- Extend the logger to carry a reason. Everything else is unchanged from
-- 000 — this only adds `reason` / `note` to the stock branch's details.
-- ------------------------------------------------------------
create or replace function public.log_item_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor text := coalesce(auth.uid()::text, 'system');
  v_reason text := nullif(current_setting('app.stock_reason', true), '');
  v_note text := nullif(current_setting('app.stock_note', true), '');
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
      )
      || coalesce(
           jsonb_build_object('orderId', nullif(current_setting('app.sale_order_id', true), '')),
           '{}'::jsonb
         )
      -- Only present when adjust_stock() set it. A direct UPDATE (a script, a
      -- future route that forgets) still logs, just without a reason — the
      -- history stays complete either way.
      || case when v_reason is not null
              then jsonb_build_object('reason', v_reason) else '{}'::jsonb end
      || case when v_note is not null
              then jsonb_build_object('note', v_note) else '{}'::jsonb end
    );
  end if;

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

-- ------------------------------------------------------------
-- Adjust stock, with a reason, atomically.
--
-- Takes a DELTA, not a new total. Two staff counting the same shelf at once
-- would otherwise clobber each other: "set to 40" twice ends at 40, while
-- "+15" twice ends at +30. Deltas are what an inventory event actually is.
-- ------------------------------------------------------------
create or replace function public.adjust_stock(
  p_item_id uuid,
  p_delta numeric,
  p_reason text,
  p_note text default null
)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_stock numeric;
  v_new numeric;
begin
  if not public.is_staff() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'Enter an amount to add or remove';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required';
  end if;

  -- Lock the row: the read and the write have to be one step, or two
  -- simultaneous adjustments both read 40 and both write their own answer.
  select stock into v_stock from public.items where id = p_item_id for update;

  if not found then
    raise exception 'Product not found';
  end if;

  if v_stock is null then
    raise exception 'This product does not track stock';
  end if;

  v_new := v_stock + p_delta;

  if v_new < 0 then
    -- The items_stock_non_negative constraint would reject this anyway; saying
    -- it in words beats a raw constraint violation in a toast.
    raise exception 'That would leave stock at %, below zero (currently %)', v_new, v_stock;
  end if;

  -- `true` = transaction-local, so it can't leak into the next statement on a
  -- pooled connection. The trigger reads these during the UPDATE below.
  perform set_config('app.stock_reason', p_reason, true);
  perform set_config('app.stock_note', coalesce(p_note, ''), true);

  update public.items set stock = v_new where id = p_item_id;

  perform set_config('app.stock_reason', '', true);
  perform set_config('app.stock_note', '', true);

  return v_new;
end;
$$;

revoke all on function public.adjust_stock(uuid, numeric, text, text) from public;
grant execute on function public.adjust_stock(uuid, numeric, text, text) to authenticated;

comment on function public.adjust_stock is
  'Staff stock movement with a reason, logged to item_history. Takes a DELTA and locks the row — "set to 40" twice from two people ends at 40, "+15" twice ends at +30, and only the second is what actually happened.';
