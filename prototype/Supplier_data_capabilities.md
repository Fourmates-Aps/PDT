# Supplier data capabilities

What each supplier can deliver in terms of data, and how. Reference for the Profil Design Trading platform integration. "Automatable" = can be pulled system-to-system on a schedule; "Portal/manual" = data exists but is retrieved through a portal/DAM without an API.

## Summary

| Supplier | Data available | Delivery method | Format | Automatable | Status |
|---|---|---|---|---|---|
| F&H Group / You | Product & master data, EAN, colours, sizes, prices, CO₂, images | Product feed (You) + B2B shop for ordering/stock | CSV/Excel + portal | Product feed: yes · Ordering: no (CSV upload) | **Live** |
| TEE JAYS | Master data + image links, stock (incl. 4/8/12/16-wk incoming), invoices | SFTP | CSV/XML | Yes | Access active |
| Fristads / Kansas | Product master + image links (mediabank), stock | FTP (product CSV + stock XML); orders via EDI | CSV/XML | Yes | Feed access received |
| Mascot | Product data + stock; orders, order confirm, despatch, invoice | FTP (product/stock) + EDIFACT/XML/REST API (transactions) | CSV/Excel, EDIFACT, XML, UBL | Yes | Info received |
| Engel | Product, stock, images; orders | FTP nightly + EDI | CSV/XML/EDI | Yes | Info received |
| NWG / New Wave (Cottover, Clique) | Products, SKU/availability, images, orders | GraphQL API (NWG Gateway) | GraphQL/JSON | Yes | Docs received — needs token + assortmentId |
| ID Identity | Product data + images | Download Manager | (to confirm) | Yes | Awaiting login + format/cadence |
| Nimbus | Product, ESG, images, SKU | XML feed / API | XML | Yes | Spec received |
| PF Concept | Price, print price, stock | JSON feed / Gateway | JSON | Yes | Form submitted (JSON chosen) |
| Snickers / Solid Gear (Hultafors) | Master data + images; orders | PartnerPortal + Bynder DAM (images); EDI (orders) | Portal/DAM + EDI | Partial (orders via EDI; data via portal) | Info received |

Back-office systems: **e-conomic** (finance — invoices/receivables via REST), **GLS/PostNord** (shipping labels + track & trace), **MobilePay/card** (payment). Stock and orders live in the platform itself (no Rackbeat going forward).

---

## Per supplier

### F&H Group / You — LIVE
- **Data:** full product & master data — item numbers, EAN, colours, sizes, list/dealer/net prices, CO₂ for many items, and product images.
- **How:** product data via the **You CSV/Excel PIM feed** (real image URLs on the you.dk CDN; 700 products / 12,402 variants already exported). For **ordering**, F&H offers no API — instead **CSV "Quick Upload"** into their B2B shop (nsales). Stock (shown below 50 pcs), back-order, delivery status, Track & Trace and order overview are available **in the B2B shop UI**.
- **Automatable:** product feed yes; ordering is semi-manual (CSV upload + portal follow-up).

### TEE JAYS — ACCESS ACTIVE
- **Data:** master data (item numbers, EAN, colours, sizes, product info) **with image links**; a daily **stock list** including incoming quantities for the next 4/8/12/16 weeks; **invoices** in XML and CSV.
- **How:** **SFTP** (`sftp.teejays.com`, port 22) with a user account. Automatable via a scheduled SFTP pull.
- **Note:** credentials belong to PDT and must live in a secrets manager — not in code/repo.

### Fristads / Kansas — FEED ACCESS RECEIVED
- **Data:** all product master data (all chosen languages), **image links** to the mediabank, and stock levels.
- **How:** **FTP** (`ftp.fristads.com`) — product data as **CSV** with image link pattern to the mediabank; stock as a frequently updated **XML** file. Orders via **EDI** (no API).
- **Note:** **CO₂ is not shared publicly** (data-theft risk) — handle as "not available".

### Mascot — INFO RECEIVED
- **Data:** product data + stock levels; plus transactional data — order, order confirmation, despatch advice, invoice.
- **How:** **FTP** file (CSV/Excel, batch) for product/stock + images; transactions via **EDIFACT / XML / REST API** (OIOUBL/Peppol for e-invoicing). Batch, not realtime — show stock as "updated at …".
- **Automatable:** yes.

### Engel — INFO RECEIVED
- **Data:** product data, stock and images; orders.
- **How:** **FTP nightly** file (product/stock/images) + **EDI** for orders.
- **Automatable:** yes.

### NWG / New Wave — Cottover, Clique — DOCS RECEIVED
- **Data:** products, SKU/availability, images, and orders.
- **How:** **GraphQL API** via the NWG Gateway. Needs an access token + assortmentId. Public sites are client-rendered and cannot be scraped — use the API.
- **Automatable:** yes.

### ID Identity — AWAITING ACCESS
- **Data:** product data + images.
- **How:** via their **Download Manager**. Awaiting dealer login + confirmation of format and update cadence.
- **Automatable:** yes, once access is set up.

### Nimbus — SPEC RECEIVED
- **Data:** product, ESG data, images, SKU.
- **How:** **XML feed** / API.
- **Automatable:** yes.

### PF Concept — FORM SUBMITTED
- **Data:** price, print price, stock.
- **How:** **JSON feed / Gateway** (JSON chosen over XML for our own-coded platform).
- **Automatable:** yes.

### Snickers / Solid Gear (Hultafors Group) — INFO RECEIVED
- **Data:** master data + product images; orders.
- **How:** master data + images via **PartnerPortal**; images also via **Bynder** DAM (richer). **Orders via EDI** (no API). **Price lists** via customer service. **Stock** routed through Hultafors IT (Sweden).
- **Automatable:** orders via EDI; product data/images are portal/DAM based.

---

## Recommendation

Build one **integration layer** that pulls each available feed (SFTP/FTP/API) on a schedule, normalises everything into a single product model (SKU/item no, EAN, colour, size, list/net price, stock, lead time, image URL(s), CO₂ where available), and mirrors supplier images into our own CDN with a local placeholder fallback. For no-API suppliers (F&H B2B, Snickers), the near-term flow is CSV export/portal + status follow-up in the portal until an API is offered. Store all supplier credentials in a secrets manager.
