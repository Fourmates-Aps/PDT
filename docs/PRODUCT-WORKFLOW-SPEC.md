# Product Workflow & Business Process Specification

**Product:** Profil Design Trading Platform
**Owner:** Profil Design Trading ApS (CVR 35657886) — showrooms Vejle, Billund, Fredericia, Skjern
**Document status:** Draft for stakeholder verification
**Purpose:** Reconstruct the intended product behaviour from all available evidence, so stakeholders can confirm — or correct — how the product is supposed to work before it is built.

---

## How to read this document

Every material statement carries an evidence tag. **Nothing in this document is invented.** Where the evidence runs out, the document says so rather than filling the gap.

| Tag | Meaning |
|---|---|
| **[C] Confirmed** | Demonstrated by prototype behaviour **and** supported by documentation. |
| **[D] Documented** | Stated in a written requirement, but not present in the prototype. |
| **[P] Prototype** | The prototype does this, but no document describes it. |
| **[I] Inferred** | Strongly implied by the evidence, but never stated. **Requires confirmation.** |
| **[U] Unknown** | Not determinable from the available evidence. |

### Source key

| Code | Source |
|---|---|
| `PRD` | `prototype/PRD.md` — Product Requirement Document v1.0.0, marked "Approved for Production Specification" |
| `DEV` | `prototype/DEV_BRIEF_IMPLEMENTATION_PLAN.md` — technical implementation plan |
| `HAND` | `prototype/Profil_Design_Trading_Overdragelse.md` — prototype handover notes (Danish) |
| `REV` | `prototype/Critical_review_and_development_ideas.md` — prototype audit + idea backlog |
| `SUP-CAP` | `prototype/Supplier_data_capabilities.md` |
| `SUP-IMP` | `prototype/Supplier_data_import_notes.md` |
| `SUP-INT` | `SuuplierIntegration.md` *(repo root; filename is misspelled)* — internal build note, the most current and most detailed integration source. See **Appendix B**. |
| `KAM` · `CA` · `EMP` · `WH` · `PA` | `docs/KAM.md`, `CUSTOMER-ADMIN.md`, `EMPLOYEE-SHOP.md`, `WAREHOUSE.md`, `PLATFORM-ADMIN.md` — plain-language rebuild specs |
| `PROTO:<view>` | A named view in `prototype/ProfilDesignTrading_Platform.html` (e.g. `PROTO:medshop`) |

> **A note on the two documentation generations.** `PRD` and `DEV` describe the product as originally specified. The five `docs/*.md` role specs are a **later rewrite** that in several places deliberately narrows or contradicts the earlier documents. Where they disagree, this specification records both and asks stakeholders to choose. It does not assume the newer document wins.

---

# 1. Executive Summary

## 1.1 What the product is

A **multi-tenant B2B platform for corporate workwear**. Profil Design Trading (PDT) distributes workwear, corporate apparel and business gifts. Today its customers order by email, phone and spreadsheet. The platform replaces that with a private webshop per customer company, plus the internal machinery to fulfil what those shops sell. `[C]` — PRD §1.2, HAND §1

## 1.2 Who uses it

Six distinct audiences, in three groups:

- **PDT's customers' staff** — the employee who needs a jacket, and the office manager who runs their company's shop.
- **PDT's own staff** — the salesperson (KAM), the warehouse floor, and the owners/office (platform admin).
- **The public** — anyone browsing indicative prices before becoming a customer. `[C]` PRD §3, HAND §2, PROTO:`NAV`

## 1.3 The central business idea

One sentence: **a company agrees a range, prices and a budget once; its employees then serve themselves inside those rules, and everything downstream happens automatically.**

The four mechanisms that make that work, and which the whole product hangs on:

1. **Per-customer range and price.** Every customer sees only their own catalogue at their own negotiated price. `[C]` KAM §2–3, PROTO:`katalog`, PROTO:`opret`
2. **Per-employee budget with automatic split.** What fits the budget goes on the company account; the overage is paid personally. One basket, two payers. `[C]` PRD §4.4.1, EMP §4, PROTO:`confirmSplit`
3. **The logo agreed once, applied every time.** Placement, method, size in millimetres and PMS colours are recorded per customer and travel with every order, so the print shop never guesses. `[C]` PRD §4.3.1, KAM §4, PROTO:`designmanual`
4. **Margin floor enforced in software.** A KAM cannot activate a shop priced below the customer's agreed minimum contribution margin. `[C]` PRD §4.1.2, PROTO:`activateShop`

## 1.4 The end-to-end chain

```
Public enquiry ──► KAM creates customer, range, prices, logo ──► invites customer admin
                                                                        │
        Customer admin adds employees, budgets, house rules ◄────────────┘
                            │
                            ▼
        Employee orders in their own shop  ──►  over the limit? ──► approval
                            │                                          │
                            ▼                                     yes/no
        Order enters production ──► print/embroidery ──► pack ──► GLS ──► delivered
                            │                                              │
                            ▼                                              ▼
        Demand stock cannot cover ──► pooled per supplier ──► ordered   Invoice → e-conomic
```
`[C]` — assembled from PRD §4, DEV §5–8, HAND §3, and the five role specs. Each segment is documented in §8.

## 1.5 What stakeholders most need to decide

Five questions block implementation. Each is expanded in §16.

| # | Question | Why it blocks |
|---|---|---|
| **Q-A** | **Is there a public shop, or not?** | `PRD` and the prototype have one; `EMP` forbids it outright. This changes the auth model, SEO, and whether a sixth role exists at all. |
| **Q-B** | **How many approval steps — one, two or three?** | Three different models exist across the evidence. Determines the data model, not just a screen. |
| **Q-C** | **What are the order stages, exactly?** | Four different stage lists exist. Every downstream screen and the customer's status tracker depend on one answer. |
| **Q-D** | **Is a visual proof mandatory before production?** | `DEV` says mandatory, no bypass. No other source mentions the gate. Adds a blocking stage and a customer-facing loop. |
| **Q-E** | **When is the invoice raised — at checkout, at dispatch, or in a daily batch?** | The prototype does all three in different places. Determines the finance integration. |

---

# 2. Scope

## 2.1 Covered

- All six user roles found in the evidence, their permissions and their journeys.
- The business entities, their lifecycles and state transitions.
- Every end-to-end workflow that can be reconstructed.
- Business rules, classified by confidence.
- Conflicts between the prototype and the documentation.
- Known gaps and unresolved behaviour.

## 2.2 Not covered

- **Visual and interaction design.** Colours, typography and layout are out of scope except where they change behaviour. Brand direction lives in `docs/brand-guidelines.md`.
- **Non-functional requirements.** Performance, uptime, encryption and GDPR mechanics are specified in `PRD §5` and not restated here.
- **Technical architecture.** Database schema, RLS policies and API design live in `DEV §1–3`.
- **Integration field specs.** Endpoints, file layouts and credentials live in `SUP-INT` and the suppliers' own documentation. **Appendix B** maps each integration to the workflow, entity and screen it serves — it does not restate the field specs.
- **Pricing of the product itself** (what PDT charges customers to use the platform). Not addressed in any source. `[U]`

## 2.3 Sources analysed

All fourteen documents in `prototype/`, `docs/` and the repository root, and the full prototype (`ProfilDesignTrading_Platform.html`, ~2,000 lines, ~60 view functions, six role configurations).

## 2.4 A third evidence source: the partial implementation

A Next.js implementation exists in this repository and is materially further along than the prototype in some areas (server-enforced pricing, budget reservation, role guards, supplier pooling). Where it **resolves** an ambiguity it is noted as `[P-impl]`. It is **not** treated as a requirement — it is one team's reading of the same evidence, and stakeholders are being asked to confirm the intent, not the code.

---

# 3. User Roles

Six roles are evidenced. The prototype's role selector defines exactly six; `PRD §3` lists the same six; `DEV §4.1` defines only five.

## 3.1 Guest (public, unauthenticated)

| | |
|---|---|
| **Prototype id** | `gaest` — "Offentlig adgang · vejledende priser" |
| **Purpose** | Let a prospective customer see the range and indicative prices, put their logo on a garment, and ask for a quote. |
| **Can do** | Browse a public product grid; use the size guide; use the logo visualiser; request a quote. `[C]` PROTO:`pubshop`, `NAV.gaest` |
| **Cannot do** | See any customer's agreed prices; order anything; see cart or favourites (removed for guests in the audit). `[C]` REV §2 |
| **Status** | **DISPUTED.** `EMP` states: *"There is no browsing without logging in. No public catalogue, no guest checkout."* `DEV §4.1` omits the role entirely. `PRD` Phase 4 schedules "Finalize B2C Guest webshop and RFQ flow". |

> **⚠ Conflict Q-A.** The role exists in the prototype and the PRD, and is explicitly forbidden by the employee-shop specification. **Stakeholder decision required.**

## 3.2 Employee

| | |
|---|---|
| **Prototype id** | `medarb` — demo persona "Jens Nielsen · Vognmand Hansen" |
| **Works for** | The customer company, not PDT. |
| **Purpose** | Order their own workwear inside the budget their employer set. |
| **Volume** | *"Hundreds of users where the dashboards have a handful"* — and the screen the customer judges the platform on. `[C]` EMP |
| **Can do** | See their company's range only; see their own budget; choose size, colour and logo placement; order; pay any overage personally; see their own order history and tracking; start a return; use the size guide. `[C]` EMP, PROTO:`medshop` `medkonto` `medordrer` `retur` `sizeguide` |
| **Cannot do** | See other companies' products or prices; see a colleague's orders; upload a logo or invent a placement; order outside the company's range at any price; see kroner at all when the company is in points mode. `[C]` EMP "Must not" |
| **Device** | Mobile first — *"most employees order on a phone, often on a site, sometimes on a bad connection."* `[C]` EMP |

**⚠ Prototype-only capabilities.** `NAV.medarb` also gives the employee: **AI fitting room**, **Quotes** (`tilbud`), **Brand library** (`brandbib`), **Proofing & orders** (`korrektur`), and **Analytics** (`aianalytics`). These are commercial and production tools. `EMP` lists none of them and describes the employee surface as *"not a dashboard… a small, private webshop."* `[P]`

> **Open question O-1:** Were these placed on the employee role in the prototype deliberately, or as a convenience for demoing? If deliberate, which employee — a foreman? a purchasing lead? — is meant to build quotes and approve proofs?

## 3.3 Customer Admin

| | |
|---|---|
| **Prototype id** | `kadmin` — "Lene Admin · Vognmand Hansen A/S" |
| **Works for** | The customer company. Typically HR, the office manager or a foreman. `[C]` CA |
| **Purpose** | Run the shop day to day: who gets a login, how much they may spend, what needs a signature. |
| **Rhythm** | *"The only role that is both a setup screen and a daily habit."* `[C]` CA |
| **Can do** | Invite and deactivate employees; bulk-import employees from a spreadsheet; create departments and set their approver; set and top up clothing budgets; approve or reject orders; view all company orders and spend; set house rules (default allowance, approval limit, kroner-or-points, personal purchases on/off); edit each department's assortment package. `[C]` CA, PROTO:`kadash` `medarbejdere` `afdelinger` `toejkonto` `godkend` `ordrer` `indstillinger` |
| **Cannot do** | Change prices or the product range — *"that is the KAM's job; the range and the prices are the agreement"*; see PDT's cost prices or margins; raise their own approval limit beyond what was agreed with PDT. `[C]` CA "Must not" |
| **Scope** | Their own company and nothing else, ever. `[C]` CA rule 1 |

**⚠ Conflict.** `CA` says the customer admin **cannot** change the product range. `PROTO:afdelinger` lets them toggle products in and out of each department's package, and persists it. Either the department package is a permitted *subset* of the KAM's range (likely), or the prototype grants more than intended. `[I]` — **needs confirmation** (O-2).

## 3.4 Key Account Manager (KAM)

| | |
|---|---|
| **Prototype id** | `kam` — "Frederik Kjærulff · PDT" |
| **Works for** | PDT. This is the salesperson. |
| **Purpose** | Turn a company that asked for a quote into a company with a working shop, then stay responsible for it. `[C]` KAM |
| **Can do** | Create a customer (company details, CVR, EAN, address, contact, payment terms); select the range; set prices with a live margin check; register the logo specification; set the shop's rules; invite the customer's admin; run a sales pipeline; follow up on their accounts (visits, gifts, dormancy). `[C]` KAM, PROTO:`kamdash` `pipeline` `opret` `designmanual` `kamfollow` |
| **Cannot do** | Activate a shop below the minimum margin — **hard block, no override** `[C]` PROTO:`activateShop`; see another KAM's customers; see the shared catalogue, supplier agreements or cost prices across the platform; see another customer's employees or personal data; delete a live customer (pause only). `[C]` KAM "Must not" |
| **Prototype restriction** | The prototype's KAM menu is deliberately narrow: overview, pipeline, create shop, design manual, follow-up. `[C]` HAND §2 — *"Begrænset"* |

## 3.5 Warehouse

| | |
|---|---|
| **Prototype id** | `lager` — "Lager · Vejle" |
| **Works for** | PDT. Floor staff: print the logo, pack the box, put it on the van. |
| **Purpose** | Answer one question all day: **what do I do next?** `[C]` WH |
| **Can do** | See every live order laid out by stage; move an order to the next stage; see the full pick list including the logo specification; scan to confirm; create the GLS label and capture the parcel number. `[C]` WH, PROTO:`packship` `lager` `vareflow` |
| **Cannot do** | Edit prices, orders, people or the catalogue; see other customers' commercial terms; cancel or refund an order. **Nothing here shows prices, margins or budgets** — *"it is not their job and it should not be on a screen on the floor."* `[C]` WH rule 6 |
| **Device** | Standing at a packing bench, scanner in one hand, garment in the other, sometimes with gloves on. Large targets, few clicks, readable from a metre. `[C]` WH |
| **Write surface** | *"Reads almost everything and writes almost nothing — only the stage and the parcel number."* `[C]` WH |

