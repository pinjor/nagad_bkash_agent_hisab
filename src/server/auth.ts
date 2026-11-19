import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db";

export type SessionUser = { id: string; shop_id: string; name: string; phone: string; role: "admin" | "employee"; shop_name: string };

export function hashPin(pin: string, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(pin, salt, 100_000, 32, "sha256").toString("hex");
  return { hash, salt };
}

export function checkPin(pin: string, hash: string, salt: string) {
  const next = pbkdf2Sync(pin, salt, 100_000, 32, "sha256");
  const prev = Buffer.from(hash, "hex");
  return prev.length === next.length && timingSafeEqual(prev, next);
}

export function readToken(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)hisab_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export async function createSession(userId: string, shopId: string) {
  const sql = await db();
  const token = randomBytes(32).toString("hex");
  await sql`insert into sessions (token, user_id, shop_id, expires_at) values (${token}, ${userId}, ${shopId}, now() + interval '30 days')`;
  return token;
}

export function sessionCookie(token: string, request: Request) {
  return `hisab_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${secureCookie(request)}`;
}

export function clearSessionCookie(request: Request) {
  return `hisab_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureCookie(request)}`;
}

function secureCookie(request: Request) {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(":")[0];
  return proto === "https" || host === "hisab.apptriangle.com" ? "; Secure" : "";
}

export async function userFromRequest(request: Request): Promise<SessionUser | null> {
  const token = readToken(request);
  if (!token) return null;
  const sql = await db();
  const rows = await sql<SessionUser[]>`
    select u.id, u.shop_id, u.name, u.phone, u.role, s.name as shop_name
    from sessions sess
    join users u on u.id = sess.user_id
    join shops s on s.id = sess.shop_id
    where sess.token = ${token} and sess.expires_at > now() and u.active
  `;
  return rows[0] ?? null;
}
