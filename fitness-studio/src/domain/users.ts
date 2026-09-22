import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { entitlements, users } from "@/db/schema";
import { UserError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";

const DAY = 86_400_000;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Creates a client account including the welcome free entry. */
export async function registerUser(
  db: DB,
  input: {
    email: string;
    name: string;
    phone?: string | null;
    passwordHash: string;
    marketingConsent?: boolean;
  },
  now = new Date(),
) {
  const email = normalizeEmail(input.email);
  return db.transaction(async (tx) => {
    const [exists] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    if (exists) throw new UserError("Účet s tímto e-mailem už existuje.");

    const [user] = await tx
      .insert(users)
      .values({
        email,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        passwordHash: input.passwordHash,
        marketingConsent: input.marketingConsent ?? false,
      })
      .returning();

    const cfg = await getSettings(tx);
    if (cfg.welcomeFreeEntries > 0) {
      await tx.insert(entitlements).values({
        userId: user.id,
        kind: "free",
        name: "Úvodní lekce zdarma",
        entriesTotal: cfg.welcomeFreeEntries,
        validFrom: now,
        validUntil: new Date(now.getTime() + cfg.welcomeFreeValidityDays * DAY),
        note: "Uvítací dárek při registraci",
      });
    }
    return user;
  });
}

/** Admin gives free entries, a pass or a membership without payment. */
export async function grantEntitlement(
  db: DB,
  input: {
    userId: string;
    kind: "free" | "pass" | "membership";
    name: string;
    entries: number | null;
    validityDays: number;
    weeklyLimit?: number | null;
    note?: string | null;
  },
  now = new Date(),
) {
  if (input.entries !== null && input.entries < 1)
    throw new UserError("Počet vstupů musí být alespoň 1.");
  if (input.validityDays < 1) throw new UserError("Platnost musí být alespoň 1 den.");
  const [e] = await db
    .insert(entitlements)
    .values({
      userId: input.userId,
      kind: input.kind,
      name: input.name,
      entriesTotal: input.entries,
      weeklyLimit: input.weeklyLimit ?? null,
      validFrom: now,
      validUntil: new Date(now.getTime() + input.validityDays * DAY),
      note: input.note ?? null,
    })
    .returning();
  return e;
}
