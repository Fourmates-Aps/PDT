# Profil Design Trading — platform-prototype · overdragelse

Opsummering af hele forløbet, så en udvikler-makker kan tage over. Prototypen er én selvstændig HTML-fil (frontend + demodata, ingen backend endnu).

**Repo:** https://github.com/Oland88/profil-design-trading (privat)
**Hovedfil:** `ProfilDesignTrading_Platform.html` (den er altid den nyeste — se "Kendte forhold" nederst).
**Brand-reference:** [profildesigntrading.dk](https://profildesigntrading.dk) (grøn brandfarve; vi rullede tilbage fra et sort/hvidt forsøg).

---

## 1. Hvad er det?

En klikbar prototype til en samlet B2B-platform for Profil Design Trading (arbejdstøj, profiltøj, gaver — 4 afdelinger: Vejle, Billund, Fredericia, Skjern). Formålet er at demonstrere flowet og aligne krav før udvikling. Åbn HTML-filen i en browser — ingen build, ingen server, ingen `npm install`. Kræver internet (produkt-/modelfotos hentes eksternt, bl.a. fra Fristads Kansas' CDN).

---

## 2. Roller (vælges på login)

| Rolle | Ser / kan |
|-------|-----------|
| **Medarbejder** (Jens, Vognmand Hansen) | Egen webshop: arbejdstøj på firmakonto/point + personlige varer via MobilePay. Logo-visning på model, kurv/checkout, min konto, ordrer m. status-tracker, kvittering. |
| **Kunde-admin** (Vognmand Hansen A/S) | Dashboard, opret/administrer medarbejdere (m. rolle-pakke-forslag), afdelinger (redigerbart sortiment), tøjkonto/point, godkendelser, ordrer m. tracker, indstillinger. |
| **Key Account Manager (Frederik)** | Begrænset: Mit overblik, Min pipeline (+ "Ny mulighed"), Opret kundeshop, Design manual. Kan ikke aktivere en shop under admins minimum-DG. |
| **Lager** | **Pak & send** (nye ordrer → pakning → tryk/broderi → GLS-scan → sendt), Lagerbeholdning, Vareflow. |
| **Profil Design (Admin)** | Alt: dashboard, CRM, salgs-pipeline, produktionsflow, ordre & leverandør, økonomi (debitorer, kreditorer, balance, cash flow, budget, rapporter, fakturaer, **samlefakturering**), drift (lager, leverandører, **kataloger**, design manual, pak & send), **prissætning**, **roller & moduler**, integrationer, team, audit, branding. |

---

## 3. Kernefunktioner / flows

- **Opret kundeshop (3-trins flow):** stamdata (virksomhed, CVR, EAN, kontakt, e-mail, adresse, betalingsbetingelse, prisaftale, antal ansatte) → vælg sortiment fra indbygget katalog → aktivér. Ved aktivering oprettes kunden automatisk som debitor i e-conomic (demo), lægges i **pipeline** (status "I pipeline") indtil "Registrér 1. ordre", og der beregnes **forventet DB/DG** ud fra antal ansatte × valgte varer, holdt op mod admins **minimum-DG**.
- **Prissætning (egen side):** avance-påslag, prisstigninger pr. mærke/alle, redigerbar kostpris pr. vare (inline), kunderabat pr. kunde (samme vare kan have forskellig pris pr. kunde), minimum-DG, og "Foreslå avance til min-DG".
- **Kataloger:** ét katalog pr. leverandør (Kansas/Fristads m. live data + rigtige billeder, Mascot, Snickers, ID Identity, Cottover, Clique). Åbn et katalog og markér varer til sortiment.
- **Ordre → faktura → CRM (auto-kæde):** firmakøb i checkout danner automatisk en bogført faktura i e-conomic, opdaterer debitorer/balance/omsætning og lægger omsætning på kunden i CRM. Alt trækker på én beregnet økonomimodel (`ECON`), så tallene hænger sammen på tværs af sider.
- **Samlefakturering (dagsafslutning):** færdige tryk samlet pr. kunde → én samlefaktura pr. kunde til e-conomic (samme kæde).
- **Lager: pak & send + GLS:** tager højde for om varen er på lager / modtaget / afventer levering; workflow-knapper pr. fase; GLS-kode scannes (håndscanner taster i felt + Enter) for at bekræfte klar & sendt.
- **Produktionsflow er koblet på pak-flowet:** når lageret starter pakning / sender, flytter ordren automatisk i produktions-kanbanet (Pakning → … → Leveret).
- **Kunder kan følge deres ordre:** trin-tracker (Modtaget → Tryk/broderi → Pakning → Klar → Sendt m. GLS-nr.) på kundekortet (CRM) og på kunde-admins Ordrer-side.
- **Roller & moduler:** admin styrer i en matrix hvilke moduler hver rolle/afdeling har adgang til (fx Lager kun Drift, Bogholderi kun Økonomi).
- **Design manual:** logo-spec pr. kunde (placering, metode, mm, PMS-farver) + **billed-upload** (mockup/foto) så lageret ser placeringerne + printbar manual.
- **Global søgning (⌘K / Ctrl+K):** finder sider, kunder, varer og medarbejdere fra alle faner.
- **UX:** sammenklappelig sidebar (accordion-sektioner der huskes), flydende mini-kurv, funktionel kategori-navigation i storefront, dark mode, mobilvisning.

---

## 4. Arkitektur (til udvikleren)

Alt ligger i én HTML-fil: markup + `<style>` + `<script>`. Ingen afhængigheder.

- **`DATA`** — kildedata (produkter, medarbejdere, kunder, lager, fakturaer, godkendelser). Muteres i runtime.
- **`STORE`** — wrapper om `localStorage` (nøgler med `pdt_`-præfiks): `get/set/clear`.
- **`ECON` / `buildEcon()` / `recomputeEcon()`** — beregnet økonomimodel udledt af `DATA.fakturaer` m.m.; genberegnes efter ændringer så alle økonomisider hænger sammen.
- **`CRM`** — kundekartotek; nye shops flettes ind.
- **`NAV`** — menustruktur pr. rolle (`medarb`, `kadmin`, `pdt`, `kam`, `lager`); `buildNav()` renderer accordion.
- **`VIEWS`** — objekt med ~50 view-funktioner, der hver returnerer en HTML-streng.
- **`go(id)`** — router: hash, skeleton, `VIEWS[id]()`, fejlhåndtering pr. side.
- **Grafik-hjælpere:** `eKpi`, `eArea`, `eDonut`, `eStack` (bruges konsistent på økonomi + rapporter).
- **Kanban:** HTML5 drag-and-drop (`window.PRODCOLS` / `window.PIPESTAGES`, `pipeDefault()` / `prodDefault()`).
- **Ikoner:** inline SVG via `SVGICON` + `ic()` + `EMOJI2NAME`.

**Vigtige globale states/nøgler (localStorage):** `mode, orders, cart, fav, lastsize, dark, prodcols, pipestages, catmarkup, catprices, catsel, catcust, custdisc, mindg, afdsel, createdshops, extrafak, reorders, roleaccess, navopen, sbcollapsed, logoimg`.

**Sådan tilføjer man en side:** ny funktion i `VIEWS`, menupunkt i `NAV`, titel i `titles`-mappet i `go()`, evt. emoji-ikon i `EMOJI2NAME`. Konvention: hver `VIEWS`-metode ender med `},` — undgå at brække de lange template-strenge.

---

## 5. Integrationer (til produktion — ikke live)

- **e-conomic** (REST) — kunder, priser, fakturaer; bør vedligeholdes ét sted (e-conomic som master).
- **Fristads Kansas** — leverandørkatalog (rigtige varenr./billeder); i produktion via feed/punchout (OCI/cXML) + partneraftale.
- **Rackbeat** — lager/ordre-API (afklar rolle vs. egen lagerarkitektur).
- **GLS** — pakkelabels/scanning ved afsendning.
- **MobilePay** — privatkøb; firmakøb på konto/faktura.
- Leverandører uden API: EDI → CSV/XML → mailordre → RPA.

---

## 6. Kendte forhold & næste skridt

- **Prototype:** ingen backend/database/login-sikkerhed; data nulstilles ved genindlæsning (undtagen localStorage). Billeder hentes eksternt (m. fallback). Logo lægges på med CSS på stockfotos — produktion kræver rigtig mockup-motor.
- **GitHub / to filer:** `ProfilDesignTrading_Platform.html` er den fulde, aktuelle version. Der ligger også en `index.html` (til evt. GitHub Pages), som pt. er én version bagud — arbejd i / åbn hovedfilen.
- **Foreslåede næste skridt:** funktionel auto-genbestilling helt ud i indkøb, "Anbefalet til jer"/krysssalg i shoppen, mobil bund-navigation, notifikationer med rigtige hændelser, WCAG-gennemgang, og på sigt en rigtig API-first/multi-tenant backend (se README i repoet for faseplan).

---

*Prototype udviklet iterativt sammen med Rune. Filen er selvstændig og kan redigeres direkte — ingen opsætning nødvendig.*
