import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { site } from "@/config/site";
import type { Executor } from "@/db";
import { getDb } from "@/db";
import { passwordResets } from "@/db/schema";

// Deliberately NOT a server action – must never be callable from the browser.

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Creates a one-time link for setting a new password. */
export async function createPasswordLink(userId: string, validHours: number, db?: Executor) {
  const token = randomBytes(32).toString("base64url");
  await (db ?? (await getDb())).insert(passwordResets).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + validHours * 60 * 60 * 1000),
  });
  return `${site.url}/obnova-hesla?token=${token}`;
}
