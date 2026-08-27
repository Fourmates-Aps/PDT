# The Platform Admin — PDT's own control room

> **Build order: 5th — with one exception.**
> The **Staff** screen must be built FIRST, before `KAM.md`. See below.
> Plain-language spec for the rebuild.

---

## In one line

This is **PDT itself** — the owners and the office. Everyone else in the system
works inside one company or one job. The admin sees **across all of it**: every
customer, every product, every supplier, every krone of margin.

---

## The exception: Staff comes first

Every account in this system is handed down from the level above:

```
Platform admin   ← seeded once by a script on the server
      │  creates
      ▼
KAM  ·  Warehouse  ·  other admins
      │  creates
      ▼
Customer admin
      │  creates
      ▼
Employee
```

The very first admin is seeded with `npm run seed:admin`. That works — once.

**But there is currently no screen where that admin can create a KAM.** The invite
system only allows employees and customer admins. So a KAM account can only be made
by running a script on the server, which means the KAM dashboard would be finished
with nobody able to sign in to it.

**Therefore:** build the Staff screen as part of the foundation, before anything
else. It is one small screen and it unblocks the entire chain.

### Staff — what it needs

- A list of PDT's own people: name, email, role, active, last sign-in
- **Add a staff member:** email + name + role (KAM · Warehouse · Admin) → invite sent
- Change someone's role
- Deactivate a leaver — access gone, their history intact
- Re-send an invite that was never opened

**Rules:**
- Only a platform admin can create or change staff. Nobody else, ever.
- You cannot remove your own admin rights, and the last admin cannot be deactivated
  — otherwise the system locks everyone out and only a server script can rescue it.
- Every staff change is logged: who, what, when.
- Staff accounts belong to PDT, not to a customer company.

That is the whole of step zero. The rest of this document is the 5th build.

---

## Why the rest comes last

It is the biggest dashboard and the most complex — and for the first months PDT can
do most of it by hand or by script. A handful of internal people importing a product
feed manually is survivable. A broken employee shop is not.

Build it once the four dashboards above are real and you know what they actually
need from it.

---

## The 6 key functions

### 1. Own the product catalogue
The master list of everything PDT can sell, pulled from supplier feeds. Products,
variants, sizes, colours, images, EAN, cost price, CO₂. The KAM picks from this;
the admin maintains it.

### 2. Approve catalogue updates
Suppliers send new files — new products, discontinued ones, changed prices. The
admin sees a **summary of what changed before it goes live**, then approves or
rejects. A price feed that publishes itself is how a customer gets charged last
year's price for next year's jacket.

### 3. Manage suppliers
Who they are, how orders reach them (EDI, GraphQL, FTP, portal, email), how product
data arrives, minimum order values and lead times.

### 4. Send supplier orders
Demand from customer orders collects into a **basket per supplier**. When the
supplier's minimum is met, the admin releases it. Then tracks confirmation and
receipt.

### 5. Guard the margins
The cost side of every price. Which customers are priced below the floor, which
products lose money, what the real contribution margin is per customer.

### 6. See everything
All customers, all orders, all stages, across the whole platform — plus the ability
to step into any customer to help when something is wrong.

---

## The screens

### A. Overview
Orders today · late orders · supplier baskets ready to send · catalogue updates
waiting · customers priced below the floor.

### B. Staff
See above. Built first.

### C. Customers
Every company, which KAM owns it, live or paused, spend, margin. Step into any one
of them to see what they see.

### D. Catalogue
- Products and variants, searchable
- Cost price, sale price, margin per variant
- Images, sizes, colours, EAN, CO₂
- Bulk edit — nobody hand-edits 12,000 variants

### E. Catalogue updates
- Incoming supplier files waiting for a decision
- **See the diff before approving:** new items, discontinued items, price changes up
  and down
- Approve and publish, or reject

### F. Suppliers
Contact details, channels for orders and for data, minimum order value, lead time,
feed status and when it last ran.

### G. Supplier orders
The baskets: what is accumulating, what has met its minimum and is ready, what has
been sent, confirmed, received.

### H. Pricing
The margin floor per customer, override when a deal genuinely justifies it, and a
list of everything currently priced below it.

---

## Requirements — the rules the system must enforce

**Must**

1. **Nothing publishes itself.** Supplier feeds land as a proposal with a visible
   diff. A human approves before it reaches a live shop.
2. Every price change, catalogue publish, staff change and override is logged with
   who and when.
3. The last active admin cannot be deactivated.
4. Stepping into a customer to help is **logged and visible** — support access is
   not silent surveillance.
5. Cost prices and margins are admin-only. Not KAMs, not the warehouse, never a
   customer.
6. A supplier order cannot be released twice.

**Must not**

- No auto-publishing a feed straight to live shops.
- No deleting orders, customers or products that have history — deactivate instead.
- No editing an order's price after it has been placed. Refund or credit it.

**Should**

- Feed health: which suppliers ran, which failed, which have gone quiet.
- Alerts when a supplier's cost price jumps enough to break a customer's margin.
- Export for finance and for the accounting system.

---

## Data it owns

| What | Where |
|---|---|
| Every product and variant | `products`, `product_variants` |
| Suppliers and their channels | `suppliers` |
| Supplier baskets and lines | `supplier_orders`, `supplier_order_lines` |
| Margin floors and overrides | `organisations.minimum_dg_pct` |
| Every company | `organisations` |
| PDT's own people | `organisation_members` (staff roles) |
| Catalogue updates awaiting approval | (new — does not exist yet) |

---

## Screens to build, in order

**Step zero, before everything:**
1. **Staff** — or nobody can log into any dashboard you build

**Then, as the 5th build:**
2. Customers list — read only, across the platform
3. Catalogue browse and edit
4. Suppliers
5. Supplier baskets and release
6. Catalogue updates with the diff
7. Pricing and margin guard
8. Overview — last, because it summarises all of the above

---

## Open questions

- **Who presses send on a supplier basket — admin or warehouse?** The basket exists;
  nobody owns releasing it.
- **How often do feeds run, and what happens when one fails silently?** A feed that
  quietly stops is worse than one that errors loudly.
- **Where does the per-customer design manual live?** The KAM creates it, the shop
  reads it, the warehouse prints from it — and the table does not exist yet. It is
  the single biggest gap in the schema.
- **Do cost prices come from the feed, or are they negotiated per supplier?** Margin
  maths depends on the answer.
- **Does PDT hold stock at all, or is everything ordered in per customer order?**
  This decides whether stock is a real feature or just a number from a supplier feed.
