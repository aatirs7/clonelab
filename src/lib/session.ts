import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A hand rolled signed cookie. One operator, one shared password, so there is no user
 * table and nothing to look up. The cookie carries its own expiry and a signature over
 * it, which is all we need to keep the fal spend behind a gate.
 *
 * This deliberately runs in route handlers and server components rather than in
 * middleware: Next middleware executes on the edge runtime, where node:crypto's
 * createHmac and timingSafeEqual are not available.
 */

export const COOKIE_NAME = "clonelab_session";

// Safari caps persistent cookies near this, so asking for more just gets truncated.
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is not set");
  }
  // Fixed rather than random so a dev server restart does not sign you out.
  return "clonelab-development-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  // timingSafeEqual throws on a length mismatch, so the lengths are compared first.
  // That leaks length, which for a fixed width signature tells an attacker nothing.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function passwordMatches(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    if (process.env.NODE_ENV === "production") return false;
    throw new Error("APP_PASSWORD is not set");
  }
  return equal(candidate, expected);
}

export function issueSession(): { name: string; value: string; maxAge: number } {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `operator.${expires}`;
  return {
    name: COOKIE_NAME,
    value: `${payload}.${sign(payload)}`,
    maxAge: MAX_AGE_SECONDS,
  };
}

/** Returns true when the cookie is present, correctly signed and not expired. */
export function readSession(value: string | undefined): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [handle, expiresRaw, signature] = parts;
  const payload = `${handle}.${expiresRaw}`;
  if (!equal(signature, sign(payload))) return false;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  return true;
}
