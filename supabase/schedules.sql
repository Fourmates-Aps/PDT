-- ---------------------------------------------------------------------------
-- Cron schedules for the Edge Functions.
--
-- NOT applied by `npm run db:bootstrap`. This file needs the project reference
-- and a Vault secret that only exist on a deployed project, so it is run by hand
-- once per environment:
--
--   psql "$DIRECT_URL" -v ref=<project-ref> -f supabase/schedules.sql
--
-- WHY VAULT AND NOT A LITERAL KEY. pg_cron stores each job's SQL in
-- cron.job, readable by anyone who can read that table. Pasting the service-role
-- key into the command would store a full RLS bypass in a queryable table and in
-- every database dump. vault.decrypted_secrets keeps it out of both.
--
-- Store the secret once, before running this file:
--
--   select vault.create_secret('<service-role-key>', 'service_role_key');
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Drains the notification outbox. Every minute: mail people are waiting for
-- should not sit for an hour, and an empty queue costs one cheap query.
-- Overlapping runs are safe — claim_notifications() uses `for update skip
-- locked`, so a slow run never causes a duplicate send.
select cron.unschedule('pdt-notify')
 where exists (select 1 from cron.job where jobname = 'pdt-notify');

select cron.schedule(
  'pdt-notify',
  '* * * * *',
  format(
    $job$
    select net.http_post(
      url     := %L,
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || (
                     select decrypted_secret from vault.decrypted_secrets
                      where name = 'service_role_key'
                   )
                 ),
      body    := '{}'::jsonb
    );
    $job$,
    format('https://%s.supabase.co/functions/v1/notify', :'ref')
  )
);

-- Supplier feeds, nightly at 04:15 UTC — after suppliers have posted the day's
-- file and long before anyone is working. It STAGES only; publishing stays a
-- human decision, so a malformed feed cannot empty a customer's shop overnight.
select cron.unschedule('pdt-import')
 where exists (select 1 from cron.job where jobname = 'pdt-import');

select cron.schedule(
  'pdt-import',
  '15 4 * * *',
  format(
    $job$
    select net.http_post(
      url     := %L,
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'Authorization', 'Bearer ' || (
                     select decrypted_secret from vault.decrypted_secrets
                      where name = 'service_role_key'
                   )
                 ),
      body    := '{}'::jsonb,
      -- The import fetches over FTPS and diffs a whole catalogue; the default
      -- 5s timeout would abandon every run before it started.
      timeout_milliseconds := 280000
    );
    $job$,
    format('https://%s.supabase.co/functions/v1/import-cron', :'ref')
  )
);

-- Housekeeping: stripe_events grows forever otherwise, and its only purpose is
-- to recognise a redelivery. Stripe retries for at most three days.
select cron.unschedule('pdt-prune-stripe-events')
 where exists (select 1 from cron.job where jobname = 'pdt-prune-stripe-events');

select cron.schedule(
  'pdt-prune-stripe-events',
  '40 3 * * *',
  $job$
  delete from public.stripe_events where received_at < now() - interval '30 days';
  $job$
);

select jobname, schedule from cron.job where jobname like 'pdt-%' order by jobname;
