-- ---------------------------------------------------------------------------
-- The contract between Next and the Supabase Edge Functions.
--
-- An Edge Function runs Deno. It cannot import lib/db/schema, Drizzle, or any
-- TypeScript in this repo. So the shared surface is SQL: both runtimes call the
-- functions below and neither writes payments, stripe_events or
-- notification_outbox directly. Table knowledge lives here, once.
--
-- Every function is `security definer` because the three tables have RLS on with
-- ZERO policies — the same posture as rate_limits. That makes them unreachable
-- for anon and authenticated clients, and reachable only through these entry
-- points, which decide what a caller may do rather than trusting who they are.
--
-- `set search_path` is not decoration: without it a definer function resolves
-- unqualified names against the CALLER's search_path, and a caller who creates
-- their own `payments` table gets our elevated rights applied to it.
-- ---------------------------------------------------------------------------

-- How far along a payment is, as a number, so out-of-order webhooks cannot
-- move one backwards. Stripe does not promise ordered delivery: a `processing`
-- event can arrive after the `succeeded` it preceded. Ranking makes the update
-- monotonic, so a late duplicate is ignored instead of un-paying an order.
create or replace function public.payment_status_rank(p_status public.payment_status)
returns int
language sql
immutable
as $$
  select case p_status
    when 'requires_payment' then 0
    when 'processing'       then 1
    when 'failed'           then 2
    when 'cancelled'        then 2
    when 'succeeded'        then 3
    -- A refund is the only thing that may follow a success.
    when 'refunded'         then 4
  end;
$$;

