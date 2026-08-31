> Concrete checklist for the build team: what remains to go from the current prototype to a real webshop. Prioritised P0→P3 + innovative ideas, mapped to the agreement's 4 (+1) phases.
> 

## P0 — Critical (blockers — must be done before real payments)

- [x]  Backend + database (replaces the prototype's localStorage)
- [x]  Auth + server-side authorization (replaces the role picker)
- [x]  Relational product/variant/stock model — variants now carry the supplier SKU; matching resolves SKU → EAN → colour+size
- [x]  Server-side price calculation (never from the browser)
- [ ]  Payment integration via **Stripe** (card + MobilePay) with signed webhook + idempotency — decided 2026-08-31, see `docs/PRODUCT-WORKFLOW-SPEC.md` D-11
- [x]  Order/transaction database
- [x]  Stock control/reservation (avoid overbooking) — checked under a row lock at placement; `npm run check:stock`

## P1 — High (before public launch)

- [ ]  Real product data + images from supplier feeds (see feed status below)
- [ ]  Real product search (typos, synonyms, SKU, "no results" suggestions)
- [ ]  Faceted filtering (size/colour/fit/price/material) + shareable URLs
- [ ]  Return, exchange and refund flow
- [ ]  Email flows (order confirmation, dispatch, return, refund)
- [ ]  Analytics + cookie consent + e-commerce events
- [ ]  SEO foundation (per-page URL/title/meta, Product/Offer/Breadcrumb schema, sitemap)
- [ ]  GDPR (consent, data export, deletion) — requires a specialist

## P2 — Medium (friction / conversion)

- [ ]  Variant images (switch per colour) + gallery/zoom on product page
- [ ]  Product cards: colour swatches, size availability, hover alt image, was/sale price, badges
- [ ]  Discount code / gift card engine (validation, combination rules, expiry)
- [ ]  Mobile: touch targets, CLS, image weight on 4G
- [ ]  Performance: bundling/CDN/srcset/image compression
- [ ]  Audit log + bulk editing in admin
- [ ]  Size guide per brand

## P3 — Low (cosmetic / nice-to-have)

- [ ]  Empty/error/loading states everywhere
- [ ]  Trust elements + customer reviews
- [ ]  Micro-interactions and details

## Innovative ideas (phase 5 — differentiation)

- [ ]  Intelligent size assistant (reduces returns)
- [ ]  Outfit builder / "shop the look"
- [ ]  Visual search (upload image → similar products)
- [ ]  Return prevention (analysis per product/size → improve size guide)
- [ ]  Demand/stock forecasting (linked to supplier feeds)
- [ ]  Conversational shopping (existing products only, never invented price/stock)
- [ ]  Company employee portal, digital wardrobe, circular take-back

## Phase mapping (the agreement)

- **Phase 1:** P0 — backend, auth, product/variant/stock, webshop + order flow, hosting.
- **Phase 2:** P1/P2 — product data/images, search/filters, product page, size, AI fitting room + quotes in production.
- **Phase 3:** P0 payment + return/refund + emails + audit log.
- **Phase 4:** integrations (e-conomic, supplier feeds), analytics, SEO, CRM/KAM.
- **Phase 5:** innovative ideas.

## Supplier feed status (input to P1)

- [x]  **You** — live feed received (700 products / 12,402 variants, incl. CO₂). Missing: API/cadence clarification.
- [ ]  **Mascot** — EDI/API + FTP. Missing: FTP contact email + technical EDI contact.
- [ ]  **Engel** — FTP (nightly) + EDI. Missing: contact email + EDI contact.
- [ ]  **NWG / New Wave** (incl. Cottover, Clique) — GraphQL. Missing: token + assortmentId.
- [ ]  **ID Identity** — Download Manager. Missing: dealer login + file format/cadence.
- [ ]  **Kansas** — clarified (PIM feed, not M3). Missing: the feed itself.

## The 10 most important next actions

1. Build backend + database (phase 1) — everything else depends on this.
2. Real auth + server-side authorization.
3. Relational product/variant/stock model (SKU per variant).
4. Server-side price calculation.
5. Payment (card + MobilePay) with webhook + idempotency.
6. Pull real product data + images from feeds (You live; others after contact/access).
7. Order, return and refund handling + audit log.
8. Email flows.
9. Analytics + consent + events.
10. SEO foundation.

## Built in prototype (Aug 2026)

- **Catalog update / approve / auto-publish flow** (admin → Operations → 🔔 Catalog updates): supplier catalog updates arrive as notifications with a change summary; admin can **Approve & publish** (replaces the previous catalog) or **Reject**. Prototype shows the flow only — real auto-publish to the live site needs the backend/feed pipeline.
- **White-label customer shop** (admin → Sales → 🏷️ White-label shop): set customer name, upload their logo and pick a brand colour, with a live preview of the customer's own storefront (their logo/colour in the header, PDT assortment/prices, "Powered by Profil Design Trading"). Production needs per-customer shop URL/subdomain, theming stored server-side, and access control.

Also done: whole-site retheme to the customer's charcoal + white + gold look; public homepage (hero, categories, promos, product grid); suppliers **TEE JAYS** (SFTP: stock + master data + invoices) and **Snickers/Solid Gear (Hultafors)** (EDI, PartnerPortal + Bynder, stock via Hultafors IT SE) added to the supplier overview.

## More features built in prototype (Aug 2026, session 2)

After a critical code review (fixed: leftover green in dark mode, invalid CSS var, URL role-leak, image alt text, local image fallback, guest cart hidden, Danish category names), the following were added to the prototype UI:

- **Catalog diff before approval** — "See changes" shows new/discontinued items and price changes (±) before a new catalog is approved/published.
- **Size guide** — dedicated page with a "find my size" calculator (chest → suggested size).
- **Customer portal** (self-service) — spend, open orders, invoices, order **track & trace**, and downloadable **CO₂/ESG report**.
- **Fit reviews** — colleague fit ratings on the product page + an aggregated reviews page.
- **Greener alternative** — suggests a lower-CO₂ product in the same category.
- **Cart** — cross-sell ("often bought with") and **order CO₂ total**.
- **Bell notification** — pending catalogs surface in the notification bell, linking to review.
- **Campaign banner** — admin-editable homepage banner (label/title/text, on/off) with live preview.
- **Showroom QR** — QR code on the product that opens it in the shop on a phone.
- **Budget & approval hierarchy** — per-order budget limit + approver chain (manager → purchasing), step-by-step.
- **Punchout / OCI** — setup per large customer (SAP Ariba, Coupa, etc.).
- **Returns & exchange** — flow with a prepaid GLS return label.
- **e-conomic reconciliation** — two-way invoice matching with status.

All are prototype UI; real behaviour (auto-publish, punchout, reconciliation, payment) needs the backend + integration layer per the phase plan.