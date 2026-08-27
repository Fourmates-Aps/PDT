import type { Dictionary, Locale } from "@/lib/i18n";

export type NavItem = { href: string; label: string; icon: IconName };
export type NavGroup = { label: string; items: NavItem[] };

export type IconName =
  | "gauge"
  | "users"
  | "building"
  | "wallet"
  | "check"
  | "package"
  | "settings"
  | "tag"
  | "plus"
  | "printer"
  | "truck"
  | "shield";

/**
 * Mirrors the kunde-admin menu from the prototype (`NAV.kadmin`), minus the two
 * storefront links that need a shop surface we have not built yet.
 */
export function customerNav(dict: Dictionary, locale: Locale): NavGroup[] {
  const base = `/${locale}/dashboard/customer`;
  const t = dict.cadmin.nav;

  return [
    {
      label: t.groupOverview,
      items: [{ href: base, label: t.overview, icon: "gauge" }],
    },
    {
      label: t.groupAdmin,
      items: [
        { href: `${base}/employees`, label: t.employees, icon: "users" },
        { href: `${base}/departments`, label: t.departments, icon: "building" },
        { href: `${base}/clothing-account`, label: t.clothing, icon: "wallet" },
        { href: `${base}/approvals`, label: t.approvals, icon: "check" },
        { href: `${base}/orders`, label: t.orders, icon: "package" },
      ],
    },
    {
      label: t.groupSetup,
      items: [{ href: `${base}/settings`, label: t.settings, icon: "settings" }],
    },
  ];
}

/**
 * Platform-staff menu (`NAV.pdt` in the prototype).
 *
 * The prototype lists roughly forty views across eight sections. Only the ones
 * that exist are listed here — a sidebar full of dead links is worse than a
 * short one, and the remaining sections land as they are built.
 */
export function adminNav(dict: Dictionary, locale: Locale): NavGroup[] {
  const base = `/${locale}/dashboard/admin`;
  const t = dict.admin.nav;

  return [
    {
      label: t.groupOverview,
      items: [
        { href: `/${locale}/dashboard`, label: t.overview, icon: "gauge" },
      ],
    },
    {
      label: t.groupProduction,
      items: [
        { href: `${base}/production`, label: t.production, icon: "printer" },
        {
          href: `/${locale}/dashboard/warehouse`,
          label: t.packship,
          icon: "package",
        },
        {
          href: `${base}/supplier-orders`,
          label: t.supplierOrders,
          icon: "truck",
        },
        { href: `${base}/suppliers`, label: t.suppliers, icon: "building" },
      ],
    },
    {
      label: t.groupSales,
      items: [
        { href: `${base}/orgs`, label: t.customers, icon: "building" },
        { href: `${base}/orgs/new`, label: t.onboarding, icon: "plus" },
      ],
    },
    {
      label: t.groupSetup,
      items: [
        { href: `${base}/pricing`, label: t.pricing, icon: "tag" },
        { href: `${base}/staff`, label: t.staff, icon: "shield" },
      ],
    },
  ];
}

/**
 * Warehouse menu (`NAV.lager` in the prototype).
 *
 * One item today. The prototype also lists Lagerbeholdning and Vareflow, which
 * need reorder points and supplier data that do not exist yet.
 */
export function warehouseNav(dict: Dictionary, locale: Locale): NavGroup[] {
  const t = dict.warehouse.nav;

  return [
    {
      label: t.title,
      items: [
        {
          href: `/${locale}/dashboard/warehouse`,
          label: t.packship,
          icon: "package",
        },
      ],
    },
  ];
}
