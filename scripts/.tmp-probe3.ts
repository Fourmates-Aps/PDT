import "dotenv/config";
import { sql, eq, asc } from "drizzle-orm";
import { db } from "../lib/db";
import { orgAssortment, orgPricing, organisations } from "../lib/db/schema";

const query = db
  .select({
    id: organisations.id,
    name: organisations.name,
    pricedCount: sql<number>`(
      select count(*)::int from ${orgPricing}
      where ${orgPricing.organisationId} = ${organisations.id}
    )`,
    assortmentCount: sql<number>`(
      select count(*)::int from ${orgAssortment}
      where ${orgAssortment.organisationId} = ${organisations.id}
        and ${orgAssortment.isEnabled} = true
    )`,
  })
  .from(organisations)
  .where(eq(organisations.isActive, true))
  .orderBy(asc(organisations.name));

console.log(query.toSQL());
console.log(await query);
process.exit(0);
