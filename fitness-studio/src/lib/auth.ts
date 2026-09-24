import "server-only";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export const SESSION_COOKIE = "op_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dní

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === "production")
    throw new Error("AUTH_SECRET must be set in production");
  return new TextEncoder().encode(s ?? "dev-only-secret-change-me-please-0123456789");
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function startSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Current user (fresh from the DB, so role changes apply immediately). */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub));
    return user ?? null;
  } catch {
    return null;
  }
});

export async function requireUser(next?: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/prihlaseni${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (user.role !== "admin") redirect("/ucet");
  return user;
}

/** Instructors see the schedule & attendance, admins everything. */
export async function requireStaff() {
  const user = await requireUser("/admin");
  if (user.role === "client") redirect("/ucet");
  return user;
}
