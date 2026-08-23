> Internal build note (Rune, Rasmus, external team). Based on suppliers' integration info. Field-level specs are in the linked docs.
> 

## Overall supplier / integration overview

"TBD" = missing confirmed info from the supplier. Filled in over time.

| Supplier / system | Order | Product + stock | Format(s) | Live / batch | Status |
| --- | --- | --- | --- | --- | --- |
| **You (you.dk)** | Webshop/feed (API TBD) | Full PIM feed: SKU, EAN, CO₂, images | Excel/CSV (+ API?) | Batch | **Feed received · 700 products** |
| **Mascot** | EDIFACT/XML/API | FTP (CSV/Excel) | EDIFACT, XML, UBL, CSV/Excel | Order live · stock batch | Info received |
| **Engel** | EDI (+ optional invoice) | FTP (nightly) | EDI, CSV/Excel + images | Order EDI · stock batch | Info received |
| **NWG / New Wave** (incl. Cottover, Clique) | GraphQL (order) | GraphQL (product + SKU) | GraphQL | API (live) | Docs received |
| **ID Identity** | Dealer portal (EDI/API TBD) | Download Manager | Feed / download | Batch | Info received |
| **Kansas / Fristads** | TBD | PIM feed (clarified) | TBD | TBD | Clarified — awaiting feed |
| **e-conomic** | — | Invoices/receivables | REST API | Live | Known |
| **GLS** | Labels/scanning | — | API | Live | Known |
| **MobilePay** | Personal purchase | — | API | Live | Known |

**Back office:** Rackbeat is discontinued. Stock and orders live in the platform itself (our own code). e-conomic retained for finance.

## Mascot International

Two tracks: transactions (order/invoice/advice) via EDI/XML/API; product data + stock via FTP file (CSV/Excel, batch).

- **Order:** EDIFACT ORDERS / XML Orders / REST API. **Confirmation:** ORDRSP / OrderResponse. **Dispatch:** DESADV. **Invoice:** INVOIC / OIOUBL / Peppol.
- **Product + stock:** scheduled FTP pull of CSV/Excel → import to product/stock model. Batch (not real time — "as fresh as the last sync").
- **Auth:** REST API key/OAuth; EDIFACT via SFTP/AS2/VAN; FTP login from Mascot.
- **Docs:** catalog · API · EDIFACT ORDERS
- **Open:** order channel (API vs EDIFACT/XML), FTP details, test files.

## Engel

- **Product data, stock & images:** FTP, updated nightly (batch — fresh each morning).
- **Orders:** EDI collaboration (optional invoice + order confirmations via EDI).
- **Action:** FTP can start quickly — Engel needs a contact email from us; EDI needs our technical EDI lead's contact.
- **Status:** info received, awaiting contacts from our side.

## NWG Gateway (New Wave Group)

GraphQL API — covers New Wave brands (New Wave Profile, Cottover, Clique, Harvest, Printer, Tenson, etc.).

- **Endpoint:** `https://api.gateway.nwg.se/graphql` (+ `wss://…`). **Auth:** Bearer token (portal `portal.gateway.nwg.se` or token from NWG).
- `productSearch(assortmentId, filters:[{filter:"brand", values:[…]}])`, `productById(productNumber){ skus{ sku, availability } }`, `order(orderNumber){ tracking, lines, invoices, totals }`.
- **Open:** token + assortmentId; whether orders can be placed via Gateway; stock update cadence.

## ID Identity

ID® Identity (id.dk · Holstebro · CVR 16278874) — manufacturer selling via dealers; PDT is a dealer. Brands: Geyser, PRO Wear, Seven Seas.

- **Product/images/logos:** via Download Manager (feed/download, batch). **Orders:** via dealer portal (EDI/API TBD).
- **Open:** Download Manager access, file format/cadence, dealer API for orders/stock.

## You (you.dk)

The only supplier with a live product feed so far. Excel (customer no. 10050) — complete PIM feed.

- **Scope:** 700 products · 12,402 variants · 16 categories · 14 brands (You, Blue Rebel, Samsonite, American Tourister, Flexfit, Premier, Stormtech, Momenti, Bag Base, Westford Mill, Atlantis, Camus, Nyxx).
- **Fields:** SKU, product no./name, colour + HEX, brand, gender, size, category, EAN, UNSPSC, tariff no., country of origin, weight/dimensions, **Carbon (kg CO₂e)**, prices (standard/RRP/dealer/net + discount), Image 1 & 2 (real URLs).
- **Channel:** Excel/CSV (batch); clarify whether an API/feed exists for continuous updates.
- **Status:** feed received; structured as `You_katalog_fuld.json`; 80 items loaded into the demo shop with real images + CO₂.

## PF Concept — integration note

PF Concept (large European promotional-products supplier · customer/debtor no. 3012204). Data feeds in **XML or JSON** (JSON is the default) + a **Gateway** to receive orders from our webshop.

- **Feeds & update frequency:** product feed (daily 05:00), stock feed (2×/day, 02:00 & 13:00), price feed + print-price codes (weekly, Sat 14:00), print-data feed (daily 06:00), attribute feed (weekly). Images via image server (live) + weekly FTP.
- **Chosen format:** **JSON** — best fit for our own-coded platform.
- **Requested feeds:** Price feed, Print-price feed, Stock feed (X in all 3, per PF Concept).
- **Orders:** via PF Concept **Gateway** (separate manual requested).
- **Conditions of use (summary):** feed URLs, prices and stock are confidential and must not be disclosed to third parties; the feed URL may be shared with a webshop provider only as needed; feeds are provided "as is" with no guarantees; 2 weeks' notice on structural changes.
- **Status:** request form completed (`PF_Concept_request_form_udfyldt.pdf`) — awaiting signature + return to Kristoffer Lejland (k.lejland@pfconcept.com), after which XML/JSON links are created.

