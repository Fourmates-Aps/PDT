# The Employee Shop — where the ordering actually happens

> **Build order: 3rd.** After `KAM.md` and `CUSTOMER-ADMIN.md`.
> Plain-language spec for the rebuild.

---

## In one line

This is the only screen a **normal person** ever uses — a fitter, a driver, an
office worker who needs a new jacket.

It is not a dashboard. It is a small, private webshop that shows **only their
company's clothes, at their company's prices, inside their own budget.**

---

## Why it is third

The two dashboards before it **create the conditions**; this screen **creates the
orders**. Everything after it — approvals, the production board, invoicing — has
nothing to work on until an employee has pressed *Place order*.

```
KAM              → the company and its prices exist
Customer admin   → the people and their budgets exist
►  EMPLOYEE SHOP ◄  → ORDERS exist
Warehouse        → orders get made and shipped
```

It also has **hundreds of users where the dashboards have a handful**, and it is
the screen the customer judges the whole platform on.

---

## What makes it different from a normal webshop

Five things. Get these right and the rest is ordinary e-commerce.

### 1. There is no browsing without logging in
No public catalogue, no guest checkout. You sign in, and the shop is already yours.

### 2. You only see your own company's range
The KAM picked it. A haulage firm sees hi-vis and fleeces. An office sees polos.
Nobody sees the full catalogue, and nobody sees another company's prices.

### 3. Your budget is always on screen
"1,240 kr left of 1,500" sits at the top of every page. In points mode it says
"620 points left" and kroner are never shown at all.

### 4. Checkout splits the bill automatically
Whatever fits inside the budget goes on the **company account**. Anything above it,
the employee pays themselves with **MobilePay**. One basket, one checkout, two
payers — and the employee must be able to see plainly which part is which.

### 5. The logo is already decided
The employee picks placement (left chest, back, sleeve) and method (embroidery or
print) from the company's own design manual. They cannot upload a logo or invent a
placement — that was agreed once, by the KAM.

---

## The screens

### A. The shop
- Products in the company's range, with categories and a search
- Colour and size on the card, price or points depending on the mode
- **Budget bar pinned at the top**
- **"Order again"** — the single most used feature. Same boots, same size, two clicks.

### B. Product page
- Photos, colour switch, size picker
- **Sizes that are actually available** — a size that cannot be delivered must not be
  selectable
- Logo choice: placement + method, with the surcharge shown
- **"Find my size"** — chest measurement in, suggested size out
- Price, or points, and what it leaves of the budget

### C. Cart
- Lines with size, colour and logo spelled out
- A running total against the budget, and a clear warning the moment it goes over
- Edit quantity, remove, keep the cart between sessions

### D. Checkout
The one screen that must be unmistakable:

- **The split, in words:** "Company pays 1,240 kr · You pay 310 kr"
- Delivery address (company, department, or home)
- MobilePay for the personal part
- If the order needs approval, say so **before** the button: *"This order goes to
  your manager for approval"*
- Confirm → order number

### E. My orders
- Status in plain language: Approved · In production · Packed · Shipped · Delivered
- Track & trace link
- What was ordered, in what size, with which logo
- **Start a return or exchange** — wrong size is the most common reason

### F. Size guide
Per brand, plus the measurement calculator. Fewer wrong sizes means fewer returns,
which is where the money leaks.

---

## Requirements — the rules the system must enforce

**Must**

1. **The server decides the price.** Never the browser. Prices are re-read from the
   customer's price list when the order is placed.
2. **The server decides the budget.** The bar on screen is a convenience; the real
   balance is re-read at checkout.
3. An employee sees **their own orders only** — never a colleague's.
4. Two orders placed at the same moment must not both spend the last of a budget.
5. Pressing *Place order* twice must not create two orders.
6. Stock is checked before the order is accepted, not after.
7. **Mobile first.** Most employees order on a phone, often on a site, sometimes on
   a bad connection.
8. Points mode hides kroner from the employee everywhere — including emails.

**Must not**

- No public product pages, no guest checkout, no search engine indexing.
- No uploading logos or inventing placements.
- No ordering outside the company's range, at any price.

**Should**

- Save a size profile, so the right size is pre-selected next time.
- Show CO₂ per item and a total for the order.
- Suggest a lower-CO₂ alternative in the same category.
- Colleague fit reviews — "runs small" is worth more than any size chart.

---

## Data it touches

| What | Where |
|---|---|
| What they may see | `org_assortment` |
| What it costs them | `org_pricing` |
| What they have left | `employee_quotas` |
| What they ordered | `orders`, `order_lines` |
| Whether it needs a signature | `approval_requests` |
| Who they are | `organisation_members` |

---

## Screens to build, in order

1. **Product list** with the company's range and the budget bar
2. **Product page** with size, colour and logo choice
3. **Cart**
4. **Checkout with the split** — the heart of the whole thing
5. **Order confirmation and My orders**
6. *(now go back and finish Approvals + Orders in the customer-admin dashboard)*
7. **Order again**
8. **Size guide and find-my-size**
9. **Returns and exchange**

Steps 1–5 are the minimum that makes the platform real. Everything after is
friction removal — valuable, but not blocking.

---

## Open questions

- **What happens when the budget runs out and personal purchases are switched off?**
  Block the order, or send it for approval? The kinder answer is approval.
- **Does the logo surcharge come out of the employee's budget or the company's?**
  It is currently hard-coded in `lib/shop/logo.ts` as a placeholder — the real
  design manual table does not exist yet.
- **Can an employee order for a colleague?** A foreman kitting out a new starter
  will try. Related to the same question in `CUSTOMER-ADMIN.md`.
- **Is MobilePay taken at checkout, or when the goods ship?** Danish practice is to
  capture on dispatch, and it changes the whole payment flow.
- **Home delivery or company address only?** Home delivery is popular and quietly
  drags GDPR and shipping cost in with it.
