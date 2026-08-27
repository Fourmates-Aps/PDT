# The KAM — Key Account Manager

> Who they are, what they do, and what the system must give them.
> Plain-language spec for the rebuild.
>
> **Prerequisite:** the **Staff** screen in `PLATFORM-ADMIN.md` must be built
> first. Without it a platform admin cannot create a KAM account, and this
> dashboard ships with nobody able to sign in to it.

---

## In one line

The KAM is **PDT's salesperson**. They turn a company that asked for a quote into a
company with a working shop — and then stay responsible for that customer.

They are the **first dashboard in the build order**, because nothing else in the
system can exist until a KAM has created a customer company.

---

## Where they sit in the flow

```
Stranger fills in the quote form on the website
              │
              ▼
        ►  THE KAM  ◄   creates the company, sets prices, invites their admin
              │
              ▼
Company admin adds employees and budgets
              │
              ▼
Employees order in their own shop
```

The KAM is the bridge between "a lead" and "a live customer".

---

## The 6 key functions

### 1. Take the lead and open a customer
Turn an enquiry into a real company in the system: name, CVR, EAN, address,
contact person, payment terms.

### 2. Put the range together
Pick which products this customer's employees are allowed to see. A haulage firm
gets hi-vis and fleeces; an office gets polos and jackets. Nobody sees the full
catalogue — they see **their** catalogue.

### 3. Set the prices
Every customer has their own negotiated price for the same garment. The KAM sets
it, and the system checks it against the **minimum margin** for that customer so
nobody sells at a loss by accident.

### 4. Register the logo
Record the logo once, properly: placement (left chest, back, sleeve), method
(embroidery / print / transfer), size in millimetres, PMS colours, and the logo
file. This spec then travels with every future order — the print shop never guesses.

### 5. Set the rules of the shop
Yearly clothing allowance per employee, the limit above which an order needs
approval, whether staff see kroner or points, and whether personal purchases are
allowed at all.

### 6. Hand over and follow up
Invite the customer's own admin by email, then step back. Afterwards the KAM keeps
an eye on their accounts: what they spend, what is stalled, who needs a call.

---

## What the KAM dashboard must do

### A. Customer list — the home screen
- Every company this KAM owns, newest first
- Search by name or CVR
- Status at a glance: **Draft · Ready · Live · Paused**
- One button: **New customer**

### B. Create a customer (a wizard, not one big form)
Five steps, saveable half-finished — a KAM often fills this in over several days:

| Step | What is entered |
|---|---|
| 1. Company | Name, CVR, EAN, address, contact person, payment terms |
| 2. Range | Pick products from the catalogue (search, filter, bulk-select) |
| 3. Prices | Price per product, with live margin shown and a floor that blocks bad deals |
| 4. Logo | Upload file, set placement, method, size in mm, PMS colours |
| 5. Rules | Allowance, approval limit, kroner or points, personal purchases on/off |

Then: **Invite the customer's admin** — email + name, one click, invite sent.

### C. Preview before going live
The KAM must be able to **see the shop exactly as the customer's employee will see
it** before switching it on. Wrong price or missing product is far cheaper to find
here than after 40 people have ordered.

### D. Go live
An explicit switch. A customer is not live until the KAM says so — a half-built
shop must never be reachable.

### E. Follow-up view (per customer)
- Spend this month vs. last month
- Open orders and anything stuck
- Employees invited vs. actually signed in — low sign-ins means the customer needs a nudge
- Quick actions: re-invite the admin, adjust prices, pause the shop

---

## Requirements — the rules the system must enforce

**Must**

1. A KAM only ever sees **their own customers**, never another KAM's, and never the
   platform-wide screens.
2. Prices are **checked on the server** against the customer's minimum margin. Below
   the floor is blocked, and only a platform admin can override it.
3. Every price change and every rule change is **logged** — who, what, when. Money
   was discussed on a phone call; the system must be able to say what was agreed.
4. A customer cannot go live without: at least one product in the range, a price on
   every product in it, and a logo spec.
5. Invites expire and can be re-sent.
6. The wizard **saves as a draft at every step**. Losing a half-filled form loses a
   sales conversation.

**Must not**

- A KAM cannot see or change the shared product catalogue, supplier agreements, or
  cost prices across the platform — only what applies to their own customers.
- A KAM cannot see another customer's employees, orders or personal data.
- A KAM cannot delete a live customer. They can pause it; deleting is an admin job.

**Should**

- Bulk price setting: "apply +45% markup to everything in this range" rather than
  typing 200 prices.
- Copy an existing customer's setup as the starting point for a similar one.
- Export the agreed range and prices as a PDF to send with the quote.

---

## Data the KAM owns

| What they create | Where it lives |
|---|---|
| The company | `organisations` |
| Payment terms, allowance, approval limit, points-or-kroner, minimum margin | `organisations` |
| Which products they may buy | `org_assortment` |
| What each product costs them | `org_pricing` |
| The customer's admin login | `organisation_members` (invite) |
| The logo spec | (new — not yet in the schema) |

---

## Screens to build, in order

1. **Customer list** — the shell everything else hangs off
2. **Create customer, step 1** (company details) — enough to unblock every other dashboard
3. **Invite admin** — completes the minimum useful loop
4. **Range picker** (step 2)
5. **Pricing with margin guard** (step 3)
6. **Logo spec** (step 4)
7. **Rules** (step 5)
8. **Preview as employee**
9. **Go live switch**
10. **Follow-up view**

Steps 1–3 alone are enough for the customer-admin dashboard and the shop to be
built on top. The rest can land while those are in progress.

---

## Open questions

- **Does a KAM set prices per product, or a markup on a whole category?** Per product
  is precise but slow; a category markup is fast but blunt. Probably both, with
  per-product overriding the category.
- **Who owns a customer if the KAM leaves?** Needs a reassign action.
- **Can two KAMs share one large customer?** If yes, ownership becomes a list, not a
  single field — cheaper to decide now than to migrate later.
- **Is the quote itself part of the system,** or does it stay in email until the deal
  is signed? This decides whether the wizard starts at "lead" or at "won customer".
