import type { Session } from "@/lib/domain";

export const SESSION_COOKIE = "harness_session";

const textEncoder = new TextEncoder();

function secret() {
  return process.env.AUTH_SECRET || "harness-v1-demo-secret";
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function sealSession(session: Omit<Session, "exp"> & { exp?: number }) {
  const payload: Session = {
    ...session,
    exp: session.exp ?? Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const body = bytesToBase64Url(textEncoder.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body)}`;
}

export async function readSessionToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = await hmac(body);
  if (expected !== signature) return null;
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(body));
    const session = JSON.parse(json) as Session;
    if (!session.exp || session.exp < Date.now()) return null;
    if (!session.userId || !session.role) return null;
    return session;
  } catch {
    return null;
  }
}

export function cookieHeader(request: Request) {
  return request.headers.get("cookie") ?? "";
}

export function tokenFromCookieHeader(cookie: string) {
  const parts = cookie.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : null;
}