## 3.6 Platform Admin

| | |
|---|---|
| **Prototype id** | `pdt` — "Rikke S. Ulriksen · PDT" |
| **Works for** | PDT. The owners and the office. |
| **Purpose** | *"Everyone else works inside one company or one job. The admin sees across all of it."* `[C]` PA |
| **Can do** | Everything. Specifically: own the master catalogue; approve incoming supplier catalogue updates before they publish; manage suppliers and their channels; release supplier orders; set pricing and margin floors; create PDT's own staff accounts; see all customers and step into any of them; the full finance suite; the role/module matrix; audit log; integrations; branding and campaigns. `[C]` PA, HAND §2, PROTO:`NAV.pdt` (≈40 views across 8 sections) |
| **Cannot do** | Deactivate the last remaining admin; remove their own admin rights; auto-publish a supplier feed without review; delete records that carry history. `[D]` PA "Must not" — *not implemented in the prototype* |

## 3.7 A second, incompatible role model

`PROTO:roller` defines a **different** set of roles — **Ejer / Admin · KAM · Lager · Salg & service · Bogholderi** — crossed against seven modules (Overblik, Salg & produktion, Økonomi, Drift, Team, Salg, Opsætning), each cell individually toggleable and persisted. `[P]`

This is a **department-and-module** model for PDT's internal staff, not the five- or six-role model used everywhere else. Notably it introduces **Salg & service** and **Bogholderi** (bookkeeping), which appear in no other source.

> **Open question O-3:** Is PDT's internal staffing meant to be a fixed set of roles, or a configurable module matrix? The two models coexist in the prototype and cannot both be the requirement.

---

# 4. Role & Permission Model

## 4.1 Capability matrix

Legend: **✔** allowed · **✘** denied · **~** conditional (see note) · **?** not determinable

| Capability | Guest | Employee | Cust. Admin | KAM | Warehouse | Platform Admin | Evidence |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| **Catalogue & shop** |
| View public indicative prices | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | `[C]` PROTO:`pubshop` — **disputed, see Q-A** |
| View own company's range & prices | ✘ | ✔ | ✔ | ~ | ✘ | ✔ | `[C]` KAM sees only their own customers |
| View another company's prices | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ | `[C]` CA/KAM "Must not"; PA §5 |
| View PDT cost price / margin | ✘ | ✘ | ✘ | ~ | ✘ | ✔ | `[C]` PA rule 5. KAM sees margin **for their own customers only** |
| **Ordering** |
| Place an order | ✘ | ✔ | ~ | ✘ | ✘ | ~ | `~` Admin/CA ordering **on behalf of** an employee is a *Should*, undecided — O-4 |
| Pay overage personally (MobilePay) | ✘ | ✔ | ✘ | ✘ | ✘ | ✘ | `[C]` PRD §3 matrix, EMP §4 |
| View own orders | ✘ | ✔ | ✔ | — | — | ✔ | `[C]` EMP rule 3 |
| View all company orders | ✘ | ✘ | ✔ | ~ | ✘ | ✔ | `~` KAM: their own customers `[I]` |
| Cancel or refund an order | ✘ | ✘ | ? | ✘ | ✘ | ✔ | `[U]` for CA — never specified |
| Start a return | ✘ | ✔ | ? | ✘ | ✘ | ✔ | `[C]` PROTO:`retur`; CA's role in returns `[U]` |
| **Approvals** |
| Approve / reject an order | ✘ | ✘ | ✔ | ✘ | ✘ | ✔ | `[C]` CA §4 |
| Approve a visual proof | ✘ | ~ | ~ | ✘ | ✘ | ✔ | **Contested** — see §8.4 and Q-D |
| **People** |
| Invite an employee | ✘ | ✘ | ✔ | ✘ | ✘ | ✔ | `[C]` DEV §4.3, CA §1 |
| Bulk-import employees (CSV) | ✘ | ✘ | ✔ | ✘ | ✘ | ✔ | `[C]` CA §B, PROTO:`importModal` |
| Deactivate an employee | ✘ | ✘ | ✔ | ✘ | ✘ | ✔ | `[C]` CA §1 — *deactivate, never delete* |
| Invite a customer admin | ✘ | ✘ | ✘ | ✔ | ✘ | ✔ | `[C]` KAM §6 |
| Create PDT staff (KAM/warehouse/admin) | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ | `[D]` PA "Staff" — **screen does not exist yet** |
| **Commercial setup** |
| Create a customer company | ✘ | ✘ | ✘ | ✔ | ✘ | ✔ | `[C]` KAM §1 |
| Select the customer's range | ✘ | ✘ | ~ | ✔ | ✘ | ✔ | `~` CA edits *department packages* — see §3.3 |
| Set the customer's prices | ✘ | ✘ | ✘ | ✔ | ✘ | ✔ | `[C]` KAM §3 |
| Set the minimum margin floor | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ | `[C]` PROTO:`katalog`, KAM rule 2 |
| Override the margin floor | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ | `[C]` PROTO:`activateShop` |
| Activate a shop | ✘ | ✘ | ✘ | ~ | ✘ | ✔ | `~` blocked below minimum DG |
| Set allowance / approval limit / points mode | ✘ | ✘ | ✔ | ✔ | ✘ | ✔ | **Both** KAM (at setup) and CA (ongoing) — `[C]` KAM §5, CA §6 |
| **Fulfilment** |
| Move an order between stages | ✘ | ✘ | ✘ | ✘ | ✔ | ✔ | `[C]` WH §2 |
| Create GLS label / record parcel no. | ✘ | ✘ | ✘ | ✘ | ✔ | ✔ | `[C]` WH §4 |
| **Supply & platform** |
| Approve a supplier catalogue update | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ | `[C]` PA §2, PRD FR-2.3 |
| Release a supplier order | ✘ | ✘ | ✘ | ✘ | ? | ✔ | **Unowned** — PA and WH both flag it. O-5 |
| View finance / e-conomic | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ | `[C]` PRD §3 |
| View audit log | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ | `[C]` PROTO:`audit` |

## 4.2 How permissions are enforced

| Layer | Mechanism | Status |
|---|---|---|
| Navigation | Menu built per role from `NAV[ROLE]` | `[C]` PROTO:`buildNav` |
| URL / deep link | Hash router rejects any view not in the current role's menu | `[C]` PROTO:`hashchange`; fix recorded in REV §1 — *"Role leak via URL"* |
| Server routes | Middleware maps route prefix → allowed roles | `[D]` DEV §4.2 |
| Data | Row-Level Security on `organisation_id` and role claim | `[D]` DEV §1.1, §3 |
| API | *"Server-side middleware validating permissions on every API endpoint"* | `[D]` PRD §5.2 |

> **Recorded incident, worth stakeholder attention.** Before the audit, **any role — including the public guest — could reach admin finance and CRM pages by typing a URL**, because the router did not check the role. `[C]` REV §1. This is the clearest evidence that role enforcement must be **server-side**, not menu-shaped.

## 4.3 ⚠ Defect in the authoritative permission matrix

`PRD §3` presents the RBAC matrix as the definitive statement of role capability. **Several rows have empty cells where a permission mark is expected**, including the entire "Public Catalog & Prices" row and the Employee and Platform Admin columns on multiple rows.

The blanks are ambiguous: they could mean "allowed", "denied", or "not yet decided". §4.1 above therefore reconstructs permissions from the prototype and the role specs rather than from the PRD matrix.

> **Action required:** the PRD matrix must be repaired and re-approved. Until then it cannot be cited as the source of truth for permissions.

---

# 5. Product Structure & Navigation

## 5.1 Shape

Every authenticated role gets the same shell — a collapsible left sidebar with accordion sections whose open/closed state is remembered, a context header, global search (`⌘K` / `Ctrl+K`), a notification bell, and a floating mini-cart in shop contexts. `[C]` HAND §3, PROTO:`buildNav`

The **content** of the sidebar is entirely role-dependent, and the size difference between roles is the clearest statement of the product's shape:

| Role | Sections | Views | Character |
|---|:--:|:--:|---|
| Guest | 1 | 3 | A shop window |
| Employee | 2 | 11 | A private webshop (+ 5 disputed tools — §3.2) |
| Warehouse | 1 | 3 | Two working screens |
| KAM | 1 | 5 | A sales desk |
| Customer Admin | 3 | 11 | A small admin console |
| Platform Admin | 8 | ~40 | An ERP surface |

`[C]` PROTO:`NAV`

## 5.2 Platform admin sections

The eight sections define PDT's own operating model: **Overblik** (dashboard, sales insight, anomalies, AI assistant, CRM) · **Salg & produktion** (webshop integration, pipeline, production flow, orders & suppliers) · **Økonomi** (reports, invoices, e-conomic reconciliation, batch invoicing, receivables, payables, balance, cash flow, budget) · **Drift** (pack & ship, stock, suppliers, catalogues, catalogue updates, reviews, design manual) · **Team** · **Salg** (create shop, white-label, customers, campaigns, banner) · **Opsætning** (pricing, integrations, punchout, team & access, roles & modules, audit, branding). `[C]` PROTO:`NAV.pdt`

## 5.3 Route map (as specified for the build)

`DEV §5.1` fixes the URL structure: `/shop`, `/shop/[productSlug]`, `/cart`, `/checkout`, `/orders`, `/orders/[orderNumber]`, `/dashboard/customer/*`, `/dashboard/kam/*`, `/dashboard/admin/*`. `[D]`

> **Open question O-6 (from `DEV` Q6):** subdomain routing (`{org}.profildesigntrading.dk`) or path routing (`/shop/{org}`)? Undecided, and it must be settled before routes are built.

---

# 6. Core Entities

| Entity | Purpose | Created by | Owned by | Key states |
|---|---|---|---|---|
| **Organisation** (customer) | The customer company; the tenancy root | KAM | KAM (account owner) | Draft → Pipeline/Ready → Active → Paused *(disputed, §7.1)* |
| **Member** | A person's membership of an organisation, carrying their role | KAM (admin) / Customer Admin (employee) / Platform Admin (staff) | The inviting role | Invited → Active → Deactivated |
| **Department** | A team inside a customer; determines the approver and can carry its own package | Customer Admin | Customer Admin | — |
| **Employee Quota** | One person's clothing budget for one period | Customer Admin | Customer Admin | Allocated → partially used → exhausted → renewed |
| **Product / Variant** | Master catalogue from supplier feeds; variant = colour + size | Supplier feed (admin approves) | Platform Admin | Active / discontinued |
| **Org Assortment** | Which products a given customer may buy | KAM | KAM | Enabled / disabled |
| **Org Pricing** | What a given customer pays for a given variant | KAM | KAM | — |
| **Design Manual / Logo Spec** | Placement, method, size in mm, PMS colours, logo file, per customer | KAM | KAM | — **⚠ no table exists; see §14.3** |
| **Cart** | A basket in progress | Employee | Employee | Transient (persisted between sessions) |
| **Order** | A confirmed purchase | Employee | Employee (visible to Customer Admin, PDT) | See §7.2 |
| **Order Line** | One garment, size, colour, quantity, and its logo instruction | Employee | — | — |
| **Approval Request** | An order awaiting a signature | System (rule-triggered) | Customer Admin | Pending → Approved / Rejected |
| **Proof (Korrektur)** | A visual proof of the logo on the garment | System / PDT | Customer | 6 states, §7.3 — **contested** |
| **Production Job** | The print/embroidery work for an order | System | Warehouse | Mirrors order stage |
| **Shipment** | Parcel number + tracking | Warehouse | Warehouse | Created at dispatch |
| **Return** | A request to send something back | Employee | **⚠ unowned** — §13.4 | Requested → ? |
| **Supplier** | Who PDT buys from, and by which channel | Platform Admin | Platform Admin | Active / inactive |
| **Supplier Order** | A pooled purchase order towards one supplier | System (pooling) | Platform Admin | Accumulating → Ready → Released → Confirmed → Received |
| **Invoice** | A bill to a customer, mirrored in e-conomic | System | Platform Admin | Draft (Kladde) → Posted (Bogført) → Paid (Betalt) / Overdue (Forfalden) |
| **Deal / Opportunity** | A sales opportunity in the pipeline | KAM | KAM | Pipeline stages → Won / Lost |
| **Catalogue Update** | An incoming supplier feed awaiting approval | Supplier feed | Platform Admin | Pending → Approved / Rejected — **⚠ no table exists** |
| **Audit Entry** | Who did what, when | System | Platform Admin | Append-only |

Evidence: entity set assembled from `DEV §2.1` (schema), the `Data it owns` tables in all five role specs, and the prototype's `DATA` object. Entities marked ⚠ are named in requirements but have no home in the specified schema.

---

# 7. Entity Lifecycles

## 7.1 Customer (Organisation)

**Prototype behaviour** `[C]` PROTO:`activateShop`, `firstOrder`:

```
(wizard in progress)          — customer does not exist yet
        │  KAM presses "Aktivér shop"
        ▼
   PIPELINE ("I pipeline")    — customer created; debtor created in e-conomic;
        │                       deal added to the sales pipeline
        │  KAM presses "Registrér 1. ordre"
        ▼
   AKTIV                      — deal moves to "Won" at 100% probability
```
A third value, **Kladde** (draft), appears in the customer list but nothing in the prototype writes it. `[P]`

**Documented behaviour** `[D]` KAM §A: **Draft · Ready · Live · Paused**, with an explicit *"Go live"* switch and a *"pause"* action distinct from deletion (*"A KAM cannot delete a live customer. They can pause it"*).

