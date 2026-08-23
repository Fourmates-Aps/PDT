# Product Requirement Document (PRD) — Profil Design Trading Platform

**Document Version:** 1.0.0  
**Status:** Approved for Production Specification  
**Target Platform:** Unified B2B/B2C Workwear & Corporate Wear Platform  
**Owner:** Profil Design Trading ApS (CVR 35657886)  
**Showrooms:** Vejle, Billund, Fredericia, Skjern  

---

## 1. Executive Summary & Business Objectives

### 1.1 Business Background
Profil Design Trading ApS (PDT) is a leading Danish distributor of workwear, corporate apparel, promotional textiles, and corporate gifts operating across four regional showrooms (Vejle, Billund, Fredericia, Skjern). PDT serves a diverse corporate client base ranging from small regional contractors to enterprise accounts with thousands of employees across multiple operational departments.

### 1.2 Core Problem Statement
Currently, corporate clothing management in the B2B sector suffers from heavy administrative friction:
* Manual order entry via email/phone and legacy spreadsheets.
* Uncontrolled employee spending without real-time quota enforcement or budget caps.
* Lack of standardized logo/print specifications causing production errors and costly re-prints.
* Slow supplier catalog synchronization and manual invoice reconciliation in finance (e-conomic).
* Fragmented customer visibility into stock, order status, track & trace, and ESG metrics.

### 1.3 Strategic Solution & Product Vision
The **Profil Design Trading Platform** is a unified, multi-tenant B2B/B2C platform designed to automate the entire lifecycle of corporate workwear and business gifts:
1. **Self-Service Corporate Portals:** Employees order approved workwear using allocated points/budgets or personal payment (MobilePay), with real-time logo visual proofing.
2. **Automated Governance:** Customer Admins manage employees, departments, quotas, and multi-tier approval flows with strict margin guardrails.
3. **Supplier Data Integration:** Automated feeds (FTP, SFTP, GraphQL, REST, EDI) normalising product, stock, price, and CO₂ data across major suppliers (F&H/You, Mascot, Fristads/Kansas, Engel, TEE JAYS, New Wave Group, ID Identity, Snickers).
4. **End-to-End Production & Logistics:** Seamless Kanban-based print/embroidery workflow, barcode-driven pack-and-ship (GLS), and automated batch invoicing synchronized with e-conomic.

---

## 2. System Architecture & Technical Strategy

### 2.1 Architectural Transition (Prototype → Production)
The system transitions from the single-file HTML prototype (`ProfilDesignTrading_Platform.html`) to a scalable, API-first micro-services or modular monolith backend.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Client Applications (Web & Mobile)                │
│   Employee Shop  │  Customer Admin  │  KAM Portal │ Warehouse │ Admin  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS / REST / GraphQL / WSS
┌────────────────────────────────────▼────────────────────────────────────┐
│                    API Gateway & Authentication Service                 │
│         Role-Based Access Control (RBAC)  │  JWT Token Validation       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────┴────────────────────────────────────┐
│                             Core Microservices                          │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ │
│ │ Catalog & PIM │ │ Budget & Rules│ │ Order & Proof │ │ Production    │ │
│ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘ │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                     Integration Layer & Master DB                       │
│  PostgreSQL Master Database  │  Redis Cache  │ Secrets Manager          │
└────────┬───────────────────────────┬───────────────────────────┬────────┘
         │                           │                           │
┌────────▼────────┐         ┌────────▼────────┐         ┌────────▼────────┐
│ Supplier Feeds  │         │ Finance Engine  │         │ Logistics API   │
│ FTP/SFTP/GraphQL│         │ e-conomic REST  │         │ GLS / PostNord  │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

### 2.2 Core Design System & UX Standards
* **Color Palette:** Charcoal (`#1c1c1c`), Clean White (`#ffffff`), Accent Gold (`#d4af37`), Muted Gray (`#71717a`), Slate Dark Backgrounds (`#121212`).
* **Typography:** Inter / System UI sans-serif stack.
* **Layout:** Responsive, mobile-first ordering for field workers, collapsible left sidebar with accordion navigation for administrative roles.
* **Accessibility:** WCAG 2.1 AA compliance, full screen reader support with descriptive image alt text, keyboard navigation (`⌘K` / `Ctrl+K` global search shortcut).

---

## 3. Role-Based Access Control (RBAC) & Feature Matrix

The platform strictly segregates capabilities based on user roles enforced at both the API gateway and frontend routing levels:

