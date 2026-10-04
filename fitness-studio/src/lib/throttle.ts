import { and, count, eq, gt, lt } from "drizzle-orm";
import type { Executor } from "@/db";
import { authAttempts } from "@/db/schema";

type Kind = "login" | "reset" | "register";

/** Limits per key: wrong passwords per 15 min, reset e-mails per hour (per e-mail), new accounts per hour (per IP). */
export const LIMITS: Record<Kind, { max: number; windowMs: number }> = {
  login: { max: 10, windowMs: 15 * 60_000 },
  reset: { max: 3, windowMs: 60 * 60_000 },
  register: { max: 5, windowMs: 60 * 60_000 },
};

export async function isThrottled(db: Executor, kind: Kind, key: string, now = new Date()) {
  const { max, windowMs } = LIMITS[kind];
  const [r] = await db
    .select({ n: count() })
    .from(authAttempts)
    .where(and(eq(authAttempts.kind, kind), eq(authAttempts.key, key), gt(authAttempts.createdAt, new Date(now.getTime() - windowMs))));
  return r.n >= max;
}

export async function recordAttempt(db: Executor, kind: Kind, key: string, now = new Date()) {
  await db.insert(authAttempts).values({ kind, key, createdAt: now });
}

/** Cron housekeeping. */
export async function pruneAttempts(db: Executor, now = new Date()) {
  await db.delete(authAttempts).where(lt(authAttempts.createdAt, new Date(now.getTime() - 86_400_000)));
}