> **⚠ Conflict.** Three-state prototype (Kladde/Pipeline/Aktiv, driven by *first order registered*) versus four-state specification (Draft/Ready/Live/Paused, driven by *an explicit go-live switch*). They are not reconcilable: one makes activation a **sales milestone**, the other a **deliberate configuration act**. **Stakeholder decision required.**

## 7.2 Order — four competing stage models

| Source | Stages |
|---|---|
| `PRD` FR-4.4 | Draft → Pending Approval → **Proofing** → Print/Embroidery Queue → Packing → Shipped |
| `DEV` §5.4 (customer tracker) | Received → In Production → Packing → Shipped → **Delivered** |
| `DEV` §7.2 (warehouse kanban) | **Queued** → Printing/Embroidering → Packing → **Ready** → Shipped |
| `WH` §A | **Approved** → Print/embroidery → Packing → Shipped → **Delivered** |
| `PROTO:packship` | ny → pak → **tryk** → klar → sendt |
| `PROTO:orderTracker` (customer-facing) | Modtaget → Tryk/broderi → Pakning → Klar → Sendt |

Six renderings, no two identical. They disagree on: whether **Proofing** is a stage; whether **Delivered** exists; whether **Ready/Klar** is a stage or a substate of packing; and whether packing precedes or follows print.

> **⚠ Conflict Q-C — highest-priority resolution.** The order status drives the employee's tracker, the customer admin's list, the warehouse board and the invoice trigger. Every one of those screens is blocked on a single agreed list.

**What is consistent across all sources** `[C]`:
- Print/embroidery, packing and shipping happen in that order.
- An order that needs no logo skips print entirely. `[C]` WH §A
- Nothing moves back out of *shipped*. `[C]` WH §A
- Only legal moves are offered; no jumping from approved to delivered. `[C]` WH rule 2

## 7.3 Proof (Korrektur)

`PROTO:korrektur` defines six states: **Afventer korrektur → Afventer kundegodkendelse → Godkendt til produktion → I produktion → Klar til levering → Afsluttet**, with a comment thread per case and a gated production sheet that reads *"må ikke sættes i produktion endnu"* until approved. `[P]`

`DEV §7.1` specifies a mandatory loop: *"Proof approval is **mandatory** before any production starts. No bypass."* — proof created → customer emailed a signed URL, **no login required** → approve or request changes → changes start a new proof loop. `[D]`

**Neither `WH` nor the prototype's own production board references a proof gate at all.** The warehouse board moves orders from approved straight into print. `[C]` PROTO:`produktion`

> **⚠ Conflict Q-D.** If proofing is mandatory, it is a **blocking stage with an external, unauthenticated customer touchpoint** — a significant piece of work absent from the warehouse specification and from the order lifecycle used everywhere else.

## 7.4 Approval Request

**Model A — flat** `[C]` PROTO:`godkend`: one list; Approve or Reject; a bulk *"approve everything within the limit"* action. The record is **deleted** on decision. No reason is captured, no order state changes, no notification is sent.

**Model B — two-step chain** `[C]` PROTO:`godkendflow`: `Nærmeste leder` → `Indkøbsansvarlig`, strictly sequential (step 2 is disabled until step 1 is done), with a configurable order limit.

**Model C — three levels** `[D]` PRD FR-4.2: Employee → Department Manager → Customer Purchasing Lead, with *"email and in-app notifications with single-click approve/reject actions and audit notes."*

**Model D — single decision with mandatory reason** `[D]` CA §E: *"Approve or **Reject with a reason** — a rejection with no reason turns into a phone call, which is what the system exists to avoid."*

> **⚠ Conflict Q-B.** Four models. They differ on the number of steps, whether a reason is mandatory, and whether the decision notifies anyone. The prototype's Model A additionally **loses the record**, which is incompatible with `CA` rule 4 (*"every approval decision is logged — who, what, when, and why"*).

## 7.5 Supplier Order

```
ACCUMULATING ──► READY ──► RELEASED ──► CONFIRMED ──► RECEIVED
   (pooling)   (minimum met)   (sent)    (supplier ack)  (goods in)
```
`[C]` PA §G. The prototype models the accumulator concretely — a progress bar towards a minimum ("22 / 25 stk.") with *"Approve & order"* and *"Wait until 12:00"* actions. `[C]` PROTO:`ordreflow`

**Cancelled** is available as a terminal state. `[P-impl]`

## 7.6 Invoice

`Kladde` (draft) → `Bogført` (posted) → `Betalt` (paid) · `Forfalden` (overdue). `[C]` PROTO:`fakturaer`, `econrec`

## 7.7 Member

```
INVITED ──► ACTIVE ──► DEACTIVATED
   │                        (login dies, history stays)
   └── invite expires ──► re-send
```
`[C]` KAM rule 5, CA §1 and rule 3, PA "Staff". **Deletion is forbidden throughout** — deactivate instead, so order history survives.

---

# 8. End-to-End Workflows

## 8.1 W-1 · Lead to live customer shop

| | |
|---|---|
| **Purpose** | Turn an enquiry into a company whose employees can order. |
| **Trigger** | A public quote request, or a KAM's own sales contact. `[C]` KAM |
| **Actors** | KAM (primary), Platform Admin (exception path), Customer Admin (recipient) |
| **Preconditions** | The KAM account exists — **which today requires a server script, see §14.1**. The master catalogue is populated. |

### Steps

| # | Actor | Action | System behaviour | Evidence |
|---|---|---|---|---|
| 1 | KAM | Opens the create-customer wizard | Wizard opens; saveable half-finished | `[C]` PROTO:`opret`; `[D]` KAM rule 6 *(draft-saving is documented, not in the prototype)* |
| 2 | KAM | **Step 1 — Company details:** name, CVR, EAN, contact, email, phone, address, payment terms, price agreement, employee count | CVR lookup should auto-fill name and address `[D]` PRD FR-1.1, DEV §5.6 (`cvrapi.dk`) — **not in the prototype** | `[C]` / `[D]` |
| 3 | KAM | **Step 2 — Range:** filter by brand and category, tick products | Selection persists; expected margin recalculates live | `[C]` PROTO:`opret`, `shopDB()` |
| 4 | System | Continuously computes expected annual contribution | `employee count × selected products at the customer's net price` → revenue, DB, DG% against the floor | `[C]` PROTO:`shopDB`, `dbBoxHTML` |
| 5 | KAM | **Step 3 — Activate** | **Decision point — margin gate** | |
| 5a | System | If `DG ≥ minimum` | Proceeds | `[C]` |
| 5b | System | If `DG < minimum` **and actor is KAM** | **Blocked.** *"DG X% is under the minimum (Y%) — adjust before activation."* No override path. | `[C]` PROTO:`activateShop` |
| 5c | System | If `DG < minimum` **and actor is Platform Admin** | Confirmation prompt: *"Activate anyway?"* | `[C]` PROTO:`activateShop` |
| 6 | System | On activation | Customer created; **debtor created in e-conomic**; customer set to *Pipeline*; a deal is added to the sales pipeline at 40% probability | `[C]` PROTO:`activateShop`; `[D]` PRD FR-1.1 for the e-conomic REST call |
| 7 | KAM | Invites the customer's admin | Email invite; recipient sets their own password | `[C]` KAM §6, DEV §4.3 |
| 8 | KAM | Registers the first order | Customer flips to *Active*; the deal moves to *Won* at 100% | `[C]` PROTO:`firstOrder` |

### Documented-only steps not in the prototype

- **Preview as an employee before going live** — *"Wrong price or missing product is far cheaper to find here than after 40 people have ordered."* `[D]` KAM §C
- **Explicit go-live switch** separate from creation `[D]` KAM §D
- **Completeness gate:** a customer cannot go live without at least one product, a price on every product, **and a logo spec** `[D]` KAM rule 4
- **Logo step (step 4 of 5)** in the wizard `[D]` KAM §B — the prototype's wizard has three steps, and the logo is maintained separately in `PROTO:designmanual`

> **⚠ Conflict.** `PRD`, `DEV` and the prototype all describe a **3-step** wizard. `KAM` describes a **5-step** wizard (adding Prices and Logo as their own steps) plus preview and go-live. **Stakeholder decision required** (O-7).

### Exceptions

| Situation | Behaviour | Evidence |
|---|---|---|
| CVR not found / lookup fails | Not specified | `[U]` |
| Duplicate company (same CVR) | Not specified | `[U]` |
| e-conomic unreachable at activation | Not specified — the prototype always succeeds | `[U]` |
| Invite never opened | Re-send; invites expire | `[D]` KAM rule 5 |
| KAM leaves the company | *"Needs a reassign action"* — does not exist | `[U]` KAM open question |

---

## 8.2 W-2 · Customer admin sets the company up

| | |
|---|---|
| **Purpose** | Turn a live shop into one that people can actually use. |
| **Trigger** | The customer admin accepts their invitation. |
| **Actors** | Customer Admin |
| **Preconditions** | W-1 complete; the range and prices exist. |

### Steps

| # | Actor | Action | System behaviour | Evidence |
|---|---|---|---|---|
| 1 | Customer Admin | Accepts invite, sets password | Account activated inside their organisation | `[C]` DEV §4.3 |
| 2 | Customer Admin | Creates departments | Departments carry an approver and, in the prototype, their own product package | `[C]` CA §C, PROTO:`afdelinger` |
| 3 | Customer Admin | Adds employees — one at a time, or **imports a spreadsheet** | Invitation emailed per person. *"A new customer arrives with 40 people, and typing 40 emails is where the setup dies."* | `[C]` CA §B, PROTO:`importModal` |
| 4 | Customer Admin | Allocates the clothing budget per employee | Budget per person per period; bulk actions (*"give the whole workshop 2,000 kr"*, *"reset everyone for the new year"*); one-off top-ups with a reason | `[C]` CA §D — bulk actions and reasons are `[D]` |
| 5 | Customer Admin | Sets house rules | Default allowance · approval limit · kroner or points · personal purchases on/off · delivery addresses | `[C]` CA §G, PROTO:`indstillinger` |

### Business rules

- Every budget change is logged — who, what, when, why. `[D]` CA rule 4
- A deactivated employee loses access immediately; their orders and spend remain. `[C]` CA rule 3
- The admin cannot raise their own approval limit past what was agreed with PDT. `[D]` CA "Must not" — **no mechanism specified for how that ceiling is expressed or enforced.** `[U]`

### Open questions

- Does unused budget **roll over** or reset? *"A question every customer will ask on day one."* `[U]` CA
- What happens to a **leaver's unspent budget**? `[U]`
- Can a **department** hold a budget on top of the per-person one? The field exists; nothing reads it. `[U]`
- Who approves when the approver is **away**? Without a deputy, orders stall. `[U]`

---

## 8.3 W-3 · Employee orders workwear *(the core loop)*

| | |
|---|---|
| **Purpose** | An employee gets the clothes they need, inside the rules, without anyone at PDT touching it. |
| **Trigger** | The employee signs in. |
| **Actors** | Employee (primary), Customer Admin (only if approval is triggered) |
| **Preconditions** | W-2 complete: the person exists, has a budget, and the range is priced. |

### Steps

| # | Actor | Action | System behaviour | Evidence |
|---|---|---|---|---|
| 1 | Employee | Signs in | Lands directly in **their** shop — their company's range, their prices | `[C]` EMP §2 |
| 2 | System | Renders the shop | **Budget always on screen**: *"1,240 kr left of 1,500"*, or *"620 points left"* with kroner hidden entirely | `[C]` EMP §3, PROTO:`medshop` |
| 3 | Employee | Finds a garment — browse, filter by category, search, or **"Order again"** | *"The single most used feature. Same boots, same size, two clicks."* | `[C]` EMP §A, PROTO:`reorderLast` |
| 4 | Employee | Opens the product | Photos, colour switch, size picker. **A size that cannot be delivered must not be selectable.** Last-ordered size is shown and pre-selected | `[C]` EMP §B, PROTO:`produkt` (`LASTSIZE`) |
| 5 | Employee | Chooses the logo | Placement (left chest / right chest / sleeve / back) + method (embroidery / print), **from the company's design manual only**. Surcharge shown per placement | `[C]` EMP §5, PRD FR-3.1, PROTO:`logoPanelHTML` |
| 6 | Employee | *(optional)* **Find my size** | Chest measurement in, suggested size out; brand-specific table | `[C]` EMP §F, PROTO:`sizeguide` |
| 7 | Employee | Adds to cart | Cart persists between sessions | `[C]` EMP §C |
| 8 | Employee | Opens the cart | Lines show size, colour and **logo spelled out**; running total against the budget with **a clear warning the moment it goes over**; order CO₂ total | `[C]` EMP §C, PROTO:`openCart` |
| 9 | Employee | Goes to checkout | **The split, in words:** *"Company pays 1,240 kr · You pay 310 kr"* | `[C]` EMP §D |
| 10 | System | Computes the split server-side | `remaining ≥ total` → all on account; otherwise `remaining` on account + overage to MobilePay | `[C]` DEV §5.3, PROTO:`confirmSplit` |
| 11 | System | Evaluates the approval rule | Over the company's limit → the order needs approval, **and the employee is told before pressing the button** | `[C]` EMP §D, PRD FR-4.2 |
| 12 | Employee | Confirms | Order number issued; confirmation shown; receipt printable | `[C]` PROTO:`confirmSplit` |
| 13 | System | Side effects | See §12.1 — **and note the disputed invoice timing, Q-E** | |

### Decision points

| Point | Options | Outcome |
|---|---|---|
| Budget sufficient? | yes / no | No → split with MobilePay `[C]` |
| Personal purchases allowed? | on / off | Off **and** over budget → **undecided.** *"Block the order, or send it for approval? The kinder answer is approval."* `[U]` EMP open question |
| Over the approval limit? | yes / no | Yes → order held pending a decision `[C]` |
| Out of stock at ordering? | — | *"Stock is checked before the order is accepted, not after."* `[C]` EMP rule 6 |

