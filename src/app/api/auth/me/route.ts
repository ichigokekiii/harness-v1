import { NextResponse } from "next/server";
import { readSessionToken, tokenFromCookieHeader } from "@/lib/session";

export async function GET(request: Request) {
  const session = await readSessionToken(tokenFromCookieHeader(request.headers.get("cookie") ?? ""));
  if (!session) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  return NextResponse.json({
    userId: session.userId,
    role: session.role,
    name: session.name,
    username: session.username,
    provider: session.provider,
  });
}
