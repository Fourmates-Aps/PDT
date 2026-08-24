"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orgAssortment,
  organisations,
  orgPricing,
  productVariants,
} from "@/lib/db/schema";
import { ROLES } from "@/lib/auth/roles";
import { AuthorizationError, requireRole } from "@/lib/auth/guards";
import { markupForDg, salePrice } from "@/lib/pricing";
import { defaultLocale, hasLocale } from "@/lib/i18n/locales";

/**
 * Server Actions for Prissætning.
 *
 * ADMIN ONLY, deliberately. A KAM sells against the minimum DG set here; if a
 * KAM could also move the floor, the floor would not be one. Every action
 * re-checks the role because a Server Action is a POST endpoint anyone can hit
 * — the page that renders the form is not a gate.
 */

export type ActionState = { ok: boolean; message?: string } | null;

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError) {
    return { ok: false, message: "You are not allowed to do that." };
  }
  return {
    ok: false,
    message: error instanceof Error ? error.message : "Something went wrong.",
  };
}

function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function str(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  return raw ? raw : null;
}

/** Every price screen is under this prefix; one revalidate covers them all. */
function revalidatePricing() {
  revalidatePath("/[lang]/dashboard/admin/pricing", "page");
}

/**
 * Writes agreed prices for a customer at a markup over supplier cost.
 *
 * Cost is `net_price_dkk`, falling back to `list_price_dkk` where the supplier
 * feed carries no net price — the same fallback the read query uses, so the DG
 * the screen showed is the DG that gets written.
 *
 * Scoped by the brand/category currently filtered, so "apply 45 %" means what
 * the user is looking at rather than the whole catalogue.
 */
