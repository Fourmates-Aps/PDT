# The Warehouse — where orders become parcels

> **Build order: 4th.** After `KAM.md`, `CUSTOMER-ADMIN.md` and `EMPLOYEE-SHOP.md`.
> Plain-language spec for the rebuild.

---

## In one line

This is **PDT's own floor staff** — the people who print the logo, pack the box and
put it on the GLS van.

They do not sell anything and they do not talk to customers. They answer one
question, all day: **what do I do next?**

---

## Why it is fourth

It is the first screen that can only exist once **real orders do**. Until an
employee has ordered, this dashboard is five empty columns.

```
KAM              → the company exists
Customer admin   → the people and budgets exist
Employee shop    → the orders exist
►  WAREHOUSE  ◄     → the orders become parcels
Platform admin   → runs the machine behind all of it
```

It is also the **smallest dashboard in the system** — two screens — and the one that
gives PDT's own staff the most immediate relief. Today this job runs on printed
emails.

---

## Who uses it, and how

Not at a desk. Standing up, at a packing bench, often with a scanner in one hand and
a garment in the other. Sometimes with gloves on.

That shapes everything: **big touch targets, few clicks, no typing where a scan will
do, and readable from a metre away.**

---

## The 4 key functions

### 1. See the work in order
Every live order laid out by stage, oldest and most urgent first. Nothing hidden in
a menu.

### 2. Move an order forward
Print done → packing. Packed → shipped. One tap per move, and the customer's status
updates the moment it happens.

### 3. Pack correctly
The pack screen tells the packer exactly what goes in the box: which garment, which
size, which colour, **which logo, in which placement, in which method**. Scan to
confirm, so the wrong size never leaves the building.

### 4. Ship it
Create the GLS label, attach the parcel number, and the tracking link appears in the
employee's *My orders* by itself.

---

## The screens

### A. The production board
Five columns, left to right, matching the real order stages:

```
Approved  →  Print / embroidery  →  Packing  →  Shipped  →  Delivered
```

- One card per order: customer, employee, number of items, and **when it is due**
- Cards go red when late, amber when due today or tomorrow
- Move a card by tapping the next stage
- **An order with no logo skips print entirely** and goes straight to packing —
  forcing it through a stage nobody works on is how a board stops being trusted
- One step backwards is allowed while the goods are still in the building, because
  "I moved the wrong card" is the most common mistake. **Nothing moves back out of
  shipped** — the parcel has gone.

### B. Pack & ship
The bench screen, one order at a time:

- The full pick list: garment, size, colour, quantity
- **The logo spec spelled out** — placement, method, size in mm, colours
- Scan each item to confirm it is in the box
- Delivery address, and whether it is company, department or home
- **Create GLS label** → parcel number captured → order marked shipped

---

## Requirements — the rules the system must enforce

**Must**

1. **The board is a view of real order status, not a second copy of it.** A card
   moved here is the same status the employee and the customer admin see. Two
   sources of truth is how a warehouse stops believing the screen.
2. Only legal moves are offered. You cannot jump from approved straight to
   delivered.
3. **Shipping requires a parcel number.** No number, no shipped — otherwise the
   tracking link is a dead end and the phone rings.
4. Every move is logged: who moved it, from what, to what, when.
5. Two packers must not be able to pack the same order at once.
6. Nothing here shows prices, margins or customer budgets. It is not their job and
   it should not be on a screen on the floor.
7. Works on a tablet, in portrait, with large targets.

**Must not**

- Warehouse staff cannot edit prices, orders, people or the catalogue.
- They cannot see other customers' commercial terms.
- They cannot cancel or refund an order — that is an admin decision.

**Should**

- A printable pick list for the days the tablet is flat.
- Batch shipping: label several parcels for the same company in one go.
- A partial dispatch, when one item of five is on back-order.
- A simple day count: how many orders shipped today.

---

## Data it touches

| What | Where |
|---|---|
| Which orders are live and at what stage | `orders.status` |
| What is in the box | `order_lines` |
| The logo spec on each line | `order_lines` (embellishment) |
| Parcel number and tracking | `orders` |
| Where it goes | `orders` (delivery address) |

Note the shape: the warehouse **reads almost everything and writes almost nothing**
— only the stage and the parcel number. That is what keeps it safe to put on a
shared screen on the floor.

---

## Screens to build, in order

1. **The board** — read only, just to see the work laid out
2. **Move a card** — the stage transitions with their rules
3. **Pack screen** with the pick list and the logo spec
4. **Scan to confirm**
5. **GLS label and parcel number**
6. **Partial dispatch and batch shipping**

Steps 1–3 already replace the printed email. Steps 4–5 are what make it accurate.

---

## Open questions

- **Where does the delivery date come from?** Right now it is derived from the
  "2–4 working days" promise on the website — there is no agreed date on an order
  yet. If a customer is ever promised a specific date, that needs a real column.
- **Is print and embroidery done in-house or sent out?** If it is sent out, the
  Print column is not a stage staff work in, it is a stage they *wait* on — a
  different screen entirely.
- **What happens when an item is out of stock at packing?** Split the order, hold
  it, or substitute? This is where a warehouse screen either helps or starts a
  phone call.
- **Does the warehouse trigger the supplier order,** or does that belong to the
  platform admin? The supplier basket exists, but nobody owns pressing send.
- **Returns:** who receives the parcel coming back, checks it and approves the
  refund? Currently unowned.