### Rules the system must enforce

1. **The server decides the price.** Never the browser. Prices are re-read from the customer's price list when the order is placed. `[C]` EMP rule 1
2. **The server decides the budget.** The bar on screen is a convenience; the real balance is re-read at checkout. `[C]` EMP rule 2
3. An employee sees **their own orders only**. `[C]` EMP rule 3
4. **Two orders placed at the same moment must not both spend the last of a budget.** `[C]` EMP rule 4
5. **Pressing *Place order* twice must not create two orders.** `[C]` EMP rule 5
6. Points mode hides kroner **everywhere, including emails**. `[C]` EMP rule 8
7. Mobile first. `[C]` EMP rule 7

### Exceptions and gaps

| Situation | Behaviour | Evidence |
|---|---|---|
| Item goes out of stock between cart and checkout | Prototype offers three choices **in the cart**: keep the item and ship complete later · ship the rest now and follow up · accept an AI-suggested in-stock substitute | `[P]` PROTO:`openCart` — **documented nowhere** |
| Product removed from the range while in the cart | Not specified | `[U]` |
| MobilePay payment fails | Not specified | `[U]` |
| Approval never decided | Not specified — no timeout, no escalation | `[U]` |

> **⚠ Prototype-only, significant.** The back-order resolution choice in the cart is a real business decision (complete vs. partial delivery vs. substitution) and appears in no requirement document. It needs to be either specified or dropped deliberately (O-8).

---

## 8.4 W-4 · Approval

| | |
|---|---|
| **Purpose** | Stop spending above the agreed limit without a human saying yes. |
| **Trigger** | An order exceeds the company's per-order limit `[C]`, or *(documented only)* requires custom embellishment or falls outside the default package `[D]` PRD FR-4.2. |
| **Actors** | Customer Admin (approver), Employee (requester) |

**This workflow cannot be specified further until Q-B is resolved.** Four incompatible models are documented in §7.4. What can be stated:

| Aspect | Status |
|---|---|
| The trigger is an amount above a configurable limit | `[C]` |
| The approver is at the customer, not at PDT | `[C]` |
| Approving must work **on a phone** — *"between meetings, on a site, in a van"* | `[C]` CA rule 5 |
| Two admins approving the same order at once must not both succeed | `[C]` CA rule 6 |
| Every decision is logged — who, what, when, why | `[D]` CA rule 4 — **the prototype deletes the record instead** |
| The employee is notified either way | `[D]` CA §E |
| Number of steps | **1, 2 or 3 — undecided** |
| Whether a rejection reason is mandatory | **Undecided** |
| What a rejected order becomes — editable draft? cancelled? resubmittable? | `[U]` |

---

## 8.5 W-5 · Production and dispatch

| | |
|---|---|
| **Purpose** | Turn a confirmed order into a parcel on the van. |
| **Trigger** | An order reaches the approved/ready state. |
| **Actors** | Warehouse (primary), Platform Admin (oversight) |

### Steps

| # | Actor | Action | System behaviour | Evidence |
|---|---|---|---|---|
| 1 | System | Places the order on the production board | One card per order: customer, employee, item count, **and when it is due** | `[C]` WH §A |
| 2 | Warehouse | Reads the board | Cards **red when late, amber when due today or tomorrow** | `[C]` WH §A |
| 3 | Warehouse | Opens the pack screen for one order | Full pick list: garment, size, colour, quantity — **and the logo spec spelled out**: placement, method, size in mm, colours | `[C]` WH §B |
| 4 | System | Checks availability | The prototype blocks starting a pick until every line is *in stock* or *received*; lines waiting on a supplier are flagged | `[C]` PROTO:`packAvail` |
| 5 | Warehouse | Sends to print/embroidery *(only if the order carries a logo)* | **An order with no logo skips print entirely** | `[C]` WH §A |
| 6 | Warehouse | Print done → packing | Order stage advances; the customer's tracker updates immediately | `[C]` WH §2 |
| 7 | Warehouse | Scans each item into the box | *"So the wrong size never leaves the building"* | `[D]` WH §3 — the prototype scans only the parcel label |
| 8 | Warehouse | Creates the GLS label | Parcel number captured; **tracking link appears in the employee's *My orders* by itself** | `[C]` WH §4, PROTO:`packConfirmGLS` |
| 9 | System | Marks the order shipped | Production board and customer tracker both move | `[C]` PROTO:`prodMoveOrder` |

### Rules

1. **The board is a view of real order status, not a second copy of it.** *"Two sources of truth is how a warehouse stops believing the screen."* `[C]` WH rule 1
2. Only legal moves are offered. `[C]` WH rule 2
3. **Shipping requires a parcel number.** *"No number, no shipped — otherwise the tracking link is a dead end and the phone rings."* `[C]` WH rule 3
4. Every move is logged: who, from what, to what, when. `[D]` WH rule 4
5. Two packers must not pack the same order at once. `[D]` WH rule 5
6. **No prices, margins or budgets anywhere on this screen.** `[C]` WH rule 6
7. Works on a tablet, in portrait, with large targets. `[C]` WH rule 7

### Open questions

- **Where does the delivery date come from?** Currently derived from the *"2–4 working days"* promise on the website. There is no agreed date on an order. *"If a customer is ever promised a specific date, that needs a real column."* `[U]` WH
- **Is print and embroidery in-house or sent out?** If out, the print column is a stage staff **wait on**, not work in — *"a different screen entirely."* `[U]` WH
- **What happens when an item is out of stock at packing?** Split, hold, or substitute? *"This is where a warehouse screen either helps or starts a phone call."* `[U]` WH
- **Partial dispatch** is a *Should*, unspecified. `[D]`

---

## 8.6 W-6 · Replenishment — pooling demand into supplier orders

| | |
|---|---|
| **Purpose** | Buy in what customer orders need, while respecting each supplier's minimum order. |
| **Trigger** | Customer demand that stock cannot cover. |
| **Actors** | Platform Admin — **or Warehouse. Unowned, see O-5.** |

### Steps

| # | Actor | Action | System behaviour | Evidence |
|---|---|---|---|---|
| 1 | System | Detects a shortfall | Ordered quantity exceeds stock on an open order | `[C]` PROTO:`vareflow` (reorder flags), PA §4 |
| 2 | System | Pools it | Demand collects into **a basket per supplier**, across customers | `[C]` PA §4, PROTO:`ordreflow` |
| 3 | System | Tracks the minimum | Progress towards the supplier's minimum ("22 / 25 stk.") | `[C]` PROTO:`ordreflow` |
| 4 | Admin | Releases when the minimum is met | Options in the prototype: *"Approve & order"* or *"Wait until 12:00"* | `[C]` PROTO:`ordreflow` |
| 5 | System | Sends by the supplier's channel | API · punchout (OCI/cXML) · EDI · CSV/XML · SFTP · mail order · portal automation. **Five different mechanisms — see Appendix B.3, including one supplier that cannot receive an order automatically at all** | `[C]` PROTO:`ordreflow`, SUP-CAP, SUP-INT |
| 6 | Admin | Tracks confirmation and receipt | | `[C]` PA §4 |

### Rules

- A supplier order **cannot be released twice**. `[D]` PA rule 6
- For no-API suppliers (F&H B2B, Snickers) the realistic near-term flow is: **order in our system → CSV export → upload in the supplier portal → follow status in the portal.** Full automation is not offered by those suppliers today. `[C]` SUP-IMP

### Gaps

- **No supplier's minimum order quantity is stated in any document.** The prototype's example ("Nordtex, min. 25") is a supplier that does not exist in the real supplier list — it is illustrative. `[U]` — every minimum must be collected commercially.
- **Nobody owns pressing send.** Both `PA` and `WH` flag this as unowned. `[U]`
- **Does PDT hold stock at all,** or is everything bought per customer order? `SUP-INT` now confirms the *system* side — *"Rackbeat is discontinued. Stock and orders live in the platform itself (our own code). e-conomic retained for finance."* — so stock is a real, owned feature rather than a passthrough number. Whether PDT physically holds inventory, and at which of the four showrooms, is still unstated. `[C]` for the system boundary · `[U]` for the physical answer

---

## 8.7 W-7 · Supplier catalogue update

| | |
|---|---|
| **Purpose** | Keep the master catalogue current **without a feed publishing itself into live shops.** |
| **Trigger** | A scheduled feed pull. `[D]` DEV §9.3 (Vercel cron) |
| **Actors** | Platform Admin |

| # | Step | Evidence |
|---|---|---|
| 1 | Feed pulled on schedule per supplier (FTP, SFTP, GraphQL, JSON, CSV, portal) — **ten suppliers, six transports, cadences from live to nightly; see Appendix B.2** | `[C]` SUP-CAP, SUP-IMP, SUP-INT |
| 2 | Normalised into one product model — SKU, EAN, colour, size, list price, net price, stock, lead time, images, CO₂ where available | `[C]` DEV §9.1, PRD FR-2.2 |
| 3 | **A diff report is generated**: added items · discontinued SKUs · price changes up and down | `[C]` PRD FR-2.3, PROTO:`catupdates` |
| 4 | The diff surfaces in the notification bell | `[C]` REV §4 |
| 5 | Admin reviews and **approves or rejects** | `[C]` PA §E |
| 6 | On approval: catalogue publishes; **customers' net prices recalculate automatically** where a margin rule applies | `[D]` PRD FR-2.3 |

### The governing rule

> **"Nothing publishes itself. Supplier feeds land as a proposal with a visible diff. A human approves before it reaches a live shop."** `[D]` PA rule 1
>
> Rationale, in PDT's own words: *"A price feed that publishes itself is how a customer gets charged last year's price for next year's jacket."*

### Gaps

- **No table exists** for catalogue updates awaiting approval. `[U]` PA "Data it owns"
- **Feed cadence** is now known for four suppliers and unknown for the rest — see Appendix B. `SUP-INT` fixes PF Concept to the minute (product daily 05:00, stock 02:00 and 13:00, prices Saturday 14:00, print data 06:00, attributes weekly) and Engel to nightly; TEE JAYS is daily and Fristads stock "frequent". You, Mascot, NWG, ID Identity and Nimbus remain `[U]`. Detection of a **silently failed feed** is specified nowhere — *"a feed that quietly stops is worse than one that errors loudly."* `[U]` PA
- **Do cost prices come from the feed, or are they negotiated per supplier?** *"Margin maths depends on the answer."* `[U]` PA
- Fristads/Kansas **do not publish CO₂** — must be handled as *"not available"*, never as zero. `[C]` SUP-CAP

---

## 8.8 W-8 · Order to cash

| # | Step | Evidence |
|---|---|---|
| 1 | Company portion of an order becomes a receivable | `[C]` |
| 2 | **Invoice raised — timing disputed, see Q-E** | |
| 3 | Posted to e-conomic over REST | `[C]` PRD FR-5.2, HAND §5 |
| 4 | Customer revenue updated in CRM; receivables, balance and revenue recalculate | `[C]` PROTO:`confirmSplit` → `createInvoice` → `addCrmRevenue` → `recomputeEcon` |
| 5 | Nightly two-way reconciliation matches platform invoices against e-conomic payments; debtors marked paid or overdue | `[C]` PRD FR-5.3, PROTO:`econrec` |

### ⚠ Conflict Q-E — three invoice timings

| Source | Timing |
|---|---|
| `PROTO:confirmSplit` | **At checkout.** A posted (`Bogført`) invoice is created the moment the employee confirms. `[C]` |
| `PRD` FR-5.2 | *"Single Order Invoicing: immediate posting to e-conomic **upon order dispatch**."* `[D]` |
| `PRD` FR-5.2 · `PROTO:samlefaktura` | **Daily batch (Samlefakturering):** finished print work grouped per customer into one consolidated invoice. `[C]` |

Invoicing at checkout means invoicing goods that have not been picked, may be out of stock, and may still be rejected in approval. **Stakeholder decision required.**

### Related

- **e-conomic should be the master** for customers, prices and invoices — *"maintained in one place."* `[C]` HAND §5
- Does PDT's current system already push to e-conomic? Unknown, and it could move the integration point entirely. `[U]` DEV Q2
- Does PDT have an e-conomic account and API token? Unknown; the finance phase is blocked without it. `[U]` DEV Q8

---

## 8.9 W-9 · Returns and exchange

| | |
|---|---|
| **Trigger** | An employee wants to send something back. *"Wrong size is the most common reason."* `[C]` EMP §E |
| **Actors** | Employee — **and then nobody.** |

| # | Step | Evidence |
|---|---|---|
| 1 | Employee picks the item, a reason (too small · too large · changed mind · faulty · wrong item delivered) and an outcome (exchange · refund · credit to the clothing account) | `[C]` PROTO:`retur` |
| 2 | A **prepaid GLS return label** is issued | `[C]` PROTO:`startReturn` (mocked), PRD FR-4.6 |
| 3 | Employee drops the parcel at a GLS parcel shop | `[C]` |
| 4 | **Goods received, inspected, decision made** | **⚠ UNOWNED** |
| 5 | **Refund, credit or replacement issued** | **⚠ UNOWNED** |
| 6 | **Stock restocked** | `[D]` PRD FR-4.6 — *"inventory restocking workflows"*, no actor named |

> **⚠ Gap.** *"Who receives the parcel coming back, checks it and approves the refund? Currently unowned."* `[U]` WH. The warehouse explicitly **cannot** refund (`WH` "Must not"), and no other role is assigned it. **The return flow has a beginning and no end.**

---

## 8.10 W-10 · Public enquiry to quote

