import "dotenv/config";
import postgres from "postgres";
const sql = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL, { prepare: false, max: 2 });
const mode = process.argv[2];
if (mode === "on") {
  const [v] = await sql`
    update product_variants v set stock_qty = 1
    from order_lines l join orders o on o.id = l.order_id
    where v.id = l.product_variant_id and o.order_number = 'PDT-2026-00002'
    returning v.id, v.stock_qty`;
  console.log("stock reduced on", v);
} else {
  await sql`
    update product_variants v set stock_qty = 25
    from order_lines l join orders o on o.id = l.order_id
    where v.id = l.product_variant_id and o.order_number = 'PDT-2026-00002'`;
  await sql`delete from supplier_order_lines`;
  await sql`delete from supplier_orders`;
  await sql`update suppliers set minimum_order_qty = 0`;
  console.log("reverted");
}
await sql.end();
