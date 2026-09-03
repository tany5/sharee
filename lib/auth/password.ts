/**
 * Password hashing for demo accounts. Uses node's built-in scrypt with a
 * random per-user salt — safe enough for the demo database, and the production
 * path (Supabase Auth) replaces this entirely.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
  return { salt, hash };
}

export function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): boolean {
  const actual = scryptSync(password, salt, KEY_LEN);
  const expected = Buffer.from(expectedHash, "hex");
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}
