import "dotenv/config";
import postgres from "postgres";

/**
 * Suppliers, from the documented integration facts.
 *
 *   node scripts/seed-suppliers.mjs
 *
 * Every row below is traceable to prototype/Supplier_data_capabilities.md and
 * prototype/Supplier_data_import_notes.md — how each supplier takes orders, how
 * their product and stock data arrives, and where PDT is in getting access.
 *
 * MINIMUM ORDER QUANTITIES ARE DELIBERATELY 0.
 *
 * No supplier agreement in the material states one. The prototype shows a
 * "min. 25 stk." bulk order for a supplier ("Nordtex") that does not exist in
 * the real list, so it is illustrative, not a fact. Seeding invented minimums
 * would make the accumulator on Ordre & leverandør look authoritative while
 * pooling orders against numbers nobody agreed. They are set per supplier in
 * the UI once the terms are known.
 *
 * `code` matches products.supplier_id so the catalogue links up without
 * touching product rows. Idempotent: run it as often as you like.
 */

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — see .env.example");
  process.exit(1);
}

const SUPPLIERS = [
  {
    code: "FH_YOU",
    name: "F&H Group / You",
    product_group: "Profiltøj, gaveartikler, rejseeffekter",
    order_channel: "csv",
    data_channel: "PIM-feed (CSV/Excel) med EAN, farver, størrelser, CO₂ og billeder",
    lead_time_days: 5,
    notes:
      "LIVE. Intet ordre-API — ordrer lægges som CSV Quick Upload i deres B2B-shop (nsales). Lager vises kun under 50 stk. i portalen; restordre og track & trace følges samme sted.",
  },
  {
    code: "TEEJAYS",
    name: "TEE JAYS",
    product_group: "Profiltøj",
    order_channel: "sftp",
    data_channel:
      "SFTP: masterdata + billed-links, daglig lagerliste med 4/8/12/16 ugers indkommende, fakturaer i XML/CSV",
    lead_time_days: 5,
    notes:
      "SFTP-adgang aktiv (sftp.teejays.com:22). Loginoplysninger tilhører PDT og skal ligge i en secrets manager — ikke i koden.",
  },
  {
    code: "FRISTADS",
    name: "Fristads / Kansas",
    product_group: "Arbejdstøj",
    order_channel: "edi",
    data_channel:
      "FTP (ftp.fristads.com): produkt-CSV med link til mediabank, lager som hyppigt opdateret XML",
    lead_time_days: 7,
    notes:
      "Feed-adgang modtaget. Ordrer via EDI — intet API. CO₂ deles ikke offentligt og skal behandles som 'ikke oplyst'.",
  },
  {
    code: "MASCOT",
    name: "Mascot International",
    product_group: "Arbejdstøj",
    order_channel: "edi",
    data_channel: "FTP (CSV/Excel, batch) til produkt, lager og billeder",
    lead_time_days: 7,
    notes:
      "Transaktioner via EDIFACT / XML / REST (OIOUBL/Peppol til e-faktura). Produkt og lager er batch, ikke realtid — vis lager med 'opdateret kl. …'.",
  },
  {
    code: "ENGEL",
    name: "Engel",
    product_group: "Arbejdstøj",
    order_channel: "edi",
    data_channel: "FTP hver nat: produkt, lager og billeder",
    lead_time_days: 7,
    notes: "Info modtaget. Ordrer via EDI, evt. også faktura og ordrebekræftelse.",
  },
  {
    code: "NWG",
    name: "NWG Gateway (New Wave)",
    product_group: "Profiltøj — Cottover, Clique",
    order_channel: "graphql",
    data_channel: "GraphQL: produkt, SKU/availability, billeder",
    lead_time_days: 5,
    notes:
      "Dokumentation modtaget. Kræver access token + assortmentId. Deres offentlige sites er client-rendered og kan ikke scrapes — brug API'et.",
  },
  {
    code: "ID_IDENTITY",
    name: "ID Identity",
    product_group: "Profiltøj",
    order_channel: "portal",
    data_channel: "Download Manager (produktdata + billeder)",
    lead_time_days: 7,
    notes:
      "Afventer forhandler-login samt bekræftelse af format og opdateringsfrekvens. EDI/API endnu uafklaret.",
  },
  {
    code: "NIMBUS",
    name: "Nimbus",
    product_group: "Profiltøj",
    order_channel: "api",
    data_channel: "XML-feed: produkt, ESG, billeder, SKU",
    lead_time_days: 7,
    notes: "Spec modtaget. Ordre-API afklares.",
  },
  {
    code: "PF_CONCEPT",
    name: "PF Concept",
    product_group: "Firmagaver, reklameartikler",
    order_channel: "api",
    data_channel:
      "JSON-feeds: produkt, pris og lager + billeder. Lager 2×/dag, pris ugentligt",
    lead_time_days: 10,
    notes: "Setup i gang — JSON valgt frem for XML. Ordrer via deres gateway.",
  },
  {
    code: "HULTAFORS",
    name: "Snickers / Solid Gear (Hultafors)",
    product_group: "Arbejdstøj, fodtøj",
    order_channel: "edi",
    data_channel: "PartnerPortal + Bynder (DAM) til billeder",
    lead_time_days: 10,
    notes:
      "Ordrer via EDI — intet API. Produktdata hentes gennem portal/DAM; lagertal går gennem Hultafors IT i Sverige.",
  },
];

const sql = postgres(url, { prepare: false, max: 2 });

try {
  for (const s of SUPPLIERS) {
    await sql`
      insert into suppliers ${sql(s)}
      on conflict (code) do update set
        name = excluded.name,
        product_group = excluded.product_group,
        order_channel = excluded.order_channel,
        data_channel = excluded.data_channel,
        lead_time_days = excluded.lead_time_days,
        notes = excluded.notes,
        updated_at = now()
    `;
  }

  const [{ count }] = await sql`select count(*)::int as count from suppliers`;
  const linked = await sql`
    select s.code, s.name, count(p.id)::int as products
    from suppliers s
    left join products p on p.supplier_id = s.code
    group by s.code, s.name
    order by products desc, s.name
  `;

  console.log(`${count} suppliers seeded.\n`);
  for (const row of linked) {
    console.log(
      `  ${row.code.padEnd(12)} ${row.name.padEnd(32)} ${row.products} products`,
    );
  }
  console.log(
    "\nMinimum order quantities are 0 — set them per supplier once the terms are agreed.",
  );
} finally {
  await sql.end();
}