export async function applyMarkupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole([ROLES.ADMIN]);

    const organisationId = str(formData, "organisationId");
    const markup = num(formData, "markupPct");
    const brand = str(formData, "brand");
    const category = str(formData, "category");

    if (!organisationId) {
      return { ok: false, message: "Choose a customer first." };
    }
    if (markup === null || markup < 0 || markup > 1000) {
      return { ok: false, message: "Markup must be between 0 and 1000 %." };
    }

    const factor = 1 + markup / 100;

    const written = await db.execute<{ count: number }>(sql`
      with priced as (
        insert into org_pricing (organisation_id, product_variant_id, price_dkk)
        select
          ${organisationId}::uuid,
          v.id,
          round(coalesce(v.net_price_dkk, v.list_price_dkk) * ${factor}, 2)
        from product_variants v
        join products p on p.id = v.product_id
        where v.is_active = true
          and p.is_active = true
          and coalesce(v.net_price_dkk, v.list_price_dkk) > 0
          ${brand ? sql`and p.brand = ${brand}` : sql``}
          ${category ? sql`and p.category = ${category}` : sql``}
        on conflict (organisation_id, product_variant_id)
          do update set price_dkk = excluded.price_dkk, updated_at = now()
        returning 1
      )
      select count(*)::int as count from priced
    `);

    revalidatePricing();
    return {
      ok: true,
      message: `Priser opdateret på ${written[0]?.count ?? 0} varianter (avance ${markup} %).`,
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Raises the customer's existing agreed prices by a percentage.
 *
 * Only touches rows that already exist: a price rise is not the moment to start
 * pricing things the customer was never offered.
 */
export async function applyUpliftAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole([ROLES.ADMIN]);

    const organisationId = str(formData, "organisationId");
    const pct = num(formData, "upliftPct");
    const brand = str(formData, "brand");
    const category = str(formData, "category");

    if (!organisationId) {
      return { ok: false, message: "Choose a customer first." };
    }
    if (pct === null || pct <= -100 || pct > 200) {
      return { ok: false, message: "Enter a percentage between -100 and 200." };
    }

    const factor = 1 + pct / 100;

    const written = await db.execute<{ count: number }>(sql`
      with bumped as (
        update org_pricing op
        set price_dkk = round(op.price_dkk * ${factor}, 2), updated_at = now()
        from product_variants v
        join products p on p.id = v.product_id
        where op.product_variant_id = v.id
          and op.organisation_id = ${organisationId}::uuid
          ${brand ? sql`and p.brand = ${brand}` : sql``}
          ${category ? sql`and p.category = ${category}` : sql``}
        returning 1
      )
      select count(*)::int as count from bumped
    `);

    revalidatePricing();
    return {
      ok: true,
      message: `${written[0]?.count ?? 0} priser reguleret med ${pct} %.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/** The margin floor a KAM may not price below for this customer. */
export async function setMinimumDgAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole([ROLES.ADMIN]);

    const organisationId = str(formData, "organisationId");
    const dg = num(formData, "minimumDgPct");

    if (!organisationId) {
      return { ok: false, message: "Choose a customer first." };
    }
    if (dg === null || dg < 0 || dg >= 100) {
      return { ok: false, message: "Minimum DG must be between 0 and 99 %." };
    }

    await db
      .update(organisations)
      .set({ minimumDgPct: dg.toFixed(2), updatedAt: new Date() })
      .where(eq(organisations.id, organisationId));

    revalidatePricing();
    return { ok: true, message: `Minimum-DG sat til ${dg} %.` };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Prices one product for one customer, across every variant.
 *
 * Same price on every size: the screen works per product, and a per-size
 * override is a different job than setting a customer's price list.
 */
export async function setProductPriceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole([ROLES.ADMIN]);

    const organisationId = str(formData, "organisationId");
    const productId = str(formData, "productId");
    const price = num(formData, "priceDkk");

    if (!organisationId || !productId) {
      return { ok: false, message: "Missing customer or product." };
    }
    if (price === null || price <= 0 || price > 1_000_000) {
      return { ok: false, message: "Enter a price above 0." };
    }

    const variants = await db
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, productId),
          eq(productVariants.isActive, true),
        ),
      );

    if (variants.length === 0) {
      return { ok: false, message: "That product has no active variants." };
    }

    await db
      .insert(orgPricing)
      .values(
        variants.map((v) => ({
          organisationId,
          productVariantId: v.id,
          priceDkk: price.toFixed(2),
        })),
      )
      .onConflictDoUpdate({
        target: [orgPricing.organisationId, orgPricing.productVariantId],
        set: { priceDkk: price.toFixed(2), updatedAt: new Date() },
      });

    revalidatePricing();
    return { ok: true, message: `Pris sat på ${variants.length} varianter.` };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Suggests the markup that lands exactly on a customer's minimum DG.
 *
 * Read-only: it answers "what would I have to charge", it does not charge it.
 * Applying is a separate, deliberate click.
 */
export async function suggestMarkupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole([ROLES.ADMIN]);

    const organisationId = str(formData, "organisationId");
    if (!organisationId) {
      return { ok: false, message: "Choose a customer first." };
    }

    const [org] = await db
      .select({ minimumDgPct: organisations.minimumDgPct })
      .from(organisations)
      .where(eq(organisations.id, organisationId))
      .limit(1);

    if (!org) return { ok: false, message: "Customer not found." };

    const dg = Number(org.minimumDgPct);
    const markup = markupForDg(dg);
    if (markup === null) {
      return { ok: false, message: "That minimum DG cannot be priced." };
    }

    return {
      ok: true,
      message: `Minimum-DG på ${dg} % svarer til en avance på ${markup} %.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ *
 * Opret kundeshop — the three-step wizard.
 * ------------------------------------------------------------------ */

function localeOf(formData: FormData): string {
  const value = formData.get("locale");
  return hasLocale(typeof value === "string" ? value : undefined)
    ? (value as string)
    : defaultLocale;
}

/**
 * Step 1: create the customer with everything the shop needs to run.
 *
 * The redirect happens OUTSIDE the try/catch on purpose. `redirect()` works by
 * throwing, so a catch-all around it would swallow the navigation and report it
 * to the user as a failure.
 */
export async function createCustomerShopAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let organisationId: string;

  try {
    await requireRole([ROLES.ADMIN]);

    const name = str(formData, "name");
    const slug = str(formData, "slug")?.toLowerCase() ?? null;

    if (!name || !slug) {
      return { ok: false, message: "Navn og kort navn er påkrævet." };
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return {
        ok: false,
        message: "Kort navn må kun indeholde små bogstaver, tal og bindestreg.",
      };
    }

    const displayMode = formData.get("displayMode") === "points" ? "points" : "price";
    const minimumDg = num(formData, "minimumDgPct");
    const allowance = num(formData, "allowanceDkk");
    const approvalLimit = num(formData, "approvalLimitDkk");
    const paymentTerms = num(formData, "paymentTerms");

    if (minimumDg !== null && (minimumDg < 0 || minimumDg >= 100)) {
      return { ok: false, message: "Minimum-DG skal ligge mellem 0 og 99 %." };
    }

    const [row] = await db
      .insert(organisations)
      .values({
        name,
        slug,
        cvr: str(formData, "cvr"),
        ean: str(formData, "ean"),
        contactName: str(formData, "contactName"),
        contactEmail: str(formData, "contactEmail"),
        contactPhone: str(formData, "contactPhone"),
        addressLine1: str(formData, "addressLine1"),
        zip: str(formData, "zip"),
        city: str(formData, "city"),
        paymentTerms: paymentTerms !== null ? Math.round(paymentTerms) : 30,
        displayMode,
        defaultAllowanceDkk: (allowance ?? 1500).toFixed(2),
        orderApprovalLimitDkk: (approvalLimit ?? 1000).toFixed(2),
        minimumDgPct: (minimumDg ?? 35).toFixed(2),
      })
      .returning({ id: organisations.id });

    organisationId = row.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/duplicate key|unique/i.test(message)) {
      return { ok: false, message: "Det korte navn er allerede taget." };
    }
    return fail(error);
  }

  const locale = localeOf(formData);
  revalidatePath(`/${locale}/dashboard/admin/orgs`);
  redirect(
    `/${locale}/dashboard/admin/orgs/new?trin=2&kunde=${organisationId}`,
  );
}

