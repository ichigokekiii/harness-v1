import { NextResponse } from "next/server";
import { homeFor } from "@/lib/rbac";
import { SESSION_COOKIE, sealSession } from "@/lib/session";
import { loginFastApi, loginLocal } from "@/server/handlers";
import { loadDb, updateDb } from "@/server/db";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");
  const local = await loginLocal(username, password);
  if ("account" in local && local.account) {
    const token = await sealSession({
      userId: local.account.id,
      role: local.account.role,
      name: local.account.name,
      username: local.account.username,
      provider: "credentials",
    });
    const response = NextResponse.json({
      home: homeFor(local.account.role),
      name: local.account.name,
      role: local.account.role,
    });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  }

  const live = await loginFastApi(username, password);
  if (live) {
    const db = loadDb();
    let account = db.users.find((user) => user.email === live.email);
    if (!account) {
      updateDb((next) => {
        account = {
          id: `user-${crypto.randomUUID().slice(0, 8)}`,
          username: live.email,
          password: "",
          name: live.name,
          email: live.email,
          role: live.role,
          department: "General",
          institutionId: "inst-sample",
          status: "active",
        };
        next.users.push(account!);
      });
      account = loadDb().users.find((user) => user.email === live.email);
    }
    if (!account) return NextResponse.json({ error: "Sign-in failed." }, { status: 401 });
    const token = await sealSession({
      userId: account.id,
      role: account.role,
      name: account.name,
      username: account.username,
      provider: "credentials",
      apiToken: live.token,
    });
    const response = NextResponse.json({ home: homeFor(account.role), name: account.name, role: account.role });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  }

  return NextResponse.json({ error: "error" in local ? local.error : "Sign-in failed." }, { status: "status" in local ? local.status : 401 });
}
