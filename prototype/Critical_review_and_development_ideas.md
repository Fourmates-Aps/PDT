# Critical review + development ideas

*Profil Design Trading — platform prototype. Full-site review: code audit (syntax, function calls, routing, CSS variables, colours, data, a11y, roles) plus a list of new development ideas.*

---

## 1. Fixed in this pass

The following issues were found **and fixed** directly in the prototype (syntax verified afterwards):

- **Leftover green after the redesign.** Eight places still used hardcoded green colours that survived the switch to charcoal + white + gold: the batch-invoice header and menu, the active sidebar-item indicator, the clothing-account point bar, the conversion funnel and "most chosen products" in analytics — and most importantly, in **dark mode** all page headings, KPI numbers and "green" status tags rendered green. All are now gold/charcoal.
- **Invalid CSS variable.** Three places used `var(--muted)`, which doesn't exist (only `--mut` is defined), so the text colour fell back to full black instead of muted grey (quote table headers, price-step labels, the "remove colour" button). Changed to `var(--mut)`.
- **Role leak via URL.** Any role — including the public guest — could type e.g. `#/regnskab`, `#/audit` or `#/receivables` in the address bar and see admin finance/CRM, because the hash router didn't check the role. The router now only allows pages present in the current role's menu.
- **Missing alt text on product images.** All catalog/shop images had empty `alt=""`. They now use the product name so screen readers can read them.

Positive from the audit: the JavaScript is syntactically clean, every `onclick` handler resolves to a defined function, every menu item points to a real page, no dead pages, no duplicate product IDs, and both `localStorage` and the router are wrapped in error handling, so a single failing view won't blank the whole app.

---

## 2. Recommended next fixes (non-critical)

- **Image fallback should be local.** Product images load from you.dk / Unsplash with a single fallback to picsum.photos. If both are down (or offline), a permanently broken image shows. A small inline SVG placeholder was added as the final fallback, so the catalog never renders empty.
- **Guest sees cart/favorites.** The public price-list shop still showed cart and favourites icons in the top bar. These are now hidden for guests.
- **`--charcoal` unused.** `#1c1c1c` was hardcoded in many places even though `--charcoal` is defined. Consolidated so the theme has one source of truth.
- **Language mix in catalog data.** A few category names were Norwegian (Gensere, Treningstøj, Handlenett, Reiseeffekter). Normalised to Danish.

---

## 3. Development ideas

New features, grouped by area. Can be prioritised into the phase plan.

### Webshop & customer experience
Size guide with a measurement table and "find my size", including saved employee measurements. Internal colleague reviews/ratings ("my colleagues rate this jacket 4/5 on fit"). "Buy again" shortcut that reorders the last order or a full set. Wishlist/favourites shareable with the purchasing lead. Stock status and expected delivery date per variant (green/amber/red) — shown clearly as "updated at …" so batch stock isn't read as live. Bundle/package deals (e.g. "new-hire pack": trousers + 3 t-shirts + softshell).

### Logo, print & AI fitting room
Logo upload with automatic background removal and placement suggestions. Multiple placements per product (chest, back, sleeve) with price per placement and print type (embroidery/print/transfer). Approved logo library per customer so employees can only pick released variants. Automatic logo resolution and colour check (Pantone/CMYK) with a warning before production. 3D/360° view of the product with logo.

### B2B account & ordering
Budget/quota per employee or department with automatic stop or approval flow on overspend. Approver hierarchy (employee → manager → purchasing). Cost-centre/dimension codes on each order for booking per department. Scheduled/recurring orders (e.g. new-hire onboarding triggers a set automatically). Punchout/OCI against the customer's own procurement system for larger customers.

### Production & logistics
Production queue with status per order (draft → proof → print → pack → shipped) and estimated completion. Barcode/QR on packing slips and labels for pack-and-ship. Partial deliveries and back-order handling. Return/exchange flow with a prepaid label. Capacity overview in the print shop (how many orders can be met this week).

### Integrations
Finish supplier feeds: Fristads/Kansas (FTP CSV + XML stock), TEE JAYS (SFTP), Mascot/Engel (FTP+EDI), NWG/New Wave (GraphQL), You (live), Snickers/Hultafors (EDI + Bynder). A shared "integration layer" that normalises all feeds into one product model. Two-way e-conomic (invoices, receivables, payables). Shipping: GLS/PostNord label + track & trace back into the order. Payment: MobilePay/card for private purchases with a signed webhook.

### Economy, CRM & sales
Extended KAM follow-up: automatic reminders ("not visited in 90 days"), next steps and pipeline value per customer. Contribution margin per order/customer/item with a warning below minimum. A customer dashboard the customer can log into (spend, open orders, invoices). Automatic monthly batch invoice per customer. Upsell suggestions based on what similar customers buy.

### Sustainability
CO₂ per order and per customer with an annual report the customer can use in their own ESG accounting. "Greener alternative" suggestions at product selection. Handle that some suppliers (e.g. Fristads) don't share CO₂ publicly — show "not available" gracefully rather than missing data.

### Catalog operations (builds on the new approve flow)
Diff view showing exactly what changes when a new catalog arrives (new/discontinued items, price changes) before approval. Automatic price recalculation of customers' net prices when the purchase price changes. History/rollback on catalog versions.

### Admin, security & operations
Real server-side login/role management (the prototype's role switch is demo only). Audit log on all price changes and order approvals. Secrets manager for supplier logins (must not live in code/repo). Backup and GDPR/consent management. Simple A/B or campaign control on the homepage.

### Mobile & marketing
Mobile-friendly ordering flow for people in the field. Campaign banners and featured products on the homepage, controlled without code. Newsletter export of customers/segments. QR code in the showroom that opens the right product in the shop.

---

## 4. Built in the prototype after the review

The following features were subsequently built into the prototype (all syntax-verified):

- **Catalog diff before approval** — "See changes" shows new/discontinued items and price changes (±) before a new catalog is approved and published.
- **Size guide** — dedicated page with a "find my size" calculator (chest → suggested size, table highlights the row). In the employee and guest shops.
- **Customer portal** (self-service) — spend, open orders, invoices, order **track & trace**, and downloadable **CO₂/ESG report**.
- **Fit reviews** — colleague ratings and fit tendency on the product page, plus an **aggregated reviews page** across the assortment.
- **Greener alternative** — suggests a lower-CO₂ product in the same category and shows the saving.
- **Cart** — cross-sell ("often bought with") and **order CO₂ total**.
- **Bell notification** — pending catalogs surface in the notification bell with a direct link to review.
- **Campaign banner** — admin-editable homepage banner (label/title/text, on/off) with live preview.
- **Showroom QR** — QR code on the product that opens it in the shop on a phone.
- **Budget & approval** — per-order budget limit + approver hierarchy (manager → purchasing) with step-by-step approval.
- **Punchout / OCI** — setup per large customer (SAP Ariba, Coupa, etc.).
- **Returns & exchange** — flow with a prepaid GLS return label.
- **e-conomic reconciliation** — two-way invoice matching with status.

Note: these are **prototype UI**. Real behaviour (auto-publish, punchout, reconciliation, payment, etc.) needs a backend and integration layer — see the phase plan.

---

*Sections 1 and 4 are in the prototype. Sections 2 and 3 are input for prioritisation.*