| # | Step | Evidence |
|---|---|---|
| 1 | Visitor browses the public shop at indicative prices | `[C]` PROTO:`pubshop` — **disputed, Q-A** |
| 2 | Visitor puts their logo on a garment in the visualiser | `[C]` PROTO:`aistudio` for guests |
| 3 | Visitor requests a quote | `[C]` PROTO:`pubLead` |
| 4 | **The enquiry reaches a KAM** | `[U]` — no inbox, assignment rule or lead entity is specified anywhere |
| 5 | KAM converts it via W-1 | `[C]` KAM |

> **Open question O-9 (from `KAM`):** *"Is the quote itself part of the system, or does it stay in email until the deal is signed? This decides whether the wizard starts at 'lead' or at 'won customer'."*

---

# 9. Role-Specific User Journeys

## 9.1 Employee — Jens, a driver who needs a new jacket

```
Signs in on his phone in the van
   └─► Shop opens: his company's range, "1,240 kr left of 1,500" at the top
        └─► Taps "Order again" — same softshell, same size L
             or browses → product → size L pre-selected (last ordered)
                  └─► Picks left-chest embroidery (+39 kr)
                       └─► Cart: 1 line, logo spelled out, total vs. budget
                            └─► Checkout: "Company pays 649 · You pay 0"
                                 └─► Confirms → order number
                                      └─► My orders: Received → … → Shipped + tracking
                                           └─► Wrong size? → Start a return
```
`[C]` EMP, PROTO:`medshop`

## 9.2 Customer Admin — Lene, office manager, Monday morning

```
Signs in → Overview
   ├─ "Waiting for you: 2 orders need approval"  ──► approves both on her phone
   ├─ "Running low: 3 employees near the bottom" ──► tops up the workshop by 2,000 kr
   ├─ Recent orders, with status
   └─ Spend this month vs. the same month last year
New starter today ──► Employees ──► invite by email ──► set budget ──► set department
```
`[C]` CA §A–D

## 9.3 KAM — Frederik, closing a new account

```
My overview: my pipeline, weighted value, shops awaiting their first order
   └─► New customer ──► wizard
        step 1 company details ─► step 2 pick the range ─► margin bar updates live
             └─► DG below the floor? ──► BLOCKED. Adjust prices or the range.
                  └─► DG fine ──► Activate ──► debtor created in e-conomic
                       └─► Invite the customer's admin
                            └─► Follow-up: spend, stalled orders, invited-vs-signed-in
                                 └─► First order lands ──► customer goes Active, deal Won
```
`[C]` KAM, PROTO:`kamdash` `opret` `activateShop` `firstOrder`

## 9.4 Warehouse — the morning shift

```
Board on the tablet: five columns, oldest and most urgent first
   ├─ 2 cards red (late) ─────► do these first
   └─ Pick an order ──► pack screen
        ├─ pick list: garment, size, colour, quantity
        ├─ logo spec: left chest · embroidery · 80×35 mm · PMS 186 C
        ├─ any line waiting on a supplier? ──► cannot start. Next order.
        └─ all in stock ──► pack ──► scan each item
             └─► Create GLS label ──► scan the parcel ──► SHIPPED
                  └─► Tracking appears in the employee's My orders automatically
```
`[C]` WH, PROTO:`packship`

## 9.5 Platform Admin — Rikke, running the machine

```
Dashboard: orders today · ready to invoice · supplier basket waiting · revenue MTD
   ├─ Notification bell: a new supplier catalogue is waiting
   │    └─► Catalogue updates ──► see the diff ──► approve ──► prices republish
   ├─ Orders & suppliers: basket at 22/25 ──► wait, or release now
   ├─ Pricing: markup, price rises, minimum DG per customer
   ├─ Below-floor customers ──► fix or override
   └─ Finance: receivables, payables, balance, cash flow, batch invoicing
```
`[C]` PA, PROTO:`dash` `catupdates` `ordreflow` `katalog`

## 9.6 Guest — a prospect

```
Lands on the public shop ──► categories, indicative prices
   ├─► Size guide
   ├─► "Put your logo on it" ──► visualiser
   └─► Request a quote ──► ??? (no specified destination — §8.10)
```
`[C]` PROTO:`pubshop` — **entire journey disputed, Q-A**

---

# 10. Cross-Role Workflows and Handoffs

The handoffs are where this product either works or generates phone calls. Each row is a point where one role's output becomes another's input.

| # | From | Hands over | To | Trigger | Notified? |
|---|---|---|---|---|---|
| H-1 | Platform Admin | A staff account (KAM / warehouse / admin) | PDT staff | Invite | Email `[D]` — **screen does not exist, §14.1** |
| H-2 | Guest | A quote request | KAM | Public form | `[U]` — no destination specified |
| H-3 | KAM | A live shop + an admin invite | Customer Admin | Activation + invite | Email `[C]` |
| H-4 | Customer Admin | A login + a budget | Employee | Invite | Email `[C]` |
| H-5 | Employee | An order | Production / Warehouse | Checkout | `[U]` |
| H-6 | Employee | An over-limit order | Customer Admin | Rule triggered | `[D]` PRD FR-4.2 — email + in-app |
| H-7 | Customer Admin | Approve / reject | Employee | Decision | `[D]` CA §E — *"the employee is notified either way"* |
| H-8 | System | A proof to sign off | Customer | Proof created | `[D]` DEV §7.1 — signed URL, **no login required** |
| H-9 | Warehouse | Parcel number + tracking | Employee | GLS label created | `[C]` — *"appears in My orders by itself"* |
| H-10 | System | Unmet demand | Platform Admin | Stock shortfall | `[U]` |
| H-11 | Platform Admin | A purchase order | Supplier | Release | Channel-dependent `[C]` |
| H-12 | Supplier | Goods + confirmation | Warehouse | Delivery | `[U]` |
| H-13 | System | An invoice | e-conomic | Disputed (Q-E) | `[C]` |
| H-14 | Employee | A return | **Nobody** | Return created | **⚠ unowned, §8.9** |
| H-15 | Supplier | A catalogue update | Platform Admin | Feed pull | `[C]` — via the notification bell |

> **Two handoffs have no receiver: H-14 (returns) and H-2 (public enquiry).** Both start a process that nothing finishes.

---

# 11. Business Rules

## 11.1 Confirmed — supported by both prototype and documentation

| # | Rule |
|---|---|
| BR-1 | An employee sees only their own company's range, at their own company's prices. |
| BR-2 | An employee sees only their own orders — never a colleague's. |
| BR-3 | The **server** decides the price at order time, re-read from the customer's price list. The browser is never trusted. |
| BR-4 | The **server** decides the remaining budget at checkout. The on-screen balance is a convenience. |
| BR-5 | What fits the budget goes on the company account; the overage is paid personally by the employee. |
| BR-6 | In points mode, kroner are hidden from the employee **everywhere, including emails**. |
| BR-7 | An employee cannot upload a logo or invent a placement — only what the design manual allows. |
| BR-8 | A KAM cannot activate a shop below the customer's minimum contribution margin. Only a platform admin can override. |
| BR-9 | A KAM sees only their own customers. |
| BR-10 | A customer admin sees only their own company. |
| BR-11 | A customer admin cannot change prices or the agreed range. |
| BR-12 | Cost prices and margins are never visible to customers or the warehouse. |
| BR-13 | An order with no logo skips the print/embroidery stage entirely. |
| BR-14 | Only legal stage transitions are offered; no stage may be skipped arbitrarily. |
| BR-15 | Nothing moves back out of *shipped*. |
| BR-16 | Shipping requires a parcel number. |
| BR-17 | The production board reflects real order status — there is no second copy of the status. |
| BR-18 | The warehouse sees no prices, margins or budgets. |
| BR-19 | People are **deactivated, never deleted**; their history survives. |
| BR-20 | Stock is checked before an order is accepted, not after. |
| BR-21 | Approving must work on a phone. |

## 11.2 Documented only — specified but not demonstrated

| # | Rule | Source |
|---|---|---|
| BR-22 | Nothing publishes itself: a supplier feed lands as a proposal with a visible diff, and a human approves it. | PA rule 1, PRD FR-2.3 |
| BR-23 | Every price change, budget change, approval decision, staff change and override is logged — who, what, when, why. | CA rule 4, KAM rule 3, PA rule 2 |
| BR-24 | The last active platform admin cannot be deactivated, and an admin cannot remove their own rights. | PA rule 3 |
| BR-25 | Stepping into a customer's account to help is logged and visible — *"support access is not silent surveillance."* | PA rule 4 |
| BR-26 | A supplier order cannot be released twice. | PA rule 6 |
| BR-27 | A customer cannot go live without a range, a price on every product in it, and a logo spec. | KAM rule 4 |
| BR-28 | Two orders placed simultaneously must not both spend the last of a budget. | EMP rule 4 |
| BR-29 | Pressing *Place order* twice must not create two orders. | EMP rule 5 |
| BR-30 | Two admins approving the same order simultaneously must not both succeed. | CA rule 6 |
| BR-31 | Two packers must not pack the same order at once. | WH rule 5 |
| BR-32 | A rejection must carry a reason. | CA §E |
| BR-33 | Invites expire and can be re-sent. | KAM rule 5 |
| BR-34 | The onboarding wizard saves a draft at every step. | KAM rule 6 |
| BR-35 | A proof must be approved before production starts. **No bypass.** | DEV §7.1 |
| BR-36 | MobilePay webhooks are idempotent on `payment_intent_id`, and every event is logged before processing. | DEV §5.3 |
| BR-37 | No order price may be edited after the order is placed — refund or credit instead. | PA "Must not" |
| BR-38 | Orders, customers and products with history are never deleted — deactivate instead. | PA "Must not" |
| BR-39 | Supplier credentials live in a secrets manager, never in the repository, the prototype, or Notion. Live credentials already exist for TEE JAYS (SFTP) and Fristads (FTP). | SUP-IMP, SUP-INT, DEV |
| BR-39a | **PF Concept feed URLs, prices and stock are contractually confidential.** They must not be disclosed to third parties; the feed URL may be shared with a webshop provider only as far as necessary. Feeds are supplied "as is" with no guarantees, and PF Concept gives two weeks' notice of structural changes. | SUP-INT |
| BR-39b | A supplier catalogue publishes **only after PDT accepts it** — then the newest catalogue replaces the previous one automatically. Notification and acceptance are the gate; replacement is the automated part. | SUP-INT, PA rule 1 |
| BR-40 | Where a supplier does not publish CO₂ (e.g. Fristads), show *"not available"* — never zero. | SUP-CAP, REV |

## 11.3 Inferred — needs confirmation before it is built

| # | Inference | Basis | Risk if wrong |
|---|---|---|---|
| BR-I1 | The approval limit is a **per-order** amount, not a per-period one. | The prototype tests one order's total against 1,000 kr `[P]`; `CA` calls it *"the approval limit"* | An employee could place ten orders of 999 kr with no oversight |
| BR-I2 | The logo surcharge is charged to **the same payer as the garment** (budget first, then personal). | The prototype adds it to the line total before the split | Changes who pays for decoration; `EMP` flags this as explicitly undecided |
| BR-I3 | A KAM may see the margin **for their own customers**, though not platform-wide cost prices. | KAM §3 requires a live margin check; `PA` reserves cost prices for admins | Either a KAM cannot do their job, or cost data leaks |
| BR-I4 | The department package is a **subset** of the KAM's agreed range, not an independent range. | `CA` forbids changing the range; the prototype allows editing department packages | A customer admin could widen their own range |
| BR-I5 | Quotas are annual. | *"say 1,500 kr for the year"*, *"reset everyone for the new year"* | Monthly customers would need a different period model |
| BR-I6 | One employee belongs to exactly one department. | Every screen shows a single department | Multi-site staff break the approver routing |

## 11.4 Unknown — no evidence either way

Budget roll-over · a leaver's unspent budget · department-level budgets · deputy approvers · approval timeouts and escalation · what a rejected order becomes · ordering on behalf of someone else · home delivery vs. company address · MobilePay captured at checkout or at dispatch · concurrent-edit behaviour outside the four cases in §11.2 · data retention and GDPR erasure mechanics for employee accounts.

---

# 12. Notifications & System Side Effects

## 12.1 Side effects of placing an order

`PROTO:confirmSplit` performs all of the following in sequence `[C]`:

1. Order created with a number and date
2. Sizes remembered per product for next time (`LASTSIZE`)
3. **An invoice is created and posted to e-conomic** for the company portion — *disputed, Q-E*
4. Revenue added to the customer's CRM record
5. The whole economic model recalculated, so every finance screen agrees
6. Cart emptied
7. Confirmation shown; receipt printable as PDF

Documented but **not** demonstrated: quota decremented `[D]`, stock reserved `[D]`, approval request raised `[D]`, MobilePay charge taken `[D]`.

## 12.2 Notification inventory

| Event | Channel | Recipient | Status |
|---|---|---|---|
| Employee invited | Email | Employee | `[C]` |
| Customer admin invited | Email | Customer admin | `[C]` |
| Staff invited | Email | PDT staff | `[D]` |
| Order needs approval | Email + in-app | Customer admin | `[D]` PRD FR-4.2 |
| Approval decided | *(unspecified)* | Employee | `[D]` CA §E |
| Proof ready | Email with signed URL, no login | Customer | `[D]` DEV §7.1 |
| Order shipped / tracking available | Appears in *My orders*; email not specified | Employee | `[C]` in-app / `[U]` email |
| Catalogue update waiting | Notification bell | Platform admin | `[C]` |
| Back-order / reorder warning | Dashboard + bell | Platform admin | `[C]` |
| Supplier basket ready to release | Dashboard | Platform admin | `[C]` |
| Approval waiting more than a day or two | *(reminder)* | Customer admin | `[D]` CA "Should" |
| Customer not visited in 90 days | KAM follow-up screen | KAM | `[C]` PROTO:`kamfollow` |
| Supplier cost price jump that breaks a margin | *(alert)* | Platform admin | `[D]` PA "Should" |