-- ---------------------------------------------------------------------------
-- Webhook idempotency.
--
-- Returns TRUE if this event has not been seen before and should be processed;
-- FALSE if it is a redelivery. Stripe retries until it gets a 2xx and does not
-- promise exactly-once delivery, so the caller must ask this BEFORE acting.
-- The primary key is the lock: two concurrent deliveries of the same event race
-- on the insert, and exactly one wins.
-- ---------------------------------------------------------------------------
create or replace function public.record_stripe_event(
  p_event_id text,
  p_type     text,
  p_payload  jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted boolean;
begin
  insert into public.stripe_events (id, type, payload)
  values (p_event_id, p_type, p_payload)
  on conflict (id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- ---------------------------------------------------------------------------
-- Register an intent against an order, before the customer has paid anything.
--
-- Idempotent on (provider, provider_ref) so a retried checkout cannot create a
-- second payment row for the same PaymentIntent.
-- ---------------------------------------------------------------------------
create or replace function public.create_payment(
  p_order_id     uuid,
  p_provider_ref text,
  p_amount_dkk   numeric,
  p_amount_minor bigint,
  p_currency     text default 'dkk',
  p_provider     text default 'stripe'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_amount_dkk <= 0 then
    raise exception 'A payment must be for a positive amount, got %', p_amount_dkk;
  end if;

  insert into public.payments (order_id, provider, provider_ref,
                               amount_dkk, amount_minor, currency)
  values (p_order_id, p_provider, p_provider_ref,
          p_amount_dkk, p_amount_minor, p_currency)
  on conflict (provider, provider_ref) do update
    set updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Apply what Stripe just told us about a payment.
--
-- Called ONLY by the stripe-webhook Edge Function, and only for an event that
-- record_stripe_event() said was new. Returns the affected order id, or null if
-- the PaymentIntent belongs to no order we know about — which is not an error:
-- one Stripe account can serve more than one system, and refusing to recognise
-- a stranger's intent is correct behaviour, not a failure.
-- ---------------------------------------------------------------------------
create or replace function public.apply_payment_event(
  p_provider_ref    text,
  p_status          public.payment_status,
  p_method_detail   text default null,
  p_failure_reason  text default null,
  p_occurred_at     timestamptz default now(),
  p_provider        text default 'stripe'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
begin
  update public.payments
     set status         = p_status,
         method_detail  = coalesce(p_method_detail, method_detail),
         failure_reason = case
                            when p_status in ('failed', 'cancelled')
                            then p_failure_reason
                            else null
                          end,
         captured_at    = case
                            when p_status = 'succeeded'
                            then coalesce(captured_at, p_occurred_at)
                            else captured_at
                          end,
         refunded_at    = case
                            when p_status = 'refunded'
                            then coalesce(refunded_at, p_occurred_at)
                            else refunded_at
                          end,
         updated_at     = now()
   where provider = p_provider
     and provider_ref = p_provider_ref
     -- Monotonic: a late-arriving earlier event is recorded as seen but does
     -- not overwrite a further-along status.
     and public.payment_status_rank(p_status)
         > public.payment_status_rank(status)
  returning order_id into v_order_id;

  return v_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notification outbox.
--
-- enqueue_notification is called INSIDE the transaction that caused the event,
-- so an order that commits always has its mail queued and one that rolls back
-- never does. Sending happens later, in the notify Edge Function — a mail
-- provider being down then delays mail instead of failing checkout.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_notification(
  p_kind      text,
  p_recipient text,
  p_subject   text,
  p_payload   jsonb,
  p_locale    text default 'da'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_recipient is null or position('@' in p_recipient) = 0 then
    raise exception 'enqueue_notification needs an email address, got %', p_recipient;
  end if;

  insert into public.notification_outbox (kind, recipient, subject, payload, locale)
  values (p_kind, p_recipient, p_subject, p_payload, p_locale)
  returning id into v_id;

  return v_id;
end;
$$;

-- Hand a batch to one drain run.
--
-- `for update skip locked` is what makes overlapping cron ticks safe: the second
-- tick steps over rows the first is holding rather than waiting for them or,
-- worse, sending the same mail twice. Rows stuck in `sending` are reclaimed
-- after five minutes, because a function that dies mid-send would otherwise
-- strand its batch forever.
create or replace function public.claim_notifications(p_limit int default 25)
returns setof public.notification_outbox
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.notification_outbox o
     set status     = 'sending',
         claimed_at = now(),
         attempts   = o.attempts + 1
   where o.id in (
           select id
             from public.notification_outbox
            where status = 'pending'
               or (status = 'sending' and claimed_at < now() - interval '5 minutes')
            order by created_at
            limit p_limit
              for update skip locked
         )
  returning o.*;
$$;

create or replace function public.mark_notification_sent(p_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.notification_outbox
     set status = 'sent', sent_at = now(), last_error = null
   where id = p_id;
$$;

-- Five attempts, then it stops retrying and stays visible as `failed`. A row
-- that retries forever is a queue that never drains and an alert nobody reads.
create or replace function public.mark_notification_failed(p_id uuid, p_error text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.notification_outbox
     set status     = (case when attempts >= 5 then 'failed' else 'pending' end)
                        ::public.notification_status,
         last_error = p_error,
         claimed_at = null
   where id = p_id;
$$;

-- ---------------------------------------------------------------------------
-- Who may call these.
--
-- Nobody by default. `public` includes anon and authenticated, and a definer
-- function granted to public is a hole straight through RLS — anyone with the
-- publishable key could mark an order paid. Only service_role (the Edge
-- Functions) and the owner role Next connects as get execute.
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.record_stripe_event(text, text, jsonb)',
    'public.create_payment(uuid, text, numeric, bigint, text, text)',
    'public.apply_payment_event(text, public.payment_status, text, text, timestamptz, text)',
    'public.enqueue_notification(text, text, text, jsonb, text)',
    'public.claim_notifications(int)',
    'public.mark_notification_sent(uuid)',
    'public.mark_notification_failed(uuid, text)'
  ]
  loop
    execute format('revoke all on function %s from public', fn);
    -- These roles only exist on a Supabase database; skip them elsewhere.
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end;
$$;
