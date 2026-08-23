# Profil Design Trading — platform prototype

Clickable frontend prototype for a unified B2B/B2C platform for **Profil Design Trading ApS** (workwear, corporate wear and business gifts · CVR 35657886 · showrooms in Vejle, Billund, Fredericia, Skjern). Used to demonstrate the flow and align requirements **before** the real build.

> **Status — read this first.** This is a **prototype, not a webshop.** It is a single HTML file with CSS + vanilla JavaScript. There is **no backend, database, authentication, payment, shipping, email, CMS, analytics or tests.** Data is hardcoded demo data and the only persistence is the browser's `localStorage`. **It must not receive real payments and is not production-ready.** Everything that makes it a real shop is the 4‑phase build (see the offer and backlog in Notion).

## Run it

Open `index.html` (redirects to `ProfilDesignTrading_Platform.html`) in a modern browser (Chrome/Edge/Safari). No build, no server, no `npm install`. Requires internet (product/model images are loaded from external sources).

## Roles (chosen on the login screen)

| Role | Sees / can do |
|------|----------------|
| **Employee** | Own shop: workwear on company account/points + personal items via MobilePay. Logo preview, cart/checkout (demo), account, orders. |
| **Customer admin** | Dashboard, employees, departments, clothing account, approvals, orders. |
| **Key Account Manager (KAM)** | Overview, pipeline, create customer shop, design manual, **customer follow-up** (visits, gifts, contacts). |
| **Warehouse** | Pack & ship (GLS), stock, product flow. |
| **Admin (Profil Design)** | Everything: CRM, sales pipeline, production, economy, catalogs, pricing, roles & modules, **supplier data sources**, branding. |
| **Guest (public)** | Public shop with guideline prices — pick a garment, add logo, request a quote. |

## What is built (in the prototype)

Role-based storefront, AI fitting room (logo/print/placement on a model), quote generator, visual proofing & orders, production sheet, brand library, KAM follow-up, analytics dashboard, economy model, public guest shop, CO₂/sustainability display, and a supplier data-source overview. See the feature catalogue and customer-journey findings in the critical review.

## Product data & suppliers

Real product images/data come from **supplier feeds** in production. Current status:

| Supplier | Channel | Status |
|----------|---------|--------|
| **You (you.dk)** | Full PIM feed (Excel/CSV) — SKU, EAN, price, images, **CO₂** | **Feed received** — 700 products / 12,402 variants. 80 real items loaded into the demo; full catalogue exported to `You_katalog_fuld.json`. |
| **Mascot** | EDI/API (orders) + FTP (product/stock/images) | Integration info received — awaiting FTP contact + technical EDI contact. |
| **Engel** | EDI (orders) + FTP nightly (product/stock/images) | Integration info received — awaiting contact email + EDI contact. |
| **NWG Gateway / New Wave** (incl. Cottover, Clique) | GraphQL API (products, SKU/availability, orders) | Docs received — awaiting token + assortmentId. |
| **ID Identity** | Download Manager (product data + images) | Info received — awaiting dealer login + format/cadence. |
| **Kansas / Fristads** | PIM/webshop feed (clarified: not full M3 item master) | Clarified — awaiting the feed. |

Back office: **e-conomic** (finance). Stock & orders will live in the platform itself (Rackbeat is not used going forward).

## Architecture notes (for the build team)

Everything is in one HTML file: markup + `<style>` + `<script>`. `DATA` holds demo products/customers; `STORE` wraps `localStorage`; `VIEWS` contains ~60 view functions; `go(id)` is the router. **Use the prototype as a spec and UI reference — not as the production codebase.** The real build needs a proper backend, database, auth, server-side pricing/stock, payment, and an integration layer (see backlog).

## Project documentation (Notion)

- **Project area:** https://app.notion.com/p/3b8108343b4e81a0a9d3da19e93e8ac7
- **Backlog & to‑do (prototype → production, P0–P3 + ideas):** https://app.notion.com/p/3b9108343b4e811fafcfc5784ea91562
- **Operating document (build plan):** https://app.notion.com/p/3b8108343b4e8142a938ece70389e3bd
- **Offer & agreement:** https://app.notion.com/p/3b8108343b4e81c1b984e7e69706af26
- **Supplier integrations:** https://app.notion.com/p/3b8108343b4e813c8944fe09a230d030

## Before going live

Before real payments: backend, auth, server-side pricing/stock, payment with signed webhook + idempotency, order database. Before public launch: the above + real product data/images, emails, returns, GDPR/consent, SEO basics, analytics. Details and priorities are in the Notion backlog.

---

*Prototype developed iteratively. The file is self-contained and can be edited directly — no setup required.*