> **⚠ Gap.** The prototype's notification bell contains **hard-coded example items**. `[P]` There is no notification engine, no delivery record, and no user preference model anywhere in the evidence. Email templates, sender identity and language (Danish/English) are unspecified. `[U]`

## 12.3 Audit

An append-only audit trail is required over: price overrides and discounts · role permission updates · order approvals and cancellations · catalogue feed approvals `[D]` PRD §5.3; plus budget changes, staff changes, stage moves and support access `[D]` role specs.

The prototype shows an audit **view** with example rows. `[P]` No writer exists.

---

# 13. Exceptions & Edge Cases

## 13.1 Defined

| Case | Behaviour | Evidence |
|---|---|---|
| Cannot pick — line awaiting supplier delivery | Packing is blocked; the order stays in the queue and is flagged | `[C]` PROTO:`packAvail` |
| Back-order in the cart | Three explicit choices: complete delivery later · partial now · substitute | `[P]` PROTO:`openCart` |
| Empty states | Every list has one: empty cart, no approvals pending, no proofs, no supplier baskets | `[C]` prototype throughout |
| A page fails to render | Per-view error boundary with a retry button; one broken view never blanks the app | `[C]` PROTO:`go()` |
| Supplier CDN down / hotlink-blocked | Product image falls back to a local placeholder so the catalogue never renders empty | `[C]` REV §2 |
| Supplier does not publish CO₂ | Shown as *"not available"*, never as zero | `[C]` SUP-CAP |
| Deep link to a forbidden page | Rejected — the router only allows views in the current role's menu | `[C]` REV §1 |
| Size that cannot be delivered | Not selectable | `[C]` EMP §B |
| Invite never opened | Re-send | `[D]` |

## 13.2 Named as requirements, mechanism unspecified

Concurrent budget spend (BR-28) · double order submission (BR-29) · concurrent approval (BR-30) · concurrent packing (BR-31) · duplicate MobilePay webhooks (BR-36). All five are stated as *must nots* with no described mechanism beyond BR-36's idempotency key. `[D]`

## 13.3 Undefined

| Case | Question |
|---|---|
| Payment fails after the order is created | Is the order held, cancelled, or placed anyway? `[U]` |
| Approval never decided | Timeout? Escalation? Auto-reject? `[U]` |
| Rejected order | Editable draft, cancelled, or resubmittable? `[U]` |
| Employee deactivated with an order in flight | Does the order continue? Who receives it? `[U]` |
| Customer paused with open orders | Do they still ship? `[U]` |
| CVR lookup fails or the company already exists | `[U]` |
| e-conomic unreachable at activation or invoicing | Retry, queue, or fail? `[U]` |
| Supplier feed fails silently | *"Worse than one that errors loudly"* — no detection specified `[U]` |
| Price changes between add-to-cart and checkout | Which price applies? `[U]` |
| Product leaves the range while in someone's cart | `[U]` |
| Budget reduced below what is already committed | `[U]` |
| Partial dispatch | Named as a *Should*; unspecified `[D]` |
| Order cancellation by anyone | No cancellation flow exists in any source `[U]` |

## 13.4 The returns dead end

Steps 4–6 of W-9 have no owner (§8.9). The warehouse is explicitly barred from refunding; no other role is assigned it. **A customer can start a return that nothing in the specified system can finish.**

---

# 14. Prototype vs Documentation Analysis

## 14.1 Summary

| Classification | Count | Meaning |
|---|:--:|---|
| MATCH | 22 | Prototype and documentation agree |
| DOCUMENTATION ONLY | 19 | Specified, absent from the prototype |
| PROTOTYPE ONLY | 11 | Built, undocumented |
| CONFLICT | 9 | The two describe different behaviour |
| UNCLEAR | 30+ | Neither source is sufficient |

## 14.2 MATCH — verified in both

Per-customer range and pricing · budget/points per employee · split checkout (account + MobilePay) · logo placement and method chosen from a fixed manual · minimum-DG guardrail blocking KAM activation · admin-only override of that guardrail · 3-step onboarding wizard · e-conomic debtor created on activation · production stage sequence (print → pack → ship) · GLS scan to dispatch · stock-availability check before packing · catalogue diff before publishing · order status tracker visible to the customer · CO₂ per item and per order · greener-alternative suggestion · size guide with a find-my-size calculator · fit reviews · returns request with a prepaid label · punchout/OCI concept · daily batch invoicing · role-scoped navigation · **white-label branding per customer** *(a customer request in `SUP-INT`, built in `PROTO:whitelabel`)*.

## 14.3 DOCUMENTATION ONLY — specified, not built

| Item | Source | Impact |
|---|---|---|
| ~~**Staff screen**~~ — create KAM / warehouse / admin accounts | PA | ✅ **Built.** `/dashboard/admin/staff`. Staff now belong to a dedicated **platform organisation** (`organisations.is_platform`) rather than to a customer company, as `PA` requires. Both lockout protections are enforced server-side. |
| ~~**Audit writer**~~ | PRD, all role specs | ✅ **Built for staff changes.** `audit_log` exists, is append-only at the database level, and is written by every staff action. Other surfaces (pricing, approvals, budgets) still need to adopt it. |
| **Design manual table** | KAM, PA | **Blocking.** *"The KAM creates it, the shop reads it, the warehouse prints from it — and the table does not exist yet. It is the single biggest gap in the schema."* |
| Catalogue-update table | PA | Feed approval has nowhere to store a pending proposal |
| CVR auto-lookup | PRD, DEV | Onboarding friction |
| Preview-as-employee before go-live | KAM | Errors found after 40 people have ordered |
| Explicit go-live switch and pause | KAM | See §7.1 conflict |
| Draft-saving wizard | KAM | *"Losing a half-filled form loses a sales conversation"* |
| Go-live completeness gate | KAM | Shops could go live unpriced |
| Bulk budget actions and top-up history | CA | The most-used screen |
| Deputy approver | CA | Orders stall in July |
| Real notification engine | PRD | Every handoff |
| Proof approval loop | DEV | See Q-D |
| Barcode scan per item at packing | WH | Wrong-size prevention |
| Partial dispatch and batch shipping | WH | Real warehouse cases |
| Stock incoming windows (4/8/12/16 weeks) | DEV, SUP-CAP | Delivery promises |
| MFA for admin and finance roles | PRD | Security |
| GDPR erasure workflow | PRD | Compliance |
| ESG annual report generator | PRD | Named as a customer deliverable |
| Automatic replacement of a live catalogue on acceptance | SUP-INT | The notification and approval UI exist in the prototype; the replacement itself needs the feed pipeline |

## 14.4 PROTOTYPE ONLY — built, undocumented

| Item | Where | Note |
|---|---|---|
| **Employee access to quotes, brand library, proofing, AI room and analytics** | `NAV.medarb` | Contradicts `EMP`'s description of the role — O-1 |
| **Roles & modules matrix** (5 departments × 7 modules) | `roller` | A second, incompatible role model — O-3 |
| **Separate "personal purchase" catalogue** (`pay: 'privat'`) | `privat` | A different concept from an overage split — see conflict C-6 |
| Back-order resolution choice in the cart | `openCart` | Real business decision — O-8 |
| Bulk *"approve everything within the limit"* | `godkend` | Weakens the approval control |
| Two-step approval chain | `godkendflow` | Coexists with the flat model |
| Quote builder with VAT and setup costs | `tilbud` | Who quotes, and to whom? |
| Christmas-gift log per customer | `kamfollow` | Real KAM practice, unspecified |
| Anomaly detection screen | `anomalies` | Five hard-coded anomaly types |
| "Showme AI" natural-language finance assistant | `ai` | Significant scope, no requirement |
| Campaign banner, admin-editable | `forsidebanner` | Commercial feature, no requirement |

## 14.5 CONFLICT — the two sources disagree

| # | Topic | Prototype / PRD | Later docs | Priority |
|---|---|---|---|---|
| **C-1** | **Public shop** | Full guest shop with indicative prices, logo visualiser and quote request | `EMP`: *"No public catalogue, no guest checkout, no search engine indexing"* | **Q-A — highest** |
| **C-2** | **Approval steps** | Flat list (1) **and** a two-step chain (2) | `PRD`: 3 levels · `CA`: 1 decision with a mandatory reason | **Q-B** |
| **C-3** | **Order stages** | 5 stages, two different namings | 4 further variants across `PRD`, `DEV`, `WH` | **Q-C** |
| **C-4** | **Proof gate** | Present as a screen; the production board ignores it | `DEV`: mandatory, no bypass | **Q-D** |
| **C-5** | **Invoice timing** | At checkout | `PRD`: at dispatch, or daily batch | **Q-E** |
| **C-6** | **"Personal purchase"** | A separate catalogue of privately-paid products | `EMP`/`DEV`: the same garments, with the **overage** paid personally | High |
| **C-7** | **Customer lifecycle** | Kladde / Pipeline / Aktiv, driven by *first order* | `KAM`: Draft / Ready / Live / Paused, driven by a *go-live switch* | High |
| **C-8** | **Wizard length** | 3 steps | `KAM`: 5 steps + preview + go-live | Medium |
| **C-9** | **Who edits the range** | Customer admin edits department packages | `CA`: *"They cannot change the product range"* | Medium |

## 14.6 UNCLEAR

The 30+ items in §11.4 and §13.3, plus the eight kickoff questions in `DEV §11` (current ERP, e-conomic push, supplier credential status, minimum-DG default, MobilePay scope, routing model, AI provider evaluation, e-conomic API token).

---

# 15. Assumptions & Inferences

Every inference made in producing this document, so each can be accepted or rejected individually.

| # | Inference | Confidence | Basis |
|---|---|---|---|
| A-1 | The six prototype roles are the intended role set, despite `DEV` listing five. | Medium | Prototype + `PRD` agree on six; `DEV` omits only Guest, consistent with Guest being a Phase 4 item |
| A-2 | *Vognmand Hansen A/S*, *Byg & Bo*, *Tarm IF* etc. are demo fixtures, not real customers. | High | `HAND` describes the prototype as demo data throughout |
| A-3 | The customer admin's department-package editing is a permitted subset of the KAM's range. | Medium | Reconciles `CA`'s prohibition with the prototype's behaviour — **must be confirmed** |
| A-4 | The KAM may see margin for their own customers only. | Medium | Required by KAM §3; bounded by PA rule 5 |
| A-5 | The approval limit is per order. | Medium | Prototype tests a single order total |
| A-6 | Quotas are annual by default. | Medium | Language throughout the role specs |
| A-7 | The `roller` matrix governs PDT's internal staff, not customer roles. | Medium | Its departments (Bogholderi, Salg & service) are PDT functions |
| A-8 | "Klar / Ready" is a substate of packing rather than a distinct stage. | Low | Appears in two of six stage lists — **needs confirmation** |
| A-9 | Order confirmation emails exist. | Low | Never stated anywhere; would be unusual to omit |
| A-10 | The prototype's hard-coded 1,000 kr limit is illustrative, not the agreed value. | High | `DEV` Q4 asks for the minimum-DG default; the same reasoning applies |
| A-11 | The supplier minimums in the prototype are illustrative. | High | "Nordtex" appears in no supplier list |
| A-12 | Danish is the primary interface language; English is secondary. | Medium | Prototype is Danish throughout; the implementation carries both |

---

# 16. Open Questions

## 16.1 Blocking — implementation cannot start without an answer

| # | Question | Options | Consequence |
|---|---|---|---|
| **Q-A** | **Is there a public shop?** | (a) Full guest shop with indicative prices and quote requests (prototype + PRD) · (b) No public catalogue at all (EMP) · (c) A marketing site with no catalogue | Determines whether a sixth role exists, whether prices are ever public, SEO posture, and Phase 4 scope |
| **Q-B** | **How many approval steps, and what is captured?** | (a) 1 decision · (b) 2-step chain (manager → purchasing) · (c) 3 levels · (d) configurable per customer | Changes the data model, the notification set, and the customer admin's main screen |
| **Q-C** | **What is the definitive order stage list?** | Six variants exist; one must be chosen | Drives the employee tracker, the customer admin list, the warehouse board, and the invoice trigger |
| **Q-D** | **Is a visual proof mandatory before production?** | (a) Mandatory, no bypass (DEV) · (b) Optional per order · (c) Only for new logos · (d) Not in scope | Adds a blocking stage plus an unauthenticated customer touchpoint |
| **Q-E** | **When is a customer invoiced?** | (a) At checkout · (b) At dispatch · (c) Daily batch · (d) Monthly batch | Determines the finance integration and what happens to invoices for cancelled orders |

## 16.2 High priority

| # | Question |
|---|---|
| **Q-F** | Who receives, inspects and refunds a **return**? (W-9 has no ending) |
| **Q-G** | Who presses **send** on a supplier order — admin or warehouse? |
| **Q-H** | Where does the **design manual** live, and what exactly does it hold? *(named the single biggest schema gap)* |
| **Q-I** | Does **PDT hold stock**, or is everything bought per customer order? |
| **Q-J** | Does budget **roll over** at year end, and what happens to a leaver's balance? |
| **Q-K** | Can an admin or foreman **order on behalf of** an employee? |
| **Q-L** | Is **MobilePay** captured at checkout or on dispatch? *(Danish practice is on dispatch)* |
| **Q-M** | **Home delivery** or company address only? *(drags GDPR and shipping cost with it)* |
| **Q-N** | Does the logo surcharge come out of the **employee's budget or the company's**? |

## 16.3 Numbered open questions raised in this analysis

