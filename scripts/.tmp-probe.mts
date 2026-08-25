import "dotenv/config";
// The query module imports "server-only", which throws outside an RSC build.
// Stub it before the import graph is walked.
import { createRequire } from "node:module";
const require_ = createRequire(import.meta.url);
require_.cache[require_.resolve("server-only")] = { exports: {} } as never;

const { listShortfalls, listBaskets, listSuppliers } = await import(
  "../lib/db/queries/suppliers"
);

const suppliers = await listSuppliers();
console.log("SUPPLIERS", suppliers.length);
for (const s of suppliers.slice(0, 3)) {
  console.log(` ${s.code.padEnd(12)} ${s.orderChannel.padEnd(8)} products=${s.productCount} min=${s.minimumOrderQty} open=${s.openUnits}`);
}

const short = await listShortfalls();
console.log("\nSHORTFALLS", short.length);
for (const s of short) {
  console.log(` ${s.orderNumber} ${s.customer} · ${s.productName} ${s.size ?? ""} · ordered=${s.ordered} stock=${s.stockQty} short=${s.shortfall} supplier=${s.supplierCode}`);
}

const baskets = await listBaskets();
const open = baskets.filter((b) => b.units > 0);
console.log("\nOPEN BASKETS", open.length);
for (const b of open) {
  console.log(` ${b.supplierName}: ${b.units} units, min ${b.minimumOrderQty}, meets=${b.meetsMinimum}, value=${b.valueDkk}`);
  for (const l of b.lines) console.log(`   - ${l.quantity}× ${l.productName} ${l.size ?? ""} (${l.customer ?? "stock"} ${l.orderNumber ?? ""})`);
}
process.exit(0);