| Feature / Module | Guest (Public) | Employee | Customer Admin | KAM | Warehouse | Platform Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Public Catalog & Prices |  |  |  |  |  |  |
| Personal Quota / Points Shop | ❌ |  | ❌ | ❌ | ❌ |  |
| Mixed Checkout (Points + MobilePay) | ❌ |  | ❌ | ❌ | ❌ |  |
| Employee & Department Mgmt | ❌ | ❌ |  | ❌ | ❌ |  |
| Budget & Approval Rules | ❌ | ❌ |  | ❌ | ❌ |  |
| KAM Sales Pipeline & Onboarding | ❌ | ❌ | ❌ |  | ❌ |  |
| Customer Follow-up & Visits | ❌ | ❌ | ❌ |  | ❌ |  |
| Pack & Ship Kanban + GLS Scan | ❌ | ❌ | ❌ | ❌ |  |  |
| Financial Management & e-conomic | ❌ | ❌ | ❌ | ❌ | ❌ |  |
| Supplier Catalog Feed Approval | ❌ | ❌ | ❌ | ❌ | ❌ |  |
| Pricing Rules & Margin Guardrails | ❌ | ❌ | ❌ | ❌ | ❌ |  |
| System Audit Log & Role Matrix | ❌ | ❌ | ❌ | ❌ | ❌ |  |

---

## 4. Functional Requirements

### 4.1 Customer Onboarding & KAM Pipeline

#### FR-1.1: 3-Step Customer Onboarding Wizard
* **Step 1 (Stamdata):** CVR lookup (auto-completing company name, address, contact details), EAN number, payment terms (e.g., Net 30), default price agreement, employee count.
* **Step 2 (Assortment Selection):** Select allowed product catalogs and categories from the master catalog.
* **Step 3 (Activation & e-conomic Sync):** Automatic creation of the customer debtor record in e-conomic via REST API.

#### FR-1.2: Margin Guardrail & Pipeline Enforcement
* The system calculates expected Contribution Margin (Avance / DG %) based on employee count $\times$ selected assortment baseline.
* If expected DG % falls below the Platform Admin's global `minimum-DG` threshold:
  * Key Account Managers (KAMs) cannot activate the shop directly.
  * The shop enters an "Approval Required" state requiring explicit Platform Admin override.

#### FR-1.3: Customer Visit & Follow-Up Tracker
* KAM dashboard tracking customer touchpoints, last visit timestamp, automated 90-day inactivity reminders, gift logs, and pipeline deal stage progression.

---

### 4.2 Product Master & Supplier Data Integration Layer

#### FR-2.1: Multi-Supplier Feed Adapters
The platform must implement scheduled integration adapters for all key suppliers:

| Supplier | Transport | Data Format | Capabilities Provided |
| :--- | :--- | :--- | :--- |
| **F&H Group / You** | HTTPS / CSV | CSV / Excel Feed | 700 products / 12,402 SKUs, EAN, List/Net prices, CO₂ metrics, CDN images. |
| **TEE JAYS** | SFTP | CSV / XML | Master data, image links, stock levels including 4/8/12/16-week incoming stock projections. |
| **Fristads / Kansas** | FTP | CSV (Data) / XML (Stock) | Product master, multi-language data, mediabank links, EDI order placement. |
| **Mascot** | FTP & REST/EDI | CSV / EDIFACT / XML | Products, stock, transactional documents (Order, Despatch, Invoice). |
| **Engel** | FTP Nightly | CSV / XML / EDI | Master data, nightly stock updates, EDI ordering. |
| **New Wave Group** | GraphQL API | JSON (GraphQL) | Live products, SKU availability, high-res images, API ordering (Cottover, Clique). |
| **ID Identity** | Download Mgr | CSV / XML | Product master data and media assets. |
| **Nimbus** | XML Feed | XML | Product data, ESG metrics, image assets. |
| **PF Concept** | JSON Gateway | JSON | Real-time prices, print prices, live stock levels. |
| **Snickers / Hultafors** | PartnerPortal / EDI | EDI & Bynder DAM | Master data, Bynder DAM media assets, EDI order routing. |

#### FR-2.2: Normalized Product Data Schema
All incoming feeds must normalize into a unified schema:
```json
{
  "sku": "YOU-10293-BLK-L",
  "supplier_id": "FH_YOU",
  "brand": "You",
  "mpn": "10293",
  "ean": "5701234567890",
  "name": "Classic Organic Polo",
  "category_dk": "Poloer",
  "color": {"name": "Black", "hex": "#000000"},
  "size": "L",
  "cost_price_dkk": 85.00,
  "list_price_dkk": 189.00,
  "co2_kg": 2.40,
  "stock": {"in_stock": 450, "incoming_12w": 1200, "updated_at": "2026-08-22T01:00:00Z"},
  "images": ["https://cdn.you.dk/images/10293-blk-front.jpg"]
}
```

#### FR-2.3: Supplier Catalog Diff & Approval Engine
* Before updating the live catalog, new supplier feeds must generate a **Catalog Diff Report**:
  * Added items / discontinued SKUs.
  * Price changes ($\Delta$ cost price, $\Delta$ list price).
