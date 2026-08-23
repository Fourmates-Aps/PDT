"use server";

import { createClient } from "@/lib/supabase/server";
import { activateOwnMembership } from "@/lib/auth/invites";

export type AcceptState = {
  ok: boolean;
  code?: "tooShort" | "mismatch" | "expired" | "generic";
  message?: string;
} | null;

/**
 * Sets the invited user's password and activates their membership.
 *
 * The password is changed through the CALLER'S OWN session — established by the
 * invite link's code exchange in /auth/callback — not with the service key. That
 * way this action can only ever change the password of whoever is signed in, and
 * a stray call cannot reset somebody else's.
 */
export async function acceptInviteAction(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { ok: false, code: "tooShort" };
  if (password !== confirm) return { ok: false, code: "mismatch" };

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return { ok: false, code: "expired" };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, code: "generic", message: error.message };

  // Flip organisation_members.is_active so the admin's list stops showing them
  // as outstanding. Uses the service key because employees have no write access
  // to that table, and is scoped to this user's own id.
  await activateOwnMembership(user.id);

  return { ok: true };
}