| # | Question |
|---|---|
| **O-1** | Why does the employee role have quotes, brand library, proofing, AI room and analytics? |
| **O-2** | Is the customer admin's department-package editing intended? |
| **O-3** | Fixed internal roles, or the configurable module matrix? |
| **O-4** | Ordering on behalf of another person — permitted, and by whom? |
| **O-5** | Who owns releasing a supplier order? |
| **O-6** | Subdomain or path routing per customer? |
| **O-7** | Is the onboarding wizard 3 steps or 5? |
| **O-8** | Is the cart's back-order resolution choice a requirement? |
| **O-9** | Does the quote itself live in the system, or in email until signed? |
| **O-10** | Are "personal purchases" a separate catalogue, or an overage split? *(C-6)* |
| **O-11** | Is print/embroidery in-house or outsourced? |
| **O-12** | What is the agreed per-order approval limit and the minimum-DG default? |
| **O-13** | What are the real minimum order quantities per supplier? |
| **O-14** | Who fixes and re-approves the PRD §3 permission matrix? *(§4.3)* |

## 16.4 Carried forward from `DEV §11`

Q1 current ERP · Q2 existing e-conomic push · Q3 supplier credential status and owner · Q4 minimum-DG default · Q5 MobilePay scope · Q6 routing model · Q7 AI provider evaluation owner · Q8 e-conomic account and API token.

---

# 17. Stakeholder Verification Checklist

Work through this with the business. A **No** anywhere is more valuable than a **Yes**.

## Roles and access
- [ ] The six roles in §3 are the right roles, with the right names.
- [ ] **The public/guest role should exist** *(or should not — Q-A)*.
- [ ] The employee should **not** have quotes, brand library, proofing, AI room and analytics *(or should — O-1)*.
- [ ] PDT's internal staff are a fixed set of roles, **not** a configurable module matrix *(or the reverse — O-3)*.
- [ ] The capability matrix in §4.1 is correct, row by row.
- [ ] A customer admin genuinely cannot change prices or the range.
- [ ] The warehouse genuinely never sees prices, margins or budgets.
- [ ] A KAM may see margin for their own customers.

## Commercial setup
- [ ] The onboarding wizard should have **3 steps** *(or 5 — Q-7)*.
- [ ] The minimum-DG guardrail should **hard-block** a KAM, with admin-only override.
- [ ] The agreed minimum-DG default is: ______ %
- [ ] A customer must not go live without a range, prices on everything, and a logo spec.
- [ ] Customer states should be **Draft · Ready · Live · Paused** *(or Kladde · Pipeline · Aktiv — C-7)*.
- [ ] Activation should be an explicit switch *(or should follow the first order)*.

## Budgets and approvals
- [ ] Budgets are **annual** *(or: ______ )*.
- [ ] The approval limit is **per order** *(or per period)*.
- [ ] The agreed approval limit default is: ______ kr
- [ ] The approval chain has ____ step(s), and the roles are: ______
- [ ] A rejection **must** carry a reason.
- [ ] The employee is notified of both approval and rejection.
- [ ] Unused budget **does / does not** roll over at year end.
- [ ] A leaver's unspent budget: ______
- [ ] An admin **can / cannot** order on behalf of an employee.

## The shop
- [ ] Points mode hides kroner everywhere, including emails.
- [ ] An employee can only pick placements from the company's design manual.
- [ ] The logo surcharge is paid by **the employee's budget / the company**.
- [ ] Personal purchases mean **an overage split** *(or a separate catalogue — C-6)*.
- [ ] When the budget is exhausted and personal purchases are off, the order should **be blocked / go for approval**.
- [ ] MobilePay is captured **at checkout / on dispatch**.
- [ ] Delivery goes to **company / department / home** *(tick all that apply)*.

## Production and dispatch
- [ ] The order stages are exactly: ______________________ *(Q-C)*
- [ ] A visual proof **is / is not** mandatory before production *(Q-D)*.
- [ ] An order with no logo skips print entirely.
- [ ] Shipping requires a parcel number, always.
- [ ] One step backwards is allowed; nothing comes back out of shipped.
- [ ] Print and embroidery are done **in-house / outsourced**.
- [ ] When an item is out of stock at packing: **split / hold / substitute**.
- [ ] The delivery date comes from ______ *(today it is derived from "2–4 working days")*.

## Supply and finance
- [ ] No supplier feed publishes without a human approving the diff.
- [ ] **______** presses send on a supplier order *(Q-G)*.
- [ ] Minimum order quantities per supplier are: *(attach)*
- [ ] PDT **does / does not** hold its own stock *(Q-I)*.
- [ ] The customer is invoiced **at checkout / at dispatch / daily batch / monthly batch** *(Q-E)*.
- [ ] e-conomic is the master for customers, prices and invoices.

## Returns
- [ ] **______** receives and inspects a returned parcel *(Q-F)*.
- [ ] **______** approves the refund or credit.
- [ ] A refund goes back as **money / credit to the clothing account / replacement**.

## Governance
- [ ] Everything in §11.2 (logging, last-admin protection, support-access visibility) is required.
- [ ] The PRD §3 permission matrix will be repaired and re-approved *(§4.3)*.
- [ ] Every inference in §15 has been accepted or corrected.
- [ ] Every blocking question in §16.1 has an answer.

---

# 18. Final Validation Summary

## 18.1 Confidently understood

The **commercial spine** is consistent across every source and can be built on: a KAM agrees a range, prices and rules per customer; a margin floor is enforced in software; the customer's own admin runs people and budgets; employees self-serve inside those budgets with an automatic company/personal split; the logo specification is agreed once and travels with every order; the warehouse works a stage board and dispatches with a scanned parcel number; supplier demand pools to a minimum before it is bought; and a human approves every catalogue change before it reaches a live shop.

The **tenancy and access model** is also consistent: strict per-organisation isolation, server-side enforcement, deactivation rather than deletion, and cost prices reserved for PDT.

## 18.2 Requires confirmation before building

Five blocking questions (§16.1) and nine further high-priority ones (§16.2). Two of the five — the order stage list and the approval model — are **structural**: they change the data model, not just a screen, and every dependent surface is blocked until they are settled.

## 18.3 Conflicts to resolve

Nine documented conflicts (§14.5). The public shop (C-1) is the sharpest: one document describes it as a feature and another forbids it in the same words. It should be resolved first, because it determines whether a whole role exists.

## 18.4 Gaps that must be filled before the corresponding work starts

| Gap | Blocks |
|---|---|
| ~~Staff creation screen~~ | ✅ Closed — see §14.3 |
| **Design manual table** | The employee's logo choice, the warehouse's pick list, and the print shop's instructions |
| **Catalogue-update storage** | The feed approval workflow |
| **Returns receiving and refund** | The end of the returns process |
| **Notification engine** | Every cross-role handoff |
| **Audit writer beyond staff** | The "must be logged" rules on pricing, approvals and budgets — the table now exists, those surfaces have not adopted it |
| **A supplier-order channel that is not uniform** | Release to any no-API supplier — F&H, PDT's only live supplier, cannot receive an order automatically (Appendix B.3) |

## 18.5 Would an engineer understand the product from this document?

**For the confirmed spine — yes.** The commercial model, tenancy, the ordering loop, the split payment, the margin guardrail, the production sequence and the supplier pooling are all specified precisely enough to build, with the rules that govern them.

**For five areas — no, and deliberately so.** Approval, order stages, proofing, invoicing and the public shop cannot be built from this document because the evidence contradicts itself. Those sections state the options and their consequences rather than choosing, because choosing them here would be inventing requirements.

**The correct next step is a working session on §16.1.** Five decisions unblock the majority of the remaining specification.

---

*Prepared from `prototype/` (8 documents + the clickable prototype), `docs/` (6 documents) and `SuuplierIntegration.md`. Every claim is tagged with its evidence and source. Where the evidence was silent, this document says so rather than filling the gap.*

---

# Appendix A · Auditable Reasoning for the Blocking Conclusions

How each blocking conclusion in §16.1 was reached, so it can be checked rather than taken on trust.

---

## A-1 · There is an unresolved contradiction about the public shop

**Observation.** The prototype ships a complete public shop for an unauthenticated `gaest` role: a hero page, category tiles, a product grid at indicative prices, a size guide, a logo visualiser and a quote request. A separate specification states the opposite in explicit terms.

**Evidence.** `PROTO:NAV.gaest` = `[pubshop, sizeguide, aistudio]`; `PROTO:pubshop` renders 40 products with prices. `PRD §3` lists Guest as a role and `PRD` Phase 4 schedules *"Finalize B2C Guest webshop and RFQ flow"*. Against that, `EMP §1–2`: *"There is no browsing without logging in. No public catalogue, no guest checkout."* and, under **Must not**: *"No public product pages, no guest checkout, no search engine indexing."* `DEV §4.1` defines five roles and omits Guest.

**Interpretation.** Two readings are possible. (1) The public shop is a real Phase 4 surface, and `EMP` is scoping only the *employee* shop — its prohibitions being about that shop, not the site. (2) The business has since decided against a public catalogue, and the prototype is stale. Reading (1) is weakened by `EMP`'s wording *"no search engine indexing"*, which is a statement about the site, not about one screen.

**Confidence.** Low that either reading is correct without asking.

**Verification required.** **Yes — Q-A.** Determines whether a sixth role exists, whether any price is ever public, and roughly a phase of work.

---

## A-2 · The approval model is undefined, not merely unbuilt

**Observation.** Four different approval models appear across the evidence, and the prototype implements two of them simultaneously on the same role.

**Evidence.** `PROTO:godkend` — a flat list with Approve/Reject, a bulk *"approve all within the limit"* action, and `splice()` deleting the record on decision with no reason captured. `PROTO:godkendflow` — a sequential two-step chain (`Nærmeste leder` → `Indkøbsansvarlig`) where step two is gated on step one. `PRD FR-4.2` — *"Employee → Department Manager → Customer Purchasing Lead"*. `CA §E` — one decision, with *"Reject with a reason"* described as the point of the feature.

**Interpretation.** These are not four descriptions of one thing at different fidelities; they differ in the number of actors, the ordering constraint, and what is recorded. The prototype's deletion behaviour additionally makes `CA` rule 4 (*"every approval decision is logged — who, what, when, and why"*) impossible to satisfy, so at least one of the two is wrong.

**Confidence.** High that a contradiction exists. Zero that any one model is the intended one.

**Verification required.** **Yes — Q-B.** The number of steps determines the schema, not the screen.

---

## A-3 · The order stage list has never been agreed

**Observation.** Six renderings of the order lifecycle exist across five sources, no two identical.

**Evidence.** `PRD FR-4.4`, `DEV §5.4`, `DEV §7.2`, `WH §A`, `PROTO:packship`, `PROTO:orderTracker` — enumerated side by side in §7.2.

**Interpretation.** They agree on the physical sequence (decorate, then pack, then ship) and disagree on: whether *Proofing* is a stage; whether *Delivered* exists; whether *Ready/Klar* is a stage or a substate; and whether the pre-production state is called Draft, Queued, Received or Approved. The disagreement is not cosmetic — `DEV §5.4` states the tracker is *"driven by `orders.status`"*, so the list is a column definition that every dependent screen reads.

**Confidence.** High that no agreed list exists.

**Verification required.** **Yes — Q-C.** Highest priority of the five: the employee tracker, the customer admin list, the warehouse board and the invoice trigger all depend on it.

---

## A-4 · Mandatory proofing is specified in one place and ignored everywhere else

**Observation.** One document makes proof approval a hard gate on production. The screen that would enforce it does not reference proofs at all.

**Evidence.** `DEV §7.1`: *"Proof approval is **mandatory** before any production starts. No bypass."* — with a customer-facing loop over a signed URL requiring no login. `PROTO:korrektur` implements a six-state proof workflow with a comment thread and a production sheet gated on approval. Against that: `PROTO:produktion` moves orders from approved directly into print with no proof check, and `WH` — the specification for the people who would be blocked — never mentions proofs.

**Interpretation.** Either proofing is a real gate that the warehouse specification omits, or it is a Phase 3 idea not carried into the rebuild specs. That `PROTO:korrektur` sits on the **employee** role rather than a PDT role (§3.2) suggests its placement was never settled either.

**Confidence.** Medium that proofing is intended; low on who performs it.

**Verification required.** **Yes — Q-D.** A mandatory gate adds a blocking stage and an unauthenticated external touchpoint — material scope.

---

## A-5 · The invoice is raised at three different moments

**Observation.** The prototype raises a **posted** invoice the instant an employee confirms an order. Two documents place invoicing later.

**Evidence.** `PROTO:confirmSplit` calls `createInvoice(MEDCUST, fTot, 'Bogført')` — *Bogført* is posted, not draft — then updates CRM revenue and recomputes the finance model. `PRD FR-5.2` specifies *"immediate posting to e-conomic upon order **dispatch**"* and, separately, a daily/monthly batch. `PROTO:samlefaktura` implements that batch for finished print work.

**Interpretation.** Invoicing at checkout bills goods that have not been picked, may prove out of stock, and — where the order exceeds the approval limit — may still be rejected. That is unlikely to be the intent, but it is what the prototype demonstrates, and the prototype is the artefact stakeholders have been shown.

**Confidence.** High that the prototype's timing is a demo shortcut. Low on which of the two remaining options is meant.

**Verification required.** **Yes — Q-E.** Determines the finance integration and what happens to an invoice when an order is cancelled or rejected.

---

## A-6 · The returns process has no owner after the label is printed

**Observation.** A return can be started but not finished by anyone described in the evidence.

