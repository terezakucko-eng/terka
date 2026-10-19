import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { entitlements, users } from "@/db/schema";
import { claimPassCard } from "@/domain/pass-cards";
import { UserError } from "@/lib/errors";
import { normalizePhone } from "@/lib/phone";
import { cleanBirthDate } from "@/lib/profile";
import { getSettings } from "@/lib/settings";

const DAY = 86_400_000;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Creates a client account including the welcome free entry (more of them with a Pošli to dál card). */
export async function registerUser(
  db: DB,
  input: {
    email: string;
    name: string;
    phone?: string | null;
    passwordHash: string;
    marketingConsent?: boolean;
    smsConsent?: boolean;
    whatsappConsent?: boolean;
    healthConfirmed?: boolean;
    remindersOptIn?: boolean;
    /** code of a Pošli to dál card she came with */
    passCard?: string;
  },
  now = new Date(),
) {
  const email = normalizeEmail(input.email);
  return db.transaction(async (tx) => {
    const [exists] = await tx
      .select({ id: users.id, importedAt: users.importedAt, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email));
    // an account the studio created or brought over from the old system, the password not set yet
    if (exists?.passwordHash.startsWith("!"))
      throw new UserError(
        exists.importedAt
          ? "Tenhle e-mail už máme ze starého systému – nastav si heslo přes „Zapomenuté heslo“ a vše najdeš na účtu."
          : "Tenhle e-mail už u nás má účet – nastav si heslo přes „Zapomenuté heslo“ a vše na něm najdeš.",
      );
    if (exists) throw new UserError("Účet s tímto e-mailem už existuje.");

    const [user] = await tx
      .insert(users)
      .values({
        email,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        healthConfirmedAt: input.healthConfirmed ? now : null,
        remindersOptIn: input.remindersOptIn ?? false,
        passwordHash: input.passwordHash,
        marketingConsent: input.marketingConsent ?? false,
        smsConsent: input.smsConsent ?? false,
        whatsappConsent: input.whatsappConsent ?? false,
      })
      .returning();

    const cfg = await getSettings(tx);
    const card = input.passCard ? await claimPassCard(tx, input.passCard, user.id) : null;
    const entries = card ? Math.max(cfg.welcomeFreeEntries, cfg.passCardFreeEntries) : cfg.welcomeFreeEntries;
    if (entries > 0) {
      await tx.insert(entitlements).values({
        userId: user.id,
        kind: "free",
        name: card ? "Lekce zdarma – Pošli to dál 💛" : "Úvodní lekce zdarma",
        entriesTotal: entries,
        validFrom: now,
        validUntil: new Date(now.getTime() + cfg.welcomeFreeValidityDays * DAY),
        note: card ? `Přišla s kartičkou Pošli to dál (${card.label})` : "Uvítací dárek při registraci",
      });
    }
    return user;
  });
}

/** Password of an account the studio created – the client sets her own from the e-mailed link. */
export const INVITED_PASSWORD = "!invited";

/** The reception creates a client account (with the welcome entry, like a registration on the web). */
export async function createClientByStudio(
  db: DB,
  input: { name: string; email: string; phone?: string; birthDate?: string },
  now = new Date(),
) {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 3) throw new UserError("Vyplň jméno a příjmení.");
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError("Zkontroluj e-mail.");
  const phone = input.phone?.trim() ? normalizePhone(input.phone) : null;
  if (input.phone?.trim() && !phone) throw new UserError("Zkontroluj telefon – třeba 732 699 080 nebo +420 732 699 080.");
  const birthDate = input.birthDate?.trim() ? cleanBirthDate(input.birthDate.trim(), now) : null;
  if (input.birthDate?.trim() && !birthDate) throw new UserError("Zkontroluj datum narození.");
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (exists) throw new UserError("Účet s tímto e-mailem už existuje – najdeš ho v seznamu klientů.");
  const user = await registerUser(db, { email, name, phone, passwordHash: INVITED_PASSWORD }, now);
  if (birthDate) await db.update(users).set({ birthDate }).where(eq(users.id, user.id));
  return { ...user, birthDate };
}

/** Admin gives free entries, a pass or a membership without payment. */
export async function grantEntitlement(
  db: DB,
  input: {
    userId: string;
    kind: "free" | "pass" | "membership" | "solarium" | "massage_pass";
    name: string;
    entries: number | null;
    validityDays: number;
    /** Exact end instead of validityDays (bulk grant "platí do"). */
    validUntil?: Date;
    weeklyLimit?: number | null;
    /** Only for this class type (e.g. free entries for Reformer). */
    classTypeId?: string | null;
    /** Bookable only on the day of the class (a spot left over). */
    sameDayOnly?: boolean;
    /** Only classes starting before this hour (12 = morning). */
    beforeHour?: number | null;
    note?: string | null;
  },
  now = new Date(),
) {
  if (input.entries !== null && input.entries < 1)
    throw new UserError("Počet vstupů musí být alespoň 1.");
  if (input.validityDays < 1) throw new UserError("Platnost musí být alespoň 1 den.");
  if (input.kind === "massage_pass" && !input.entries) throw new UserError("Vyplň počet masáží.");
  const [e] = await db
    .insert(entitlements)
    .values({
      userId: input.userId,
      kind: input.kind,
      name: input.name,
      entriesTotal: input.entries,
      weeklyLimit: input.weeklyLimit ?? null,
      classTypeId: input.classTypeId || null,
      sameDayOnly: input.sameDayOnly ?? false,
      beforeHour: input.beforeHour ?? null,
      validFrom: now,
      validUntil: input.validUntil ?? new Date(now.getTime() + input.validityDays * DAY),
      note: input.note ?? null,
    })
    .returning();
  return e;
}
