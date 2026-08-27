import { NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_NAME, issueSession, passwordMatches } from "@/lib/session";

export const dynamic = "force-dynamic";

const body = z.object({ password: z.string().min(1) });

/**
 * In-memory throttle. This resets on every cold start, which for a one operator internal
 * tool is an acceptable trade against carrying a store just to rate limit one form.
 */
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const record = attempts.get(ip);

  if (record && record.until > now && record.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many attempts. Wait ten minutes." }, { status: 429 });
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (!passwordMatches(parsed.data.password)) {
    const next = record && record.until > now ? record : { count: 0, until: now + WINDOW_MS };
    next.count += 1;
    attempts.set(ip, next);
    // Slows a scripted guesser without being noticeable to a person who mistyped.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return NextResponse.json({ error: "That password did not work." }, { status: 401 });
  }

  attempts.delete(ip);
  const session = issueSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(session.name, session.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: session.maxAge,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