**Evidence.** `PROTO:retur` and `PRD FR-4.6` cover request, reason, desired outcome and a prepaid GLS label. `PRD FR-4.6` also mentions *"inventory restocking workflows"* without naming an actor. `WH` **Must not**: *"They cannot cancel or refund an order — that is an admin decision."* `WH` open questions: *"Returns: who receives the parcel coming back, checks it and approves the refund? Currently unowned."* No other role specification claims it.

**Interpretation.** A genuine gap rather than an omission from this analysis: the warehouse specification explicitly disowns it and explicitly flags it as unowned.

**Confidence.** High.

**Verification required.** **Yes — Q-F.**

---

# Appendix B · Integration Map — where each integration plugs in

Source: `SuuplierIntegration.md` (`SUP-INT`), cross-checked against `SUP-CAP`, `SUP-IMP`, `PRD FR-2.1`, `DEV §8–9` and the prototype. This is the most current integration evidence and supersedes the two earlier supplier documents where they disagree on status.

**The question this appendix answers:** an integration is not a feature — it is a pipe into or out of a specific place in the product. Every entry below names the workflow it feeds, the entity it writes, and the screen and role that consume it.

## B.1 The four integration surfaces

Every integration in the evidence lands on exactly one of four surfaces. Nothing plugs in anywhere else.

| Surface | Direction | What arrives / leaves | Feeds workflow | Writes entity | Consumed on |
|---|---|---|---|---|---|
| **Catalogue in** | Supplier → PDT | Products, variants, EAN, images, prices, stock, CO₂/ESG | **W-7** Catalogue update | `Product`, `Product Variant` | Platform Admin → *Catalogue*, *Catalogue updates*. Then everywhere downstream: the employee shop's grid and stock badge, the warehouse's pick availability |
| **Order out** | PDT → Supplier | A released purchase order | **W-6** Replenishment | `Supplier Order` | Platform Admin → *Orders & suppliers* |
| **Money** | PDT ↔ e-conomic | Debtors, invoices, receivables, payments | **W-1** step 6 · **W-8** Order to cash | `Organisation`, `Invoice` | Platform Admin → the nine finance screens |
| **Physical & payment** | PDT ↔ GLS / MobilePay | Labels, parcel numbers, tracking; personal payment | **W-5** step 8 · **W-9** · **W-3** step 10 | `Shipment`, `Return`, `Order` | Warehouse → *Pack & ship*; Employee → *Checkout*, *My orders* |

> **The consequence worth stating plainly.** Ten supplier integrations exist so PDT's staff never retype a product or a purchase order. **No customer-facing role ever touches one.** An employee sees a stock badge; a customer admin sees an order status. Neither knows a feed exists. Any integration whose failure is visible to a customer is a design error.

## B.2 Catalogue-in — the ten supplier feeds

All ten land on the **same** surface: normalise → diff → admin approves → publish (W-7). They differ only in transport, format and cadence.

| Supplier | Transport | Format | Cadence | Status | Notes that change the build |
|---|---|---|---|---|---|
| **You / F&H** | File hand-off | Excel/CSV PIM | Batch — API existence unconfirmed | ✅ **Feed received** | 700 products · 12,402 variants · 16 categories · 14 brands. Carries **CO₂ (kg CO₂e)** and real image URLs. Already loaded as `You_katalog_fuld.json`. Customer no. 10050 |
| **TEE JAYS** | SFTP `sftp.teejays.com:22` | CSV/XML | Daily | ✅ **Access active, credentials issued** | Stock includes **incoming quantities at 4 / 8 / 12 / 16 weeks** — the only supplier giving forward availability. Master data carries **PDT's dealer-specific prices and discounts** |
| **Fristads / Kansas** | FTP `ftp.fristads.com` | CSV product + **separate XML stock** | Stock "frequent" | ✅ **Access received** | **Publishes no CO₂** — cites data-theft risk. Must render as *"not available"*, never zero. Images by mediabank link, not embedded |
| **PF Concept** | HTTPS feeds | **JSON** (chosen over XML) | Product 05:00 daily · **stock 02:00 and 13:00** · prices + print-price codes Sat 14:00 · print data 06:00 daily · attributes weekly | ⏳ Form completed, awaiting signature | Only supplier with **print-price codes** as a feed. Images by image server (live) + weekly FTP. **Confidentiality applies — BR-39a** |
| **Mascot** | FTP | CSV/Excel | Batch | ⏳ Info received | Stock is **not real time** — surface as *"updated at …"* |
| **Engel** | FTP | CSV/Excel + images | **Nightly** | ⏳ Awaiting our contact email | Fresh each morning |
| **NWG / New Wave** | GraphQL `api.gateway.nwg.se/graphql` | JSON | Live API | ⏳ Awaiting token + `assortmentId` | Covers Cottover, Clique, Harvest, Printer, Tenson and New Wave Profile in one pipe. `productSearch(assortmentId, filters)` · `productById(productNumber){ skus{ sku, availability } }`. Public pages are client-rendered and **cannot be scraped** |
| **Nimbus** | XML feed / API | XML | ⏳ Unknown | ⏳ Spec received | **Three-level structure** — parent → colour variant → size/SKU. Carries **ESG certificates** (Global Compact, Amfori, OEKO-TEX). Text in DK/DE/EN/NO/SE |
| **ID Identity** | Download Manager | Feed / download | Batch, cadence unknown | ⏳ Awaiting access | id.dk · Holstebro · CVR 16278874. Brands Geyser, PRO Wear, Seven Seas |
| **Snickers / Solid Gear** | PartnerPortal + **Bynder DAM** | Portal / DAM | Manual | ⏳ Info received | **No API.** Images richer via Bynder. Price lists via customer service; stock routed through Hultafors IT in Sweden |

### What this means for the product

- **Three data shapes must be reconciled into one.** Nimbus is three-level; You is flat SKU rows; NWG is a graph. `PRD FR-2.2` defines the normalised target schema — that adapter contract is the actual work, not the transports.
- **Stock freshness varies from live to nightly.** The employee shop and the warehouse both read stock. Both must show *when* it was last synced, or a batch number gets read as live and someone picks goods that are not there. `[C]` SUP-IMP, SUP-INT
- **CO₂ coverage is partial and will stay partial.** You and Nimbus carry it; Fristads refuses it. §11.2 BR-40 already requires *"not available"* rather than zero — this source confirms it is permanent, not a gap to be closed.
- **Only TEE JAYS gives forward availability.** A promised delivery date built on incoming-stock windows would work for one supplier out of ten. Relevant to `WH`'s open question about where a delivery date comes from.

## B.3 Order-out — how a released purchase order actually leaves

Five different mechanisms. **W-6 step 5** is the single point where they diverge.

| Supplier | Channel | Automation |
|---|---|---|
| **Mascot** | EDIFACT `ORDERS` / XML / REST — plus `ORDRSP` confirmation, `DESADV` dispatch advice, `INVOIC`/OIOUBL/Peppol invoice | Full round trip, the richest of the ten |
| **Engel** | EDI, optionally including invoice and order confirmation | Automatable |
| **Fristads / Kansas** | EDI — **no API** | Automatable |
| **Snickers / Solid Gear** | EDI offered — **no API** | Automatable if EDI is adopted |
| **NWG** | GraphQL Gateway — *whether orders can be placed this way is still open* | Unconfirmed |
| **PF Concept** | PF Concept **Gateway** (separate manual requested) | Unconfirmed |
| **You / F&H** | **No API at all.** CSV "Quick Upload" into the nsales B2B shop | **Semi-manual** |
| **ID Identity** | Dealer portal, EDI/API undecided | Unknown |
| **Nimbus** | Unknown | Unknown |
| **TEE JAYS** | Not offered — SFTP is inbound data only | n/a |

### The finding that matters most

**PDT's largest live supplier cannot receive an order automatically.** F&H/You is the only feed in production, and its order path is: *place the order in our system → export CSV → upload in F&H's B2B portal → follow stock, back-order, delivery and Track & Trace in that portal.* `[C]` SUP-INT

So **W-6 step 5 is not one action.** It is at least three: transmit (EDI/API), export-and-upload (F&H), and hand off to a portal (Snickers, ID Identity). The *"Release to supplier"* button must therefore either produce a file and mark the order as sent-by-hand, or genuinely transmit — and which of the two depends on the supplier. This is not visible anywhere in the prototype, which shows a single uniform *Frigiv* action.

> **Open question O-15:** For no-API suppliers, does *released* mean "transmitted" or "file generated, awaiting a human to upload it"? They are different states, and only one of them means the goods are coming.

## B.4 Money — e-conomic

| | |
|---|---|
| **Channel** | REST API, live |
| **Where it plugs in** | **W-1 step 6** — a customer debtor is created on shop activation. **W-8** — invoices post, and a nightly two-way reconciliation matches payments back |
| **Entities** | `Organisation` (debtor), `Invoice` |
| **Consumed on** | Platform Admin → invoices, e-conomic reconciliation, batch invoicing, receivables, payables, balance, cash flow, budget, reports |
| **Governing principle** | *"e-conomic as master"* — customers, prices and invoices should be maintained in one place `[C]` HAND §5 |
| **Confirmed by this source** | Rackbeat is discontinued; **stock and orders live in the platform itself**, and e-conomic is retained for finance only. This settles the system boundary `DEV Q1` was asking about |
| **Still blocking** | Does PDT have an account and API token? `[U]` DEV Q8 — the finance phase cannot start without it |

**Unchanged by this source:** the invoice-timing conflict (**Q-E**) remains. `SUP-INT` says what e-conomic is for, not when to call it.

## B.5 Physical and payment — GLS and MobilePay

| Integration | Where it plugs in | Entity | Role and screen |
|---|---|---|---|
| **GLS — outbound** | **W-5 step 8.** Label created, parcel number captured, order marked shipped | `Shipment`, `Order` | Warehouse → *Pack & ship*. The tracking link then appears in the employee's *My orders* **by itself** — the one integration output a customer sees directly |
| **GLS — inbound** | **W-9 step 2.** Prepaid return label | `Return` | Employee → *Returns*. **The steps after the label have no owner — §8.9** |
| **MobilePay** | **W-3 step 10.** Charges the personal share of a split checkout | `Order` (payment) | Employee → *Checkout*. Never used for the company share, which goes on account |

**Rules already recorded:** shipping requires a parcel number (BR-16); MobilePay webhooks are idempotent on `payment_intent_id` and logged before processing (BR-36). **Undecided:** whether MobilePay captures at checkout or on dispatch (**Q-L**) — Danish practice is on dispatch, and it changes the whole payment flow.

## B.6 One more integration, easy to miss

**CVR lookup** (`cvrapi.dk`) plugs into **W-1 step 2** — it auto-fills company name, address and contact details in the KAM's onboarding wizard, writing `Organisation`. Specified in `PRD FR-1.1` and `DEV §5.6`; **absent from the prototype**, where every field is typed by hand. `[D]`

## B.7 Two customer requests recorded only in this source

Both are commitments to a customer that appear in no requirement document, and both are already built as prototype UI.

| Request | What was asked for | Where it plugs in | Status |
|---|---|---|---|
| **Catalogue auto-publish** | When a supplier delivers a new catalogue, PDT is **notified**; on **acceptance** the system publishes the newest catalogue to the site, replacing the old one | **W-7 steps 4–6.** Confirms `PA` rule 1 rather than contradicting it — acceptance is the gate, replacement is the automated part (BR-39b) | Notification + review UI exist in the prototype; **automatic replacement needs the feed pipeline** `[D]` |
| **White-label per customer** | A customer's shop carries **their own logo and colours**, so it looks like their own site | Per-tenant branding on `Organisation`; read by the employee shop and every customer-facing email | Built as `PROTO:whitelabel`. `SUP-INT` places it in "Phase 1/2"; `PRD` schedules nothing equivalent — **the phase assignment is unconfirmed** |

> **Note for stakeholders.** White-label was classified in §14.4 as *prototype-only, no requirement*. This source supplies the requirement, so it moves to **MATCH**. It is a reminder that a commitment made in a customer conversation only becomes a requirement once it is written down somewhere the build team reads.

## B.8 Integration readiness

| State | Suppliers |
|---|---|
| ✅ **Ready to wire** — access in hand | You / F&H (feed) · TEE JAYS (SFTP live) · Fristads / Kansas (FTP live) |
| ⏳ **Blocked on us** | Engel (needs our contact email + EDI lead) · PF Concept (sign and return the form) · TEE JAYS (confirm which of the three data types) · Snickers (decide on EDI, request portal access) |
| ⏳ **Blocked on them** | NWG (token + `assortmentId`) · ID Identity (Download Manager access) · Mascot (FTP details, test files) · Nimbus (endpoint + access) |
| 🔒 **Never automatable** | F&H ordering — CSV upload into their portal is the ceiling they offer today |

**Four of the eight blocked items are waiting on PDT, not on a supplier.** They are contact details and a signature, not engineering.

## B.9 Additions to the open questions

| # | Question |
|---|---|
| **O-15** | For no-API suppliers, does *released* mean transmitted, or file-generated-awaiting-upload? |
| **O-16** | Which of the ten feeds are in scope for the first release? Three have live access; ten is a different project from three. |
| **O-17** | How is a silently failed feed detected, and who is told? Specified nowhere, across fourteen documents. |
| **O-18** | Does the delivery date use TEE JAYS' incoming-stock windows, given no other supplier provides them? *(Relates to `WH`'s open question about where a date comes from.)* |
| **O-19** | Is white-label Phase 1/2 as `SUP-INT` states, or later? It is already built in the prototype and promised to a customer. |
| **O-20** | Who owns the PF Concept confidentiality obligation (BR-39a) in the architecture — does it constrain exports, logs, or support access? |
| **O-21** | **Cancelling an invitation that was never accepted.** `PA` covers deactivating a leaver and re-sending an unopened invite, but not withdrawing one — the case where the wrong address was typed. Building the Staff screen made it visible; it is not modelled. |
