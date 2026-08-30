import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";
import type {
  Connector,
  ConnectorOptions,
  Feed,
  FeedProduct,
  FeedVariant,
  SkippedRow,
} from "../types";

/**
 * Fristads Kansas (Hultafors Group).
 *
 * Per SuuplierIntegration.md: product data as CSV on ftp.fristads.com, stock as
 * a separate XML file on the same FTP, updated frequently. Orders are EDI — no
 * API — so this connector reads and never writes.
 *
 * ── CREDENTIALS ─────────────────────────────────────────────────────────────
 * Read from the environment ONLY. The integration note is explicit that the FTP
 * login must live in a secrets manager and not in the repo, Notion or the
 * prototype. Nothing here logs, stores or echoes them, and `source` on the run
 * records a path, never a URL with a password in it.
 *
 *   FRISTADS_FTP_HOST      (default ftp.fristads.com)
 *   FRISTADS_FTP_USER
 *   FRISTADS_FTP_PASSWORD
 *   FRISTADS_FTP_PRODUCTS  path to the CSV
 *   FRISTADS_FTP_STOCK     path to the stock XML
 *
 * ── COLUMN MAPPING IS PROVISIONAL ───────────────────────────────────────────
 * We do not yet hold a sample of the real file, so the header names below are
 * candidates, matched case- and separator-insensitively with several aliases
 * each. If a required column is missing the connector FAILS and prints the
 * headers it actually found, rather than importing a catalogue of nulls. Correct
 * the aliases against the first real file; nothing else needs to change.
 */

/** Candidate header names per field, in order of preference. */
const COLUMNS = {
  supplierSku: ["artikelnr", "articleno", "artno", "productno", "varenummer", "styleno"],
  name: ["produktnavn", "productname", "name", "benaemning", "description"],
  nameEn: ["productnameen", "nameen", "descriptionen"],
  brand: ["brand", "maerke", "varumaerke"],
  category: ["kategori", "category", "productgroup", "produktgruppe"],
  subcategory: ["underkategori", "subcategory", "subgroup"],
  gender: ["koen", "gender", "sex"],
  material: ["materiale", "material", "fabric", "composition"],
  colourName: ["farve", "colour", "color", "colourname"],
  colourHex: ["farvekode", "colourhex", "hex", "rgb"],
  size: ["stoerrelse", "size", "storlek"],
  ean: ["ean", "eannr", "gtin", "barcode"],
  variantSku: ["variantnr", "sku", "itemno", "variantno"],
  listPrice: ["listepris", "listprice", "rrp", "recommendedprice", "pris"],
  netPrice: ["nettopris", "netprice", "dealerprice", "forhandlerpris"],
  image: ["billede", "image", "imageurl", "mediabank", "picture"],
} as const;

type Row = Record<string, string>;

/** Headers vary in case, spacing and punctuation between exports. */
const normaliseHeader = (header: string) =>
  header.toLowerCase().replace(/[\s_\-.()/]/g, "");

function buildIndex(headers: string[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const header of headers) index.set(normaliseHeader(header), header);
  return index;
}

function pick(
  row: Row,
  index: Map<string, string>,
  candidates: readonly string[],
): string | null {
  for (const candidate of candidates) {
    const header = index.get(candidate);
    if (header === undefined) continue;
    const value = row[header]?.trim();
    if (value) return value;
  }
  return null;
}

/** Danish exports use a comma decimal separator and often a thousands dot. */
function money(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

/**
 * Fristads publishes semicolon-separated files, but exports vary. Sniffed from
 * the header line rather than assumed: a comma-split semicolon file yields one
 * enormous column and an import of nothing.
 */
function sniffDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf("\n") + 1 || undefined);
  const counts = [";", ",", "\t"].map(
    (d) => [d, firstLine.split(d).length] as const,
  );
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ";";
}

/**
 * Stock lives in its own XML file, so it is parsed separately and joined on EAN.
 *
 * Structure is not documented in the integration note beyond "XML file, updated
 * frequently", so this reads defensively: any element carrying something
 * EAN-shaped and something quantity-shaped counts.
 */
export function parseStockXml(xml: string): Map<string, number> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    parseTagValue: false,
  });
  const tree = parser.parse(xml);
  const stock = new Map<string, number>();

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    const entries = Object.entries(record);

    const find = (needles: string[]) =>
      entries.find(([key]) =>
        needles.some((n) => normaliseHeader(key).includes(n)),
      )?.[1];

    const ean = find(["ean", "gtin", "barcode"]);
    const qty = find(["qty", "quantity", "stock", "antal", "lager", "available"]);

    if (typeof ean === "string" && qty !== undefined) {
      const parsed = Number(String(qty).replace(/[^\d-]/g, ""));
      if (ean.trim() && Number.isFinite(parsed)) {
        stock.set(ean.trim(), parsed);
      }
    }

    for (const value of Object.values(record)) walk(value);
  };

  walk(tree);
  return stock;
}

/**
 * Turn the CSV (one row per VARIANT) into products (one entry per style).
 *
 * Exported so it can be tested against a fixture without an FTP server.
 */
