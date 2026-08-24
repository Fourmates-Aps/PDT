import { formatAllowance, formatDate, formatMoney } from "@/lib/format";
import type { AllowanceSummary } from "@/lib/db/queries/shop";
import type { Dictionary, Locale } from "@/lib/i18n";

/**
 * The employee's balance, shown above the range.
 *
 * Two shapes, because a customer chooses one: a points balance with a bar, or a
 * plain "the company pays, here is the cap per order" line. The prototype flips
 * between them on the same customer setting (organisations.display_mode), so the
 * two live in one component rather than drifting apart in two.
 */
export function AllowanceBar({
  summary,
  dict,
  locale,
}: {
  summary: AllowanceSummary;
  dict: Dictionary["shop"]["allowance"];
  locale: Locale;
}) {
  const amount = (value: number) =>
    formatAllowance(locale, value, summary.displayMode, dict.points);

  const cap =
    summary.approvalLimit > 0
      ? dict.cap.replace("{limit}", formatMoney(locale, summary.approvalLimit))
      : null;

  return (
    <section className="mb-8 overflow-hidden rounded-lg bg-ink-900 px-5 py-5 text-bone-50 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
        <div className="shrink-0">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-bone-50/60">
            {summary.hasQuota ? dict.title : dict.companyTitle}
          </p>
          <p className="tabular mt-1 text-2xl font-bold sm:text-3xl">
            {summary.hasQuota ? (
              <>
                {amount(summary.remaining)}{" "}
                <span className="text-sm font-medium text-bone-50/60">
                  {dict.remaining}
                </span>
              </>
            ) : (
              dict.companyLead
            )}
          </p>
        </div>

        {summary.hasQuota ? (
          <div className="min-w-0 flex-1">
            {/* Meter rather than a bare div: the value is announced, and the
                bar is decorative reinforcement of the number beside it. */}
            <div
              role="meter"
              aria-valuenow={summary.pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={dict.title}
              className="h-2 w-full overflow-hidden rounded-full bg-bone-50/15"
            >
              <div
                className={`h-full rounded-full transition-[width] ${
                  summary.pct > 85 ? "bg-highvis-400" : "bg-bone-50"
                }`}
                style={{ width: `${summary.pct}%` }}
              />
            </div>
            <p className="tabular mt-2 text-xs text-bone-50/70">
              {dict.usedOf
                .replace("{used}", amount(summary.used))
                .replace("{total}", amount(summary.allowance))}
              {summary.periodEnd
                ? ` · ${dict.renew.replace("{date}", formatDate(locale, summary.periodEnd))}`
                : ""}
            </p>
          </div>
        ) : (
          <p className="min-w-0 flex-1 text-sm text-bone-50/70">{dict.none}</p>
        )}

        {cap ? (
          <p className="shrink-0 text-xs leading-relaxed text-bone-50/70 sm:max-w-52 sm:text-right">
            {cap}
          </p>
        ) : null}
      </div>
    </section>
  );
}
