"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { unsubscribe } from "@/domain/campaigns";
import { IMPORTED_PASSWORD } from "@/domain/import";
import { normalizeEmail, registerUser } from "@/domain/users";
import {
  endSession,
  hashPassword,
  requireUser,
  startSession,
  verifyPassword,
} from "@/lib/auth";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { sendMail } from "@/lib/mail";
import { createPasswordLink, hashToken } from "@/lib/password-links";
import { normalizePhone } from "@/lib/phone";

/** Only allow local redirects after login. */
function safeNext(v: string) {
  return v.startsWith("/") && !v.startsWith("//") ? v : null;
}

const password = z.string().min(8, "Heslo musí mít alespoň 8 znaků.");

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  let target: string | null = null;
  const res = await attempt(async () => {
    const db = await getDb();
    const [u] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizeEmail(field.str(fd, "email"))));
    if (u?.passwordHash === IMPORTED_PASSWORD)
      throw new UserError(
        "Tvůj účet jsme převedli ze starého systému. Nastav si heslo přes „Zapomenuté heslo“.",
      );
    // same message for unknown e-mail & wrong password
    if (!u || !(await verifyPassword(field.str(fd, "password"), u.passwordHash)))
      throw new UserError("Nesprávný e-mail nebo heslo.");
    await startSession(u.id);
    target = safeNext(field.str(fd, "next")) ?? (u.role === "client" ? "/ucet" : "/admin");
  });
  if (target) redirect(target);
  return res;
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Vyplň jméno a příjmení."),
  email: z.email("Zadej platný e-mail."),
  phone: z.string().trim().max(30).optional(),
  password,
  terms: z.literal("on", { error: "Je potřeba souhlasit s obchodními podmínkami." }),
});

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  let target: string | null = null;
  const res = await attempt(async () => {
    const parsed = registerSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) throw new UserError(parsed.error.issues[0].message);
    const d = parsed.data;
    const db = await getDb();
    const user = await registerUser(db, {
      email: d.email,
      name: d.name,
      phone: normalizePhone(d.phone) ?? (d.phone || null),
      passwordHash: await hashPassword(d.password),
      marketingConsent: field.bool(fd, "marketing"),
      smsConsent: field.bool(fd, "sms"),
      whatsappConsent: field.bool(fd, "whatsapp"),
    });
    await startSession(user.id);
    await sendMail({
      to: user.email,
      subject: `Vítej v ${site.name}!`,
      text: `Ahoj ${user.name},\n\ndíky za registraci. ${site.tagline}\nNa účtu tě čeká úvodní lekce zdarma – vyber si ji v rozvrhu: ${site.url}/rozvrh`,
    });
    target = safeNext(field.str(fd, "next")) ?? "/ucet?vitej=1";
  });
  if (target) redirect(target);
  return res;
}

export async function logoutAction() {
  await endSession();
  redirect("/");
}



export async function requestResetAction(_: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const db = await getDb();
    const email = normalizeEmail(field.str(fd, "email"));
    const [u] = await db.select().from(users).where(eq(users.email, email));
    if (u) {
      const link = await createPasswordLink(u.id, 1);
      await sendMail({
        to: u.email,
        subject: "Obnovení hesla",
        text: `Ahoj ${u.name},\n\nnové heslo si nastavíš zde (odkaz platí 1 hodinu):\n${link}\n\nPokud jsi o změnu nežádal/a, e-mail ignoruj.`,
      });
    }
    // don't reveal whether the account exists
    return "Pokud účet existuje, poslali jsme ti e-mail s odkazem na nastavení hesla.";
  });
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  let done = false;
  const res = await attempt(async () => {
    const pw = password.safeParse(field.str(fd, "password"));
    if (!pw.success) throw new UserError(pw.error.issues[0].message);
    const db = await getDb();
    const [r] = await db
      .select()
      .from(passwordResets)
      .where(
        and(
          eq(passwordResets.tokenHash, hashToken(field.str(fd, "token"))),
          isNull(passwordResets.usedAt),
          gt(passwordResets.expiresAt, new Date()),
        ),
      );
    if (!r) throw new UserError("Odkaz je neplatný nebo vypršel. Požádej o nový.");
    await db.update(users).set({ passwordHash: await hashPassword(pw.data) }).where(eq(users.id, r.userId));
    await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, r.id));
    await startSession(r.userId);
    done = true;
  });
  if (done) redirect("/ucet");
  return res;
}

export async function updateProfileAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const res = await attempt(async () => {
    const name = field.str(fd, "name");
    if (name.length < 2) throw new UserError("Vyplň jméno.");
    await (await getDb())
      .update(users)
      .set({
        name,
        phone: normalizePhone(field.str(fd, "phone")) ?? field.optional(fd, "phone"),
        marketingConsent: field.bool(fd, "marketing"),
        smsConsent: field.bool(fd, "sms"),
        whatsappConsent: field.bool(fd, "whatsapp"),
      })
      .where(eq(users.id, user.id));
    return "Profil uložen.";
  });
  revalidatePath("/ucet", "layout");
  return res;
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  return attempt(async () => {
    if (!(await verifyPassword(field.str(fd, "current"), user.passwordHash)))
      throw new UserError("Současné heslo nesouhlasí.");
    const pw = password.safeParse(field.str(fd, "password"));
    if (!pw.success) throw new UserError(pw.error.issues[0].message);
    await (await getDb())
      .update(users)
      .set({ passwordHash: await hashPassword(pw.data) })
      .where(eq(users.id, user.id));
    return "Heslo změněno.";
  });
}

export async function unsubscribeAction(_: FormState, fd: FormData): Promise<FormState> {
  return attempt(async () => {
    const ok = await unsubscribe(await getDb(), field.str(fd, "token"));
    if (!ok) throw new UserError("Odkaz je neplatný.");
    return "Hotovo – už ti nebudeme posílat žádné novinky.";
  });
}
