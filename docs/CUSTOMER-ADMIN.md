# The Customer Admin — the company's own manager

> **Build order: 2nd.** Comes straight after the KAM dashboard.
> Plain-language spec for the rebuild. Companion to `KAM.md`.

---

## In one line

The customer admin works **at the client company, not at PDT**. Usually the HR
person, the office manager, or the foreman.

The KAM built the shop. This person **runs it day to day**: who gets a login, how
much they may spend, and what needs their signature.

---

## Where they sit in the flow

```
KAM creates the company and invites its admin
              │
              ▼
        ►  CUSTOMER ADMIN  ◄   adds people, sets budgets, approves orders
              │
              ▼
Employees order in their own shop
              │
              ▼
Anything over the limit comes back here for a yes or no
```

They are the **only role that is both a setup screen and a daily habit**. The KAM
touches a customer a few times a year; this person opens the dashboard every week.

---

## The 6 key functions

### 1. Add and remove people
Invite employees by email. When someone leaves, switch them off — their login dies,
their order history stays.

### 2. Organise into departments
Workshop, office, drivers, warehouse. Departments decide who reports to whom for
approvals, and let spend be read per team instead of one big number.

### 3. Hand out the clothing budget
Each employee gets an amount for the year — say 1,500 kr. The admin sets it, tops it
up, or gives a one-off extra when someone ruins a jacket. This is the screen they
open most.

### 4. Approve or reject orders
Anything above the company's limit stops and waits here. The admin sees who ordered
what, what it costs, and what budget they have left — then says yes or no.

### 5. Watch the spend
All orders across the company: what has been ordered, by whom, what stage it is at,
what it has cost this month and this year.

### 6. Set the house rules
The default allowance for new starters, the approval limit, whether staff see kroner
or points, and whether personal purchases are allowed.

---

## What the dashboard must do

### A. Overview — the home screen
The four things they came to check:

- **Waiting for you** — orders needing approval, front and centre with a count
- **Running low** — employees near the bottom of their budget, so a top-up happens
  before someone is stuck
- **Recent orders** — the last handful, with status
- **Spend this month** vs. the same month last year

### B. Employees
- The list: name, department, budget, spent, remaining, last sign-in
- Invite one person, or **import many at once from a spreadsheet** — a new customer
  arrives with 40 people, and typing 40 emails is where the setup dies
- Deactivate a leaver (never delete — the orders must stay)
- Re-send an invite that was never opened

### C. Departments
Create, rename, move people between them, and set the approver for each.

### D. Clothing account (budgets)
- Everyone's allowance in one table, editable in place
- **Bulk actions:** "give the whole workshop 2,000 kr", "reset everyone for the new year"
- A one-off extra with a reason written next to it
- History: what was granted, by whom, when

### E. Approvals
- One row per waiting order: who, what, how much, how much budget they have left
- **Approve** or **Reject with a reason** — a rejection with no reason turns into a
  phone call, which is what the system exists to avoid
- The employee is notified either way

### F. Orders
Every order in the company, filterable by person, department, status and date.
Click through to lines, tracking and the invoice.

### G. Settings
Default allowance · approval limit · kroner or points · personal purchases on/off ·
delivery addresses.

---

## Requirements — the rules the system must enforce

**Must**

1. They see **their own company and nothing else** — never another company's people,
   orders or spend.
2. Budgets are checked **on the server** at checkout. The remaining balance shown in
   the shop is a convenience; the truth is re-read when the order is placed.
3. A deactivated employee loses access immediately, but their orders and spend stay
   in the history.
4. Every budget change and every approval decision is **logged** — who, what, when,
   and why. This is money, and someone will ask.
5. Approving must work **on a phone**. It happens between meetings, on a site, in a
   van — not at a desk.
6. Two admins approving the same order at the same time must not both succeed.

**Must not**

- They cannot change prices or the product range. That is the KAM's job — the range
  and the prices are the agreement.
- They cannot see PDT's cost prices or margins.
- They cannot raise their own approval limit past what was agreed without PDT.

**Should**

- **Order on behalf of an employee.** A new starter needs boots before their login
  exists. Today that becomes a phone call to PDT.
- A deputy approver, so nothing stalls for two weeks in July.
- Export orders and spend to a spreadsheet for the finance department.
- A reminder when approvals have been waiting more than a day or two.

---

## Data they own

| What they manage | Where it lives |
|---|---|
| People and their roles | `organisation_members` |
| Teams | `departments` |
| Budgets per person per year | `employee_quotas` |
| Approve / reject decisions | `approval_requests` |
| Company rules and defaults | `organisations` |
| Their company's orders (read) | `orders`, `order_lines` |

---

## Screens to build, in order

1. **Employees + invite** — nothing else works until people exist
2. **Departments** — small, and the approvals screen needs it
3. **Clothing account** — budgets, or the shop has nothing to spend
4. **Settings** — the defaults the shop reads
5. *(build the employee shop here — orders start to exist)*
6. **Approvals** — needs orders
7. **Orders** — needs orders
8. **Overview** — build last; it is a summary of everything above, and summarising
   screens that do not exist yet is wasted work

---

## Open questions

- **Does unused budget roll over to next year, or reset to zero?** Changes how the
  quota period works, and it is a question every customer will ask on day one.
- **What happens to a leaver's unspent budget?** Nothing, probably — but it must be
  decided, not discovered.
- **Can a department have its own budget on top of the per-person one?** The schema
  already has `departments.budget_dkk`, but nothing reads it yet.
- **Who approves when the approver is away?** Without a deputy, orders stall.
- **Can the admin order for someone else?** Very likely yes — decide now, because it
  affects the shop and the order model, not just this dashboard.
