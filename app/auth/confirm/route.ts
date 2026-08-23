import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { defaultLocale, hasLocale } from "@/lib/i18n/locales";

const OTP_TYPES: readonly EmailOtpType[] = [
  "invite",
  "signup",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/**
 * Server-side verification of an emailed one-time token.
 *
 * OPTIONAL — the flow works without it.
 *
 * With Supabase's DEFAULT email templates the link points at
 * `…/auth/v1/verify?token=…`, Supabase itself verifies it and 303s back with
 * the session in the URL *hash*. A hash never reaches the server, so that path
 * is handled on the client in components/auth/accept-invite-client.tsx.
 *
 * This handler covers the other option: change the Supabase email template to
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .EmailAction
 *   Type }}&next=/da/accept-invite
 *
 * and the token arrives as a query parameter instead, which the server can
 * verify directly. That keeps the session out of the browser URL entirely. Both
 * routes end at the same page, so switching the template needs no code change.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");

  const localeParam = searchParams.get("locale");
  const locale = hasLocale(localeParam ?? undefined) ? localeParam : defaultLocale;

  // Open-redirect guard: same-origin relative paths only.
  const requested = searchParams.get("next") ?? "";
  const next =
    requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : `/${locale}/dashboard`;

  const type = OTP_TYPES.find((t) => t === typeParam);

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/${locale}/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(`${origin}/${locale}/login`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
