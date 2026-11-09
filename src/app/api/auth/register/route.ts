import { NextResponse } from "next/server";
import { registerLocal } from "@/server/handlers";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await registerLocal(body);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
