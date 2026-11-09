import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const id = process.env.AUTH_GOOGLE_ID;
  const secret = process.env.AUTH_GOOGLE_SECRET;
  const url = new URL(request.url);
  if (!id || !secret) {
    return NextResponse.redirect(new URL("/login?error=google", url.origin));
  }
  const state = crypto.randomUUID();
  const redirectUri = new URL("/api/auth/google/callback", url.origin).toString();
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", id);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "openid email profile");
  auth.searchParams.set("state", state);
  const response = NextResponse.redirect(auth);
  response.cookies.set("harness_google_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
