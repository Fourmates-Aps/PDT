import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { defaultLocale, hasLocale } from "@/lib/i18n/locales";

/**
 * Exchanges a Supabase auth code for a session.
 *
 * Used by the employee invitation flow, magic links and password recovery — all of
 * which land the user here with `?code=`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  const localeParam = searchParams.get("locale");
  const locale = hasLocale(localeParam ?? undefined) ? localeParam : defaultLocale;

  // Same open-redirect guard as the login page: only same-origin relative paths.
  const requested = searchParams.get("next") ?? "";
  const next =
    requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : `/${locale}/dashboard`;

  if (!code) {
    return NextResponse.redirect(`${origin}/${locale}/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/${locale}/login`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
