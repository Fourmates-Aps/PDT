import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { defaultLocale, hasLocale } from "@/lib/i18n/locales";

/**
 * Sign out.
 *
 * POST only. A GET sign-out can be triggered by any image tag or prefetch on a
 * third-party page, which logs the user out without their intent (CSRF).
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const localeValue = form?.get("locale");
  const locale = hasLocale(
    typeof localeValue === "string" ? localeValue : undefined,
  )
    ? (localeValue as string)
    : defaultLocale;

  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL(`/${locale}/login`, request.nextUrl.origin), {
    // 303 so the browser follows with GET rather than repeating the POST.
    status: 303,
  });
}
