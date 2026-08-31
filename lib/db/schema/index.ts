/**
 * Phase 1 schema — DEV_BRIEF_IMPLEMENTATION_PLAN.md §2 and §5.
 *
 * Rules that hold across every table here:
 *  - Tenant-scoped tables carry `organisation_id` and are filtered by RLS against
 *    the caller's JWT claim, never by application-side WHERE clauses alone.
 *  - `products` / `product_variants` are deliberately global supplier master data;
 *    tenancy is applied through org_assortment and org_pricing. See catalogue.ts.
 *  - Every table has at least one policy, which is what enables RLS in Drizzle.
 *  - `suppliers` / `supplier_orders` are PDT's own purchasing and carry NO
 *    organisation_id — they are restricted to platform staff instead. See
 *    suppliers.ts.
 */

export * from "./enums";
export * from "./organisations";
export * from "./catalogue";
export * from "./org-catalogue";
export * from "./orders";
export * from "./suppliers";
export * from "./audit";
export * from "./enquiries";
export * from "./imports";
export * from "./payments";
