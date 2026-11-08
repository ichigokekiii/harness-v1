import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { homeFor, ruleFor } from "@/lib/rbac";
import { readSessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname === "/icon.svg") {
    return NextResponse.next();
  }
  const session = await readSessionToken(request.cookies.get("harness_session")?.value);
  if (pathname === "/") {
    return NextResponse.redirect(new URL(session ? homeFor(session.role) : "/login", request.url));
  }
  if (pathname === "/login") {
    if (session) return NextResponse.redirect(new URL(homeFor(session.role), request.url));
    return NextResponse.next();
  }
  const rule = ruleFor(pathname);
  if (!rule) return NextResponse.next();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!rule.roles.includes(session.role)) {
    return NextResponse.redirect(new URL(homeFor(session.role), request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$).*)"],
};
