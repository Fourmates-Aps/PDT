import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Container } from "@/components/landing/section";

/**
 * The thin dark strip above the header.
 *
 * The live site runs a scrolling USP ticker here and hangs "Ansøg om b2b login"
 * off the right-hand end, on every page. The promises are kept and the animation
 * is not: a marquee cannot be read on a phone and moves under anyone using the
 * page with a screen magnifier. The list simply truncates instead — the first
 * promise is the one that matters, because it is the only one that is also a
 * disclaimer.
 */
export function UtilityBar({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.public.utility;

  return (
    <div className="bg-ink-900 text-bone-50">
      <Container className="flex h-9 items-center justify-between gap-4">
        <ul className="flex min-w-0 items-center gap-5 text-[11px] text-ink-300">
          {t.items.map((item, i) => (
            <li
              key={item}
              // Only the first promise survives a narrow viewport; the rest
              // appear as room allows.
              className={
                i === 0
                  ? "truncate"
                  : i === 1
                    ? "hidden truncate sm:block"
                    : "hidden truncate lg:block"
              }
            >
              {item}
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-4 text-[11px] font-semibold">
          {/*
            * The live site's /ansoeg-om-bruger/, rebuilt at /ansoeg.
            *
            * It captures the same fields in the same order, minus the password
            * pair: Q-A3a — whether an applicant gets an auth account before a
            * human approves them — is still open, and a credential collected
            * before that is decided has nowhere to go. The form says so.
            */}
          <Link
            href={`/${locale}/ansoeg`}
            className="text-highvis-400 transition-colors hover:text-highvis-300"
          >
            {t.apply}
          </Link>
          <Link
            href={`/${locale}/login`}
            className="text-bone-50 transition-colors hover:text-highvis-400"
          >
            {t.login}
          </Link>
        </div>
      </Container>
    </div>
  );
}
