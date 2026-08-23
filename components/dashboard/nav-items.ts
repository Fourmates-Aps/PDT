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
  | "settings";

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