/**
 * Step 2: set the customer's range to exactly what is ticked.
 *
 * The form posts BOTH the ticked products and the full set on screen, so the
 * action can switch off what was unticked. Without the scope it could only ever
 * add, and un-choosing a product would silently do nothing.
 *
 * Newly enabled products are priced at the given markup. Products already in
 * the range keep whatever price they have — re-running the step must not
 * quietly undo a negotiated price.
 */
export async function applyAssortmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole([ROLES.ADMIN]);

    const organisationId = str(formData, "organisationId");
    if (!organisationId) return { ok: false, message: "Vælg en kunde først." };

    const scope = formData.getAll("scopeProductId").map(String).filter(Boolean);
    const chosen = new Set(
      formData.getAll("productId").map(String).filter(Boolean),
    );
    if (scope.length === 0) {
      return { ok: false, message: "Ingen varer i visningen." };
    }

    const markup = num(formData, "markupPct") ?? 45;
    if (markup < 0 || markup > 1000) {
      return { ok: false, message: "Avance skal ligge mellem 0 og 1000 %." };
    }

    const enable = scope.filter((id) => chosen.has(id));
    const disable = scope.filter((id) => !chosen.has(id));

    await db.transaction(async (tx) => {
      if (enable.length) {
        await tx
          .insert(orgAssortment)
          .values(
            enable.map((productId) => ({
              organisationId,
              productId,
              isEnabled: true,
            })),
          )
          .onConflictDoUpdate({
            target: [orgAssortment.organisationId, orgAssortment.productId],
            set: { isEnabled: true },
          });

        /*
         * Price what has no agreed price yet.
         *
         * Read-then-insert rather than one INSERT..SELECT: interpolating a JS
         * array into raw SQL renders it as a tuple, not an array literal, and
         * `= any((a,b,c)::uuid[])` is a syntax error. The query builder's
         * inArray gets the binding right.
         */
        const rows = await tx
          .select({
            id: productVariants.id,
            netPriceDkk: productVariants.netPriceDkk,
            listPriceDkk: productVariants.listPriceDkk,
          })
          .from(productVariants)
          .where(
            and(
              eq(productVariants.isActive, true),
              inArray(productVariants.productId, enable),
            ),
          );

        const priced = rows
          .map((v) => ({
            organisationId,
            productVariantId: v.id,
            cost: Number(v.netPriceDkk ?? v.listPriceDkk),
          }))
          .filter((v) => Number.isFinite(v.cost) && v.cost > 0)
          .map((v) => ({
            organisationId: v.organisationId,
            productVariantId: v.productVariantId,
            priceDkk: salePrice(v.cost, markup).toFixed(2),
          }));

        if (priced.length) {
          await tx.insert(orgPricing).values(priced).onConflictDoNothing({
            target: [orgPricing.organisationId, orgPricing.productVariantId],
          });
        }
      }

      if (disable.length) {
        await tx
          .update(orgAssortment)
          .set({ isEnabled: false })
          .where(
            and(
              eq(orgAssortment.organisationId, organisationId),
              inArray(orgAssortment.productId, disable),
            ),
          );
      }
    });

    revalidatePath("/[lang]/dashboard/admin/orgs/new", "page");
    revalidatePricing();
    return {
      ok: true,
      message: `${enable.length} varer i sortimentet, ${disable.length} fravalgt.`,
    };
  } catch (error) {
    return fail(error);
  }
}
