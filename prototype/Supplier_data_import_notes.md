# Supplier data & image import — build notes

How product data and images come in from each supplier, and what's needed to wire it up. Written for the build team. The prototype currently shows ~197 products with 173 real You/F&H feed images loaded from the exported catalog; everything below is for the production integration layer.

## Principle

Build one **integration layer** that pulls each supplier's feed on a schedule, normalises it into a single product model (`Products` + `ProductVariants` with fields: SKU/item no, EAN, colour, size, list price, net/dealer price, stock, lead time, image URL(s), CO₂ where available), and stores images either by reference (hotlink to the supplier CDN) or by mirroring into our own storage/CDN. Mirroring is recommended for reliability and to avoid hotlink protection.

## Per supplier

**You / F&H Group (live today)** — CSV/Excel PIM feed with real image URLs on `you.dk/static/...`. Already used in the prototype. Spans 12 brands (You, Stormtech, Atlantis, Samsonite, Camus, Momenti, Nyxx, Premier, Flexfit, American Tourister, Westford Mill, Bag Base). 700 products / 12,402 variants in `You_katalog_fuld.json`. Includes CO₂ for many items.

**F&H Group B2B shop (no API)** — for ordering, use CSV "Quick Upload" into the nsales B2B shop (guide: fhgroup.b2b.nsales.io/da/page/quickupload-guide). Product/master data, image bank, stock (shown <50 pcs), back-order, delivery status and Track & Trace are available **via the B2B shop UI** — semi-manual; no system-to-system API/webhooks today.

**TEE JAYS (SFTP, access active)** — host `sftp.teejays.com`, port 22. Master data file includes product data **and image links**; daily stock list with incoming quantities (4/8/12/16 weeks); invoices in XML and CSV. Automatable via a scheduled SFTP pull. **Credentials go in a secrets manager — not in the repo/prototype.**

**Fristads / Kansas (FTP)** — `ftp.fristads.com`, CSV product data with **mediabank image links** (pattern `ftp://mediabankopen:openmediabank@ftp.fristads.com/Fristads/jpg10cm_high_res/<article>.jpg`), plus a frequently updated stock XML. FTP (use a client / server-side FTP pull; Chrome dropped FTP). **CO₂ is not shared publicly** — handle as "not available".

**Mascot / Engel (FTP + EDI)** — FTP file (CSV/Excel) with product data + images (Engel nightly). Orders/invoices via EDIFACT/XML/API where applicable. Batch, not realtime — surface stock as "updated at …".

**NWG / New Wave — Cottover, Clique (GraphQL API)** — products, SKU/availability and images via the NWG Gateway. Needs token + assortmentId. Public web pages are client-rendered and can't be scraped — use the API.

**ID Identity (Download Manager)** — product data + images via their Download Manager. Awaiting dealer login + format/cadence.

**Nimbus (XML feed)** — product, ESG and images via XML.

**PF Concept (JSON / Gateway)** — JSON feed (chosen over XML). Note CO₂ availability per their conditions.

**Snickers / Solid Gear — Hultafors (no API)** — master data + images via **PartnerPortal**; images also via **Bynder** DAM (hultaforsgroup.bynder.com — richer). Orders via EDI. Price lists via customer service; stock via Hultafors IT (Sweden).

## Notes

- Store all supplier credentials in a secrets manager; never in the repo, Notion, or the prototype.
- Prefer mirroring supplier images into our own CDN with a local placeholder fallback, so the catalog never renders empty if a supplier CDN is down or hotlink-protected.
- Normalise category names to Danish on import (the You feed mixes Danish/Norwegian).
- For no-API suppliers (F&H B2B, Snickers), the realistic near-term flow is: order in our system → CSV export → upload in the supplier portal → follow status in the portal. Full automation needs their API, which isn't offered today.
