import "server-only";
import { cookies } from "next/headers";
import type { PublicUser } from "@/lib/types";
import {
  createSession,
  destroySession,
  userForSession,
} from "@/lib/demo/db";

export const SESSION_COOKIE = "ambika_session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/** Reads the session cookie and resolves the current user (or null). */
export async function currentUser(): Promise<PublicUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return userForSession(token) ?? null;
}

/** Sets the session cookie for a user (call after register/login). */
export async function startSession(userId: string): Promise<string> {
  const token = createSession(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return token;
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) destroySession(token);
  store.delete(SESSION_COOKIE);
}

/** True when the current user is an admin (for API guards). */
export async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  return user?.role === "admin";
}
