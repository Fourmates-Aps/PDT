import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isRole, requiredRolesFor, type AppMetadata } from "@/lib/auth/roles";
import { defaultLocale, locales } from "@/lib/i18n/locales";

/**
 * Session refresh + route guards.
 *
 * Named `proxy`, not `middleware`: Next 16 deprecated the `middleware` file
 * convention and renamed it to `proxy`. Supabase's own docs still show
 * `middleware.ts` — the cookie handling below is theirs, the file name is Next 16's.
 *
 * Two jobs, in order:
 *  1. Refresh the auth token and write the rotated cookies onto the response. This
 *     has to happen before the response is committed, or the refresh is lost and
 *     every subsequent request refreshes again.
 *  2. Keep unauthenticated and under-privileged users out of guarded routes.
 *
 * The guard here is a redirect for humans, not a security boundary. The real
 * boundary is Row-Level Security in Postgres: even if this were bypassed, a user's
 * JWT still cannot read another organisation's rows.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Without Supabase configured the site is still a working public landing page.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Verifies the token with the auth server. Do not swap this for getSession(),
  // which trusts the cookie without validating it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const locale = locales.includes(segments[0] as never)
    ? segments[0]
    : defaultLocale;
  const pathWithoutLocale =
    "/" + (locales.includes(segments[0] as never) ? segments.slice(1) : segments).join("/");

  const required = requiredRolesFor(
    pathWithoutLocale === "/" ? "/" : pathWithoutLocale.replace(/\/$/, ""),
  );

  // Public route — nothing more to check.
  if (!required) return response;

  if (!user) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = `/${locale}/login`;
    redirect.search = `?next=${encodeURIComponent(pathname)}`;
    return copyCookies(response, NextResponse.redirect(redirect));
  }

  const meta = (user.app_metadata ?? {}) as AppMetadata;
  const role = isRole(meta.role) ? meta.role : null;
  const permitted = role !== null && required.includes(role);

  if (!permitted) {
    // A signed-in user with no role yet still reaches the dashboard, which tells
    // them their account is not attached to an organisation. Redirecting them
    // away from the only page they can see would loop.
    if (pathWithoutLocale === "/dashboard") return response;

    const redirect = request.nextUrl.clone();
    redirect.pathname = `/${locale}/dashboard`;
    redirect.search = "";
    return copyCookies(response, NextResponse.redirect(redirect));
  }

  return response;
}

/** Carries refreshed auth cookies onto a redirect, so the refresh is not dropped. */
function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation. Without this the
     * proxy would run on every CSS and font request, adding an auth round trip
     * to each one.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
