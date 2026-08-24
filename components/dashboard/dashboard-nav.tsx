"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Gauge,
  Menu,
  Package,
  PlusCircle,
  Printer,
  Settings,
  Tag,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { IconName, NavGroup } from "./nav-items";

const ICONS = {
  gauge: Gauge,
  users: Users,
  building: Building2,
  wallet: Wallet,
  check: CheckCircle2,
  package: Package,
  settings: Settings,
  tag: Tag,
  plus: PlusCircle,
  printer: Printer,
  truck: Truck,
} satisfies Record<IconName, React.ComponentType<{ className?: string }>>;

function NavList({
  groups,
  onNavigate,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-2 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              // Exact match for the index route, prefix match for the rest, so
              // /orders does not light up while you are on /orders/123.
              const active =
                pathname === item.href ||
                (item.href.split("/").length > 4 &&
                  pathname.startsWith(`${item.href}/`));

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="ml-auto h-4 w-0.5 rounded-full bg-sidebar-primary"
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ orgName }: { orgName: string }) {
  return (
    <div className="px-3">
      <p className="font-display text-sm font-bold leading-tight text-sidebar-foreground">
        Profil Design Trading
      </p>
      <p className="mt-1 truncate font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-primary">
        {orgName}
      </p>
    </div>
  );
}

/** Persistent sidebar, desktop only. */
export function DashboardSidebar({
  groups,
  orgName,
}: {
  groups: NavGroup[];
  orgName: string;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col gap-8 overflow-y-auto bg-sidebar px-4 py-6 lg:flex">
      <Brand orgName={orgName} />
      <NavList groups={groups} />
    </aside>
  );
}

/** Slide-over navigation, mobile and tablet. */
export function DashboardMobileNav({
  groups,
  orgName,
  openLabel,
}: {
  groups: NavGroup[];
  orgName: string;
  openLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={openLabel}
        className="inline-flex size-10 items-center justify-center rounded-md border border-border text-ink-700 transition-colors hover:bg-secondary lg:hidden"
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[280px] gap-8 overflow-y-auto bg-sidebar px-4 py-6 text-sidebar-foreground"
      >
        <SheetTitle className="sr-only">{openLabel}</SheetTitle>
        <Brand orgName={orgName} />
        <NavList groups={groups} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
