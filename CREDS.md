# Logins — Profil Design Trading

> **LOCAL ONLY. NEVER COMMIT.** Listed in `.gitignore`.
> These are demo accounts for local development. Delete them before any real
> deployment — see *Removing them* at the bottom.

Sign in at **`/da/login`** (or `/en/login`).

All demo accounts share one password:

```
Demo!2026pdt
```

The `@demo.pdt.invalid` domain is reserved by RFC 2606 and is unroutable, so
these accounts can never receive mail.

---

## One login per role

Each lands on a different part of the app, because route guards send every role
to its own home.

| Role | Email | Lands on | Can do |
|---|---|---|---|
| **Employee** | `jens.nielsen@demo.pdt.invalid` | `/da/shop` | Browse the shop, cart, checkout, own orders |
| **Kunde-admin** | `demo-kundeadmin@demo.pdt.invalid` | `/da/dashboard/customer` | Employees, departments, tøjkonto, godkendelser, ordrer, indstillinger |
| **Key Account Manager** | `demo-kam@demo.pdt.invalid` | `/da/dashboard` | Create customer organisations, invite their admin |
| **Lager** | `demo-lager@demo.pdt.invalid` | `/da/dashboard` | Nothing yet — the warehouse surface is Phase 3 |
| **Platform admin** | `demo-admin@demo.pdt.invalid` | `/da/dashboard/customer` | Everything, across all organisations |

**Start with `demo-kundeadmin`** — it has the most built out.

`jens.nielsen` is the useful employee: he has **0 kr left** of a 1.500 kr
allowance, so any purchase demonstrates the account/personal split at checkout.
Top him up under Tøjkonto to test the other path.

---

## Your own account

| Email | Password | Role |
|---|---|---|
| `dev@fourmates.dk` | _(yours — not stored here)_ | `admin` |

It has **no organisation attached**, so customer-scoped pages will say "not
linked to a company". Attach it with:

```bash
npm run seed:demo -- --as dev@fourmates.dk
```

Then sign out and back in — role and organisation live in the auth token, so a
change only takes effect on the next sign-in.

---

## Other demo employees

Same password. All plain `employee`, all in Vognmand Hansen A/S.

```
mette.s.rensen@demo.pdt.invalid     camilla.berg@demo.pdt.invalid
ali.khan@demo.pdt.invalid           thomas.dahl@demo.pdt.invalid
peter.hansen@demo.pdt.invalid       line.poulsen@demo.pdt.invalid
morten.skov@demo.pdt.invalid
```

Useful for checking that one employee cannot see another's orders.

---

## Removing them

```bash
node scripts/seed-demo.mjs --clean       # organisation, members, orders
node scripts/seed-catalogue.mjs --clean  # imported products
```

`--clean` deletes every `@demo.pdt.invalid` user, including the role logins
above. It does not touch `dev@fourmates.dk`.

---

*Supabase keys, database URLs and third-party credentials are in `.env`, not
here. Keep it that way: one copy is easier to rotate than two.*
