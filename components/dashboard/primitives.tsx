import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function PageHeader({
  title,
  lead,
  action,
}: {
  title: string;
  lead?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
      <div className="min-w-0">
        <h1 className="text-h2 font-display font-semibold text-ink-900">
          {title}
        </h1>
        {lead ? (
          <p className="mt-2 max-w-[56ch] text-[15px] text-ink-500">{lead}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/**
 * KPI tile. Numerals use tabular figures so a row of stats does not jitter
 * as values change width.
 */
export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "default" | "warning" | "success";
}) {
  const valueTone =
    tone === "warning"
      ? "text-warning"
      : tone === "success"
        ? "text-success"
        : "text-ink-900";

  return (
    <Card className="gap-0 py-5">
      <CardContent className="px-5">
        <p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
          {label}
        </p>
        <p
          className={`tabular mt-2 text-2xl font-bold leading-none sm:text-[28px] ${valueTone}`}
        >
          {value}
        </p>
        {sub ? <p className="mt-2 text-xs text-ink-500">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

/** Row of KPIs: two-up on phones, four-up from `md`. */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  lead,
  action,
  children,
  className = "",
}: {
  title: string;
  lead?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`gap-0 py-0 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
          {lead ? <p className="mt-1 text-sm text-ink-500">{lead}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="px-5 py-5">{children}</div>
    </Card>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="py-6 text-center text-sm text-ink-500">{children}</p>
  );
}

/** Allowance usage bar — amber once the balance runs low. */
export function UsageBar({ pct }: { pct: number }) {
  const low = pct >= 55;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-bone-200"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] ${
          low ? "bg-warning" : "bg-ink-800"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
