import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isRole, type AppMetadata, type Role } from "@/lib/auth/roles";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * `server-only` makes it a build error to import this from a Client Component.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set — see .env.example",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. This is safe to swallow only
          // because proxy.ts refreshes the session on every request, so the
          // refreshed cookie is written there instead.
        }
      },
    },
  });
}

export type SessionUser = {
  id: string;
  email: string | null;
  role: Role | null;
  organisationId: string | null;
};

/**
 * The current user, or null.
 *
 * Uses `getUser()`, which revalidates the token against the Supabase Auth server.
 * Never authorise on `getSession()` — it decodes whatever is in the cookie without
 * verifying it, so a forged cookie would pass.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const meta = (user.app_metadata ?? {}) as AppMetadata;

  return {
    id: user.id,
    email: user.email ?? null,
    role: isRole(meta.role) ? meta.role : null,
    organisationId: meta.organisation_id ?? null,
  };
}