* Platform Admins must review diffs and approve updates via the notification bell before changes take effect.
* Automatic net-price recalculation for customers with custom margin percentage rules upon catalog publishing.

---

### 4.3 Design Manual, Logo & Fitting Room Engine

#### FR-3.1: Customer Design Manual Specification
Each customer profile maintains an immutable **Design Manual**:
* Approved vector logo assets (EPS, SVG, high-res PNG).
* Color specifications (Pantone / PMS, CMYK, RAL, RGB).
* Approved logo placements (Chest Left, Chest Right, Back Top, Back Center, Sleeve Left, Sleeve Right).
* Application methods (Embroidery, Screen Print, Heat Transfer) with exact dimensions ($W \times H$ mm).

#### FR-3.2: Interactive Fitting Room & Visual Proofing
* Real-time canvas overlay rendering logos onto garment images.
* Background removal and vector outline detection.
* Image quality warning if uploaded artwork resolution is below 300 DPI.
* Multi-placement cost calculations added dynamically to item base price.

---

### 4.4 Employee Ordering, Budgets & Approval Workflows

#### FR-4.1: Dual Payment & Quota Allocation
* Employees log in and see their assigned **Clothing Account**:
  * Point balance or DKK quota allocated per period (e.g., annual 5,000 DKK allowance).
  * Allowed garment category package based on job function (e.g., Warehouse Pack vs. Sales Representative Pack).
* **Mixed Checkout:** If an order exceeds point balance or includes non-work items, the system splits checkout:
  * Company Allowance Portion $\rightarrow$ B2B Company Account / Invoice.
  * Personal Overages / Additions $\rightarrow$ Instant Payment via MobilePay / Credit Card.

#### FR-4.2: Approval Hierarchy & Workflow Engine
* **Rule Engine:** Orders exceeding employee budget thresholds, requiring custom embellishment, or ordering outside default packages trigger an approval request.
* **Hierarchy:** Employee $\rightarrow$ Department Manager $\rightarrow$ Customer Purchasing Lead.
* Email and in-app notifications with single-click approve/reject actions and audit notes.

#### FR-4.3: Punchout / OCI Enterprise Integration
* Standard cXML / OCI (Open Catalog Interface) punchout support for enterprise ERP procurement platforms (SAP Ariba, Coupa).

---

### 4.5 Warehouse Operations, Production Kanban & Logistics

#### FR-4.4: Production Kanban Board
Order statuses transition automatically across production stages:
$$\text{Draft} \longrightarrow \text{Pending Approval} \longrightarrow \text{Proofing} \longrightarrow \text{Print/Embroidery Queue} \longrightarrow \text{Packing} \longrightarrow \text{Shipped}$$

#### FR-4.5: Barcode Scanning & GLS Integration
* **Pack & Ship Interface:** Warehouse personnel scan items using physical barcode scanners.
* Direct API integration with **GLS / PostNord**:
  * Auto-generation of shipping labels and parcel numbers upon scanning the final item in an order.
  * Automatic updates to the customer track-and-trace status tracker.
* Handling of partial shipments and automated back-order queue generation.

#### FR-4.6: Returns & Exchange Portal
* Self-service customer return requests with reason selection (size swap, damaged item).
* Automated creation of prepaid return shipping labels (GLS) and inventory restocking workflows.

---

### 4.6 Financial Management & e-conomic Sync

#### FR-5.1: Real-Time Economic Engine (`ECON`)
* Centralized financial calculations ensuring consistent figures across dashboards:
  * Revenue (Omsætning), Cost of Goods Sold (Vareforbrug), Gross Margin (Dækningsbidrag / DB), Gross Margin % (Dækningsgrad / DG %).
  * Accounts Receivable (Debitorer), Accounts Payable (Kreditorer), Cash Flow projections.

#### FR-5.2: Automated & Daily Batch Invoicing (Samlefakturering)
* **Single Order Invoicing:** Immediate posting to e-conomic upon order dispatch.
* **Samlefakturering (Daily/Monthly Batch):** Combines multiple completed orders for a customer within a billing period into a single consolidated invoice sent directly to e-conomic via REST API.

#### FR-5.3: Two-Way e-conomic Reconciliation
* Nightly synchronization matching platform invoice numbers against e-conomic payment records to mark debtor balances as paid or overdue.

---

### 4.7 Sustainability & ESG Reporting Module

#### FR-6.1: Product & Order CO₂ Metrics
* Display item-level carbon footprint ($\text{kg CO}_2\text{e}$) sourced from supplier PIM data (e.g., F&H/You, Nimbus).
* Cart and checkout sum total estimated $\text{kg CO}_2\text{e}$ for the order.

