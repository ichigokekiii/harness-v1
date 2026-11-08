import { NextResponse } from "next/server";
import type { Role } from "@/lib/domain";
import { homeFor } from "@/lib/rbac";
import { SESSION_COOKIE, sealSession } from "@/lib/session";
import { loadDb, updateDb } from "@/server/db";

function roleForEmail(email: string): Role {
  const list = process.env.AUTH_GOOGLE_ROLES ?? "";
  const match = list
    .split(",")
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().startsWith(`${email.toLowerCase()}:`));
  const role = match?.split(":")[1];
  if (role === "institution_admin" || role === "super_admin" || role === "faculty") return role;
  return "faculty";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("cookie") ?? "";
  const saved = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("harness_google_state="))
    ?.slice("harness_google_state=".length);
  if (!code || !state || !saved || decodeURIComponent(saved) !== state) {
    return NextResponse.redirect(new URL("/login?error=google", url.origin));
  }
  const id = process.env.AUTH_GOOGLE_ID;
  const secret = process.env.AUTH_GOOGLE_SECRET;
  if (!id || !secret) return NextResponse.redirect(new URL("/login?google=mock", url.origin));
  const redirectUri = new URL("/api/auth/google/callback", url.origin).toString();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) return NextResponse.redirect(new URL("/login?error=google", url.origin));
  const tokens = (await tokenResponse.json()) as { access_token?: string };
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokens.access_token ?? ""}` },
  });
  if (!profileResponse.ok) return NextResponse.redirect(new URL("/login?error=google", url.origin));
  const profile = (await profileResponse.json()) as { email?: string; name?: string };
  const email = profile.email ?? "";
  if (!email) return NextResponse.redirect(new URL("/login?error=google", url.origin));
  const role = roleForEmail(email);
  let account = loadDb().users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  if (!account) {
    updateDb((db) => {
      db.users.push({
        id: `user-${crypto.randomUUID().slice(0, 8)}`,
        username: email,
        password: "",
        name: profile.name || email,
        email,
        role,
        department: "General",
        institutionId: "inst-sample",
        status: "active",
      });
    });
    account = loadDb().users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  }
  if (!account) return NextResponse.redirect(new URL("/login?error=google", url.origin));
  const token = await sealSession({
    userId: account.id,
    role: account.role,
    name: account.name,
    username: account.username,
    provider: "google",
  });
  const response = NextResponse.redirect(new URL(homeFor(account.role), url.origin));
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  response.cookies.set("harness_google_state", "", { path: "/", maxAge: 0 });
  return response;
}