**Open points:** sign & return the form; confirm JSON; request the Gateway manual; note that the stock feed also needs country-manager approval.

## Nimbus — integration note

Nimbus (workwear / corporate wear brand). XML data feed (API) — product master with variants and SKU.

- **Structure:** 3 levels — parent product → colour variant → size/SKU.
- **Fields:** ProductNoParent/Name, ProductGroupName, Gender, RecB2BPrice_EUR (price), CountryOfOrigin, HS code, Brand, ProductColor, SizeRange, **ESG/Certificates** (Global Compact, Amfori, OEKO-TEX), material, ImageFront/ImagesAll, Barcode, SKU, ProductSize.
- **Channel:** XML feed / API. Text languages: DK, DE, EN, NO, SE.
- **Status:** XML spec received.

**Open points:** API endpoint + access, update cadence, whether orders can be placed.

## Catalog update & auto-publish (customer request)

Requested flow: when a supplier delivers a **new catalogue/feed**, Profil Design Trading is **notified**; on **acceptance**, the system **auto-publishes the newest catalogue to the website, replacing the old one**. Fits the multi-tenant / feed pipeline (Phase 4). In the prototype we can add the notification + review/approve UI; the actual automatic replacement on the live site requires the backend feed pipeline.

## White-label per customer (customer request)

PDT's own B2B customers should be able to brand their shop with their **own logo/colours**, so it looks like their own site. Fits the multi-tenant model and the existing brand library. Build as per-tenant branding in Phase 1/2.

## TEE JAYS A/S — integration note

TEE JAYS A/S (Svenstrup J, DK). Offers **SFTP access** to selected data types.

- **Stock list:** daily — current stock + incoming quantities for the next **4 / 8 / 12 / 16 weeks (or later)**. Strong availability/forecast data.
- **Master data file:** product data, image links, and **our dealer-specific prices & discounts**.
- **Invoices:** XML and CSV.
- **Access:** SFTP server path + port + login credentials (to be provided by TEE JAYS).
- **Status:** SFTP offered by TEE JAYS (Theresa Dahl Johansen, TECH Coordinator) — awaiting our go-ahead + our technical contact for credentials.

**Open points:** request the SFTP setup; provide our technical contact for the credentials; confirm we want all three data types (stock, master data, invoices).

## Snickers Workwear / Solid Gear (Hultafors Group) — integration note

Hultafors Group (Frederik Thalund, Account Manager). Brands: Snickers Workwear, Solid Gear (footwear).

- **API:** not available at present.
- **Orders:** EDI solution offered.
- **Master data & images:** via **PartnerPortal**; images also via **Bynder** DAM (hultaforsgroup.bynder.com) — the richer option.
- **Price lists:** via customer service.
- **Stock:** solutions exist — routed to the Hultafors IT department in Sweden.
- **Status:** info received.

**Open points:** decide on EDI; get PartnerPortal + Bynder access; request price list via customer service; contact Hultafors IT (SE) for the stock solution.

## Kansas / Fristads (Hultafors Group) — integration note

Fristads Kansas (Tomas Wikström, ECOM & Commercial Solutions Manager, Hultafors Group). Resolves the earlier "Kansas/Fristads — awaiting the feed" open point.

- **Product data:** FTP (ftp.fristads.com), **CSV** — all products in the chosen language(s), with links to public mediabank images (image link pattern via the Fristads mediabank).
- **Stock:** separate **XML** file on the FTP, updated frequently.
- **Orders:** EDI (per Hultafors — no API available at present).
- **CO₂e:** **not shared publicly** (Fristads cites data-theft risk) → Fristads products will have no CO₂ figure in the shop; handle as "not available".
- **Access:** FTP username/password received by email. **Store credentials in a secrets manager — not in the repo, Notion, or the prototype.** Requires an FTP client (e.g. FileZilla); Chrome dropped FTP support.
- **Status:** feed access received — ready for the build team to wire up the CSV product import + XML stock sync.

## TEE JAYS A/S — access update

- **SFTP access set up** by TEE JAYS: host `sftp.teejays.com`, port 22.
- **Credentials received by email** (username + password). **Do NOT store them here or in the repo/prototype — put them in a secrets manager.** Deliberately not recorded in Notion.
- **Status:** access active — ready for the build team to connect the SFTP (product master data, stock incl. 4/8/12/16-week incoming, invoices XML/CSV) via a secure client.

## F&H Group A/S — integration note

F&H Group (parent of You/Momenti etc.). **No API** for direct system-to-system integration at present.

- **Ordering:** CSV import ("Quick Upload") into F&H's B2B shop (nsales) — export a CSV from our own order/webshop system and upload it, avoiding manual line-by-line entry. Guide: https://fhgroup.b2b.nsales.io/da/page/quickupload-guide
- **Available via the B2B shop:** product & master data (item nos, EAN, colours, sizes), product images/image bank, stock status (shown when below 50 pcs), back-order info, delivery status, Track & Trace once shipped, and an order overview.
- **Limitation:** the fully automated flow (webshop → auto order at F&H → auto return data via API/webhooks) is **not** possible today.
- **Feasible flow now:** customer order in our system → generate CSV → Quick Upload in F&H B2B shop → order placed → follow stock/back-order/delivery/Track & Trace in the B2B shop.
- **Status:** info received — semi-automated via CSV + portal.