#### FR-6.2: "Greener Alternative" Engine
* Interactive suggestion prompt displaying lower-$\text{CO}_2$ alternative products within the same garment category (e.g., Organic Cotton Polo saving $1.2\text{ kg CO}_2\text{e}$).

#### FR-6.3: Annual Customer ESG Report Generator
* Downloadable PDF/CSV reports for Customer Admins summarizing annual carbon emissions from corporate wear purchases for compliance with EU CSRD / corporate ESG reporting requirements.

---

## 5. Non-Functional Requirements (NFRs)

### 5.1 Performance & Availability
* **Page Load Time:** First Contentful Paint (FCP) $< 1.2\text{ seconds}$; Time to Interactive (TTI) $< 1.8\text{ seconds}$.
* **API Latency:** P95 response time $< 150\text{ ms}$ for catalog queries; $< 300\text{ ms}$ for checkout actions.
* **Uptime SLA:** $99.9\%$ monthly availability excluding scheduled maintenance windows.

### 5.2 Security & Compliance
* **Authentication:** OAuth2 / OpenID Connect with JWT tokens. Multi-factor authentication (MFA) required for Platform Admin & Financial roles.
* **Role Enforcement:** Server-side middleware validating permissions on every API endpoint.
* **Data Security:** TLS 1.3 in transit, AES-256 encryption at rest for database and secrets manager.
* **GDPR Compliance:** Automated consent logging, data minimization, right-to-be-forgotten deletion workflows for employee accounts.

### 5.3 Auditability & Logging
* Comprehensive append-only audit trail logging all:
  * Price overrides and discount adjustments.
  * Role permission updates.
  * Order approvals and cancellations.
  * Catalog feed approvals.

---

## 6. Implementation Roadmap & Release Phases

```
Phase 0: Prototype Validation ──► Phase 1: Core Foundation & Feeds ──► Phase 2: B2B Portals & Finance
                                                                                 │
Phase 4: Punchout, ESG & Scale ◄── Phase 3: Production, Logistics & KAM ◄───────┘
```

### Phase 0: Prototype Validation (COMPLETED)
- [x] Clickable HTML/JS prototype (`ProfilDesignTrading_Platform.html`).
- [x] Role simulation, dynamic mock data, local storage persistence, responsive UI design.

### Phase 1: Core Foundation & Supplier Feed Engine (Target: Months 1–2)
- [ ] Setup PostgreSQL database schema, Redis cache, Node.js/Go backend API service.
- [ ] Implement JWT authentication and RBAC authorization middleware.
- [ ] Build normalized product database and catalog management service.
- [ ] Implement automated integration adapters for **F&H/You**, **TEE JAYS**, and **Fristads/Kansas**.
- [ ] Build Catalog Diff & Approval module for Platform Admins.

### Phase 2: B2B Customer Portals, Budgets & Finance (Target: Months 3–4)
- [ ] Build Customer Admin dashboard, employee onboarding, and quota management.
- [ ] Implement multi-tier order approval engine.
- [ ] Build Employee Shop with mixed checkout (Points + MobilePay payment gateway).
- [ ] Implement two-way e-conomic integration for debtors, invoices, and payment matching.

### Phase 3: Production Kanban, Logistics & KAM Tools (Target: Months 5–6)
- [ ] Build Warehouse Pack & Ship interface with physical barcode scanner support.
- [ ] Integrate GLS / PostNord shipping API for automatic label creation and track & trace.
- [ ] Implement Production Kanban board for print/embroidery shop management.
- [ ] Build KAM Pipeline, margin guardrail checks, and customer visit tracking.
- [ ] Build Design Manual module with digital visual proofing canvas.

### Phase 4: Enterprise Punchout, ESG Reporting & Public Launch (Target: Months 7–8)
- [ ] Implement cXML / OCI Punchout gateway for SAP Ariba & Coupa.
- [ ] Launch ESG / CO₂ accounting and annual report generation engine.
- [ ] Finalize B2C Guest webshop and Request-for-Quote (RFQ) flow.
- [ ] Perform WCAG 2.1 AA accessibility audit, penetration testing, and production deployment.

---

## 7. Key Performance Indicators (KPIs) & Success Metrics

1. **Order Processing Overhead:** Reduce manual order entry time by $> 85\%$.
2. **Margin Protection:** 0 orders activated below the minimum-DG threshold without explicit admin override.
3. **Inventory & Order Accuracy:** Eliminate logo application errors via mandatory digital Design Manual proofing ($< 0.1\%$ return rate due to branding errors).
4. **Feed Synchronization:** $100\%$ of supplier stock/price updates processed and reflected within 24 hours.
5. **Customer Adoption:** $> 75\%$ of active corporate accounts using self-service employee ordering within 6 months of launch.

---

*This document serves as the official Product Requirement Document (PRD) for the Profil Design Trading Platform build.*
