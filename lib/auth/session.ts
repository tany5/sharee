import "server-only";
import { currentUser as backendUser, logoutUser } from "@/lib/backend";
import type { PublicUser } from "@/lib/types";

/** Demo cookie name (kept for backwards compat / docs). */
export const SESSION_COOKIE = "ambika_session";

/** Resolve the signed-in user from the active backend (or null). */
export async function currentUser(): Promise<PublicUser | null> {
  return backendUser();
}

/** Sign out of the active backend (Supabase Auth or the demo cookie). */
export async function endSession(): Promise<void> {
  await logoutUser();
}

/** True when the current user is an admin (for API guards). */
export async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  return user?.role === "admin";
}