export function parseProductCsv(
  csv: string,
  stock: Map<string, number>,
  limit?: number,
): { products: FeedProduct[]; skipped: SkippedRow[] } {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    delimiter: sniffDelimiter(csv),
    relax_column_count: true,
  }) as Row[];

  if (rows.length === 0) return { products: [], skipped: [] };

  const index = buildIndex(Object.keys(rows[0]));

  for (const required of ["supplierSku", "name"] as const) {
    const found = COLUMNS[required].some((c) => index.has(c));
    if (!found) {
      throw new Error(
        `Fristads CSV is missing a column for "${required}". Tried: ${COLUMNS[
          required
        ].join(", ")}. Headers in the file: ${Object.keys(rows[0]).join(" | ")}`,
      );
    }
  }

  const byStyle = new Map<string, FeedProduct>();
  const skipped: SkippedRow[] = [];

  for (const row of rows) {
    const supplierSku = pick(row, index, COLUMNS.supplierSku);
    const name = pick(row, index, COLUMNS.name);

    if (!supplierSku || !name) {
      skipped.push({
        row: Object.values(row).slice(0, 4).join(" | "),
        reason: !supplierSku ? "no article number" : "no product name",
      });
      continue;
    }

    let product = byStyle.get(supplierSku);
    if (!product) {
      if (limit !== undefined && byStyle.size >= limit) continue;

      product = {
        supplierSku,
        // The feed is Fristads Kansas's own; a row without a brand is theirs.
        brand: pick(row, index, COLUMNS.brand) ?? "Fristads",
        name,
        nameEn: pick(row, index, COLUMNS.nameEn),
        category: pick(row, index, COLUMNS.category) ?? "Arbejdstøj",
        subcategory: pick(row, index, COLUMNS.subcategory),
        gender: pick(row, index, COLUMNS.gender),
        material: pick(row, index, COLUMNS.material),
        primaryImage: pick(row, index, COLUMNS.image),
        /*
         * Fristads does not publish CO₂ — the integration note records that they
         * withhold it citing data-theft risk. So it is explicitly UNAVAILABLE,
         * not zero: the product page says "ikke oplyst af leverandøren" rather
         * than claiming a footprint of nothing.
         */
        co2Kg: null,
        co2Available: false,
        variants: [],
      };
      byStyle.set(supplierSku, product);
    }

    const ean = pick(row, index, COLUMNS.ean);
    const variant: FeedVariant = {
      sku: pick(row, index, COLUMNS.variantSku) ?? ean ?? supplierSku,
      ean,
      colourName: pick(row, index, COLUMNS.colourName),
      colourHex: pick(row, index, COLUMNS.colourHex),
      size: pick(row, index, COLUMNS.size),
      fit: null,
      listPriceDkk: money(pick(row, index, COLUMNS.listPrice)),
      netPriceDkk: money(pick(row, index, COLUMNS.netPrice)),
      // Absent from the stock file means zero on hand, not "unknown" — the
      // warehouse gate treats a missing figure as unavailable either way.
      stockQty: (ean ? stock.get(ean) : undefined) ?? 0,
      stockIncoming: null,
      imageUrls: [pick(row, index, COLUMNS.image)].filter(
        (u): u is string => Boolean(u),
      ),
    };

    product.variants.push(variant);
  }

  return { products: [...byStyle.values()], skipped };
}

async function downloadFromFtp(): Promise<{
  csv: string;
  xml: string;
  source: string;
}> {
  const host = process.env.FRISTADS_FTP_HOST ?? "ftp.fristads.com";
  const user = process.env.FRISTADS_FTP_USER;
  const password = process.env.FRISTADS_FTP_PASSWORD;
  const productPath = process.env.FRISTADS_FTP_PRODUCTS;
  const stockPath = process.env.FRISTADS_FTP_STOCK;

  if (!user || !password || !productPath) {
    throw new Error(
      "Fristads FTP is not configured. Set FRISTADS_FTP_USER, " +
        "FRISTADS_FTP_PASSWORD and FRISTADS_FTP_PRODUCTS (and optionally " +
        "FRISTADS_FTP_STOCK) in the environment — never in the repo. " +
        "To work without credentials, pass --file with a local export.",
    );
  }

  // Imported lazily so the module can be used for parsing — and tested — in
  // environments with no FTP client and no network.
  const { Client } = await import("basic-ftp");
  const client = new Client(30_000);

  try {
    await client.access({ host, user, password, secure: false });

    const { Writable } = await import("node:stream");
    const grab = async (path: string): Promise<string> => {
      const chunks: Buffer[] = [];
      const sink = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
      });
      await client.downloadTo(sink, path);
      return Buffer.concat(chunks).toString("utf8");
    };

    const csv = await grab(productPath);
    const xml = stockPath ? await grab(stockPath) : "";
    return { csv, xml, source: `ftp:${host}${productPath}` };
  } finally {
    client.close();
  }
}

export const fristadsConnector: Connector = {
  id: "FRISTADS",
  label: "Fristads Kansas",

  async fetch(options: ConnectorOptions): Promise<Feed> {
    let csv: string;
    let xml = "";
    let source: string;

    if (options.file) {
      csv = await readFile(options.file, "utf8");
      source = options.file;
      const stockFile = process.env.FRISTADS_STOCK_FILE;
      if (stockFile) xml = await readFile(stockFile, "utf8");
    } else {
      const downloaded = await downloadFromFtp();
      csv = downloaded.csv;
      xml = downloaded.xml;
      source = downloaded.source;
    }

    const stock = xml ? parseStockXml(xml) : new Map<string, number>();
    const { products, skipped } = parseProductCsv(csv, stock, options.limit);

    return { supplierId: "FRISTADS", source, products, skipped };
  },
};
