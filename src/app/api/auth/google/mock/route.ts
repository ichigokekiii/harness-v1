import { NextResponse } from "next/server";
import { homeFor } from "@/lib/rbac";
import { SESSION_COOKIE, sealSession } from "@/lib/session";
import { loadDb, updateDb } from "@/server/db";

const allowed = new Set([
  "teacher@sampleacademy.test",
  "registrar@sampleacademy.test",
  "operator@sampleacademy.test",
]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = String(body.email ?? "").toLowerCase();
  if (!allowed.has(email)) return NextResponse.json({ error: "Choose a sample account." }, { status: 400 });
  const account = loadDb().users.find((user) => user.email === email);
  if (!account) return NextResponse.json({ error: "Choose a sample account." }, { status: 400 });
  updateDb((db) => {
    db.audit.unshift({
      id: `audit-${crypto.randomUUID().slice(0, 8)}`,
      at: new Date().toISOString(),
      actor: account.name,
      action: "login",
      detail: "Signed in with the local account chooser.",
      institutionId: account.institutionId,
    });
  });
  const token = await sealSession({
    userId: account.id,
    role: account.role,
    name: account.name,
    username: account.username,
    provider: "google-mock",
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
