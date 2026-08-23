> Internal operating document for Rune, Rasmus and the external build team. The client has approved the direction; the week-31 meeting closes the last open points.
> 

## 1. Client & context

**Profil Design Trading** — workwear, corporate wear and business gifts · Vejle · Billund · Fredericia · Skjern. Builds on the prototype (`ProfilDesignTrading_Platform.html`) and delivers a unified role-based B2B/B2C platform in four phases across autumn 2026.

## 2. Observations — advisory capital

- **Four departments with different assortments** — needs department-controlled catalogue and access.
- **Workwear on company account/points + personal purchase via MobilePay** — two payment logics in one flow.
- **Logo placements handled manually today** — design manual + AI fitting room removes errors.
- **Order → invoice is double work** — the auto-chain is the big time saving.
- **Ongoing operations don't run themselves** — foundation for a monthly licence/operations agreement.

## 3. What the platform can do

- Role-based B2B/B2C webshop (employee, customer admin, KAM, warehouse, admin)
- AI fitting room with logo/print/placement view
- Quote and proofing flow with customer approval
- Warehouse, pack & ship, production-ready export
- Integrations to finance, shipping and suppliers (where data is available)
- CRM, KAM follow-up and analytics
- Self-service customer-shop creation (later phase)

## 4. Phase plan with scope boundaries

### Phase 1 — Webshop + order flow · DKK 90,000

**In scope:** new website + B2B/B2C webshop in PDT identity; role-based login; product catalogue with variants (colour, size, fit), cart, checkout; company on account/points + personal via MobilePay; order flow with confirmation/status/notifications; mobile optimisation + hosting.

**Out of scope:** AI fitting room, integrations, CRM, warehouse/pack & ship.

**Depends on PDT:** identity/graphics, product data, one contact person.

### Phase 2 — AI fitting room, price calculator, quotes & brand library · DKK 55,000

**In scope:** AI fitting room (logo/print/placement realistically on product); embroidery shown clearly; logo upload + brand library; price calculator (volume discount, setup); size guide per brand on available data; quote generator with print/PDF.

**Out of scope:** photorealistic embroidery render; individual size advice without data.

### Phase 3 — Proofing, production & warehouse · DKK 45,000

**In scope:** visual proofing with status/comments/customer approval; production-ready export/production sheet; stock, pack & ship, GLS shipping.

### Phase 4 — Integrations, finance, CRM/KAM & analytics · DKK 35,000

**In scope:** e-conomic + auto order→invoice→CRM chain incl. consolidated invoicing; supplier integration where data is available; MobilePay, GLS; CRM with KAM follow-up + analytics dashboard; final testing, bug fixing, documentation, handover.

**Risk note (internal):** Phase 4 is the hardest technically but priced lowest. Phase 1's margin must absorb any overrun. Analytics kept to fixed KPIs.

## 5. Technical baseline — non-negotiable

- **Real backend + database** from the start — not the prototype's localStorage.
- **Auth + access control** as foundation, not bolted on.
- **Multi-tenant data model** (org/department isolated) — paves the way for self-service customer-shop creation.
- **Integrations as a separate layer** — finance and order system as modules, not hardcoded.
- **Usage tracking per tenant on AI calls** — logged from day one; needed for the later licence model.
- **The prototype is a spec and UI reference — not the production codebase.**

**AI fitting room — engine (internal, not in the offer):** connect to an image API; choose model by price per *acceptable* result; target ~DKK 0.50/generation; cache + rate-limit; generation economics in the monthly licence after delivery.

## 6. Roles & split

| Role | Responsibility |
| --- | --- |
| **Rune** | Client relationship, contact point, offer, approvals |
| **Rasmus** | Build lead, technical baseline, AI fitting room, coordination of external team |
| **External team** | Development across phases, per the agreed baseline |

## 7. Advisory track — after delivery

- **Monthly operations/licence agreement:** hosting + operations, maintenance, support/SLA **and** AI usage. Sold as a subscription / peace of mind.
- Model: fixed monthly licence with a reasonable generation cap, above which it is billed.
- Ongoing expansion from the observations in section 2.

## 8. Corrections to the offer (incorporated)

1. Fixed hourly rate for add-ons: **DKK 895/h excl. VAT**.
2. AI fitting room + embroidery: describe outcome, not method; no supplier/model names.
3. Size advisor: data-dependent.
4. Phase 4: toned down to "supplier integration where data is available".

Total unchanged: DKK 250,000. No phases removed.