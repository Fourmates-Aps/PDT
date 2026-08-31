# Supabase Edge Functions

Three functions run outside Next, on Deno.

| Function | Trigger | What it does |
| --- | --- | --- |
| `stripe-webhook` | Stripe | Verifies the signature, applies the payment event once |
| `notify` | `pg_cron`, every minute | Drains `notification_outbox` and sends the mail |
| `import-cron` | `pg_cron`, 04:15 UTC | Asks the Next app to stage supplier feeds |

## The one thing to understand first

An Edge Function **cannot import anything in `lib/`**. It is a different runtime
with its own dependencies, so Drizzle, the schema and every helper in this repo
are out of reach.

Rather than keep a second copy of the table knowledge in Deno and watch the two
drift, **the shared contract is SQL**. Both runtimes call the `security definer`
functions in `lib/db/sql/40-payment-functions.sql`, and neither writes
`payments`, `stripe_events` or `notification_outbox` directly. Those three tables
have RLS on with **zero policies**, so the functions are the only way in.

`import-cron` is the exception, and deliberately so: the import pipeline (FTPS,
CSV and XML parsing, the diff, staging) is several hundred lines of TypeScript in
`lib/import/`. Reimplementing it in Deno would mean two diffs that must agree
forever. The function calls `POST /api/internal/import` instead, authenticated
with a shared secret compared in constant time.

## Secrets

Nothing here is committed. `.env` and `CREDS.md` are gitignored, and no
credential is ever passed as a CLI argument — anything on a command line lands in
shell history and in `ps` output.

**Next needs** (in `.env` locally, in the host's environment in production):

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Creating PaymentIntents for the personal share |
| `PDT_CRON_SECRET` | Shared secret for `/api/internal/import`; 32+ random bytes |
| `PDT_OPS_EMAIL` | Where operational mail goes when there is no specific human |

**The functions need** (`supabase secrets set NAME=value`):

| Variable | Used by | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `stripe-webhook` | Constructing the Stripe client |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | Verifying the signature (`whsec_…`) |
| `RESEND_API_KEY` | `notify` | Sending mail |
| `PDT_MAIL_FROM` | `notify` | Verified sender address |
| `PDT_OPS_EMAIL` | `stripe-webhook` | Payment receipts to operations |
| `PDT_APP_URL` | `import-cron` | Base URL of the Next app |
| `PDT_CRON_SECRET` | `import-cron` | Must match Next's value |
| `PDT_IMPORT_SUPPLIERS` | `import-cron` | Comma-separated, defaults to `FRISTADS` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the Edge runtime.
The service-role key bypasses RLS completely: it must never reach a browser, and
no value taken from a request may decide which function runs.

## Deploying

```bash
supabase functions deploy stripe-webhook
supabase functions deploy notify
supabase functions deploy import-cron
```

`stripe-webhook` is deployed with `verify_jwt = false` (see `config.toml`).
That is not an oversight — Stripe cannot present a Supabase JWT, so the
signature over the raw body is the authentication. Turning JWT verification on
would mean Stripe receives 401s and payments silently stop being recorded.

Then point Stripe at
`https://<ref>.supabase.co/functions/v1/stripe-webhook` and subscribe to:

```
payment_intent.succeeded
payment_intent.payment_failed
payment_intent.canceled
payment_intent.processing
charge.refunded
```

## Scheduling

Once per environment, after storing the service-role key in Vault:

```sql
select vault.create_secret('<service-role-key>', 'service_role_key');
```

```bash
psql "$DIRECT_URL" -v ref=<project-ref> -f supabase/schedules.sql
```

The key goes in Vault rather than into the job body because `cron.job` stores
each job's SQL as readable text — a literal key there would sit in the table and
in every database dump.

## Checking it works

```bash
npm run check:payments    # the SQL contract: idempotency, ordering, permissions
npm run check:functions   # deno type-checks all three functions
supabase functions serve  # run them locally
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

`npm run check:payments` covers the two behaviours that only appear under
conditions a manual test never reproduces: a webhook delivered twice, and two
webhooks delivered out of order.
