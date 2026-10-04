"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { isThrottled, recordAttempt } from "@/lib/throttle";
import { looksLikeBot } from "@/lib/bot-guard";
import { turnstileOk } from "@/lib/turnstile";
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
import { sendEmail } from "@/lib/email-templates";
import { createPasswordLink, hashToken } from "@/lib/password-links";
import { deleteImage, storeImage, uploadedFile } from "@/lib/media";
import { normalizePhone } from "@/lib/phone";
import { AVATAR_EMOJI, OCTO_AVATARS, cleanBirthDate, cleanNameDay } from "@/lib/profile";
import { greetName } from "@/lib/vocative";
import { deleteOwnAccount } from "@/domain/account-deletion";
import { notifyPromoted } from "@/lib/notify";
import { getContent } from "@/content";
import { sendMail } from "@/lib/mail";

/** Only allow local redirects after login. */
function safeNext(v: string) {
  return v.startsWith("/") && !v.startsWith("//") ? v : null;
}

const password = z.string().min(8, "Heslo musí mít alespoň 8 znaků.");

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  let target: string | null = null;
  const res = await attempt(async () => {
    const db = await getDb();
    const email = normalizeEmail(field.str(fd, "email"));
    if (await isThrottled(db, "login", email))
      throw new UserError("Příliš mnoho neúspěšných pokusů. Zkus to prosím za 15 minut, nebo si nastav nové heslo.");
    const [u] = await db.select().from(users).where(eq(users.email, email));
    if (u?.passwordHash === IMPORTED_PASSWORD)
      throw new UserError(
        "Tvůj účet jsme převedli ze starého systému. Nastav si heslo přes „Zapomenuté heslo“.",
      );
    // same message for unknown e-mail & wrong password
    if (!u || !(await verifyPassword(field.str(fd, "password"), u.passwordHash))) {
      await recordAttempt(db, "login", email);
      throw new UserError("Nesprávný e-mail nebo heslo.");
    }
    await startSession(u.id);
    target = safeNext(field.str(fd, "next")) ?? (u.role === "client" ? "/ucet" : "/admin");
  });
  if (target) redirect(target);
  return res;
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Vyplň jméno a příjmení.").regex(/\S\s+\S/, "Vyplň jméno i příjmení."),
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
    if (!field.bool(fd, "health")) throw new UserError("Potvrď prosím, že ti zdravotní stav cvičení dovoluje.");
    if (looksLikeBot(fd)) throw new UserError("Registraci se nepodařilo odeslat. Načti prosím stránku znovu a zkus to ještě jednou.");
    const db = await getDb();
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await turnstileOk(field.str(fd, "cf-turnstile-response"), ip)))
      throw new UserError("Ověření, že nejsi robot, se nepovedlo. Počkej prosím chvilku a zkus to znovu.");
    if (await isThrottled(db, "register", ip))
      throw new UserError("Z tohoto připojení vzniklo v poslední hodině moc účtů. Zkus to prosím později.");
    await recordAttempt(db, "register", ip);
    const user = await registerUser(db, {
      healthConfirmed: true,
      remindersOptIn: field.bool(fd, "reminders"),
      email: d.email,
      name: d.name,
      phone: normalizePhone(d.phone) ?? (d.phone || null),
      passwordHash: await hashPassword(d.password),
      marketingConsent: field.bool(fd, "marketing"),
      smsConsent: field.bool(fd, "sms"),
      whatsappConsent: field.bool(fd, "whatsapp"),
    });
    await startSession(user.id);
    await sendEmail(user.email, "welcome", { osloveni: greetName(user.name), odkaz: `${site.url}/rozvrh`, karta: `${site.url}/ucet/karta` });
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
    // at most a few e-mails per hour, so nobody can flood someone's inbox
    if (u && !(await isThrottled(db, "reset", email))) {
      await recordAttempt(db, "reset", email);
      const link = await createPasswordLink(u.id, 1);
      await sendEmail(u.email, "passwordReset", { osloveni: greetName(u.name), odkaz: link });
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
        nickname: field.str(fd, "nickname").slice(0, 30) || null,
        birthDate: cleanBirthDate(field.str(fd, "birthDate")),
        nameDay: cleanNameDay(field.int(fd, "nameDayDay"), field.int(fd, "nameDayMonth")),
        remindersOptIn: field.bool(fd, "reminders"),
        bookingEmails: field.bool(fd, "bookingEmails"),
      })
      .where(eq(users.id, user.id));
    return "Profil uložen.";
  });
  revalidatePath("/ucet", "layout");
  return res;
}

/** Profile picture: an uploaded photo, a picked avatar, or back to initials. */
export async function updateAvatarAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const res = await attempt(async () => {
    const db = await getDb();
    const file = uploadedFile(fd, "photo");
    const pick = field.str(fd, "avatar");
    let avatar: string | null;
    if (file) avatar = await storeImage(db, file, 480, true);
    else if (pick === "none") avatar = null;
    else if (OCTO_AVATARS.includes(pick)) avatar = pick;
    else if ((AVATAR_EMOJI as readonly string[]).includes(pick)) avatar = `emoji:${pick}`;
    else if (pick === "keep") return "Nic se nezměnilo.";
    else throw new UserError("Vyber avatar nebo nahraj fotku.");
    await db.update(users).set({ avatar }).where(eq(users.id, user.id));
    if (user.avatar !== avatar) await deleteImage(db, user.avatar);
    return "Profilovka uložena.";
  });
  revalidatePath("/", "layout");
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

/** Profile → "Smazat účet": the client's own, confirmed with the password. */
export async function deleteAccountAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/ucet/profil");
  let done = false;
  const res = await attempt(async () => {
    if (!field.bool(fd, "confirm")) throw new UserError("Zaškrtni prosím, že účet opravdu chceš smazat.");
    if (!(await verifyPassword(field.str(fd, "password"), user.passwordHash))) throw new UserError("Heslo nesouhlasí.");
    const db = await getDb();
    const r = await deleteOwnAccount(db, user.id);
    await notifyPromoted(db, r.promoted);
    const c = await getContent();
    await sendMail({
      to: user.email,
      subject: "Tvůj účet v OCTOPUSH je smazaný",
      text: `Ahoj,\n\ntvůj účet na ${site.url} jsme podle tvého přání smazali${r.anonymised ? " – osobní údaje jsou odstraněné, záznamy o platbách musíme ze zákona uchovat" : ""}.\n\nKdyby ses chtěl/a vrátit, stačí se znovu zaregistrovat. Ať se ti daří!\n\n${site.name}`,
    }).catch((e) => console.error("[account] mail failed", e));
    await sendMail({
      to: c.raw("site.email") || site.email,
      subject: `Klient si smazal účet: ${user.name}`,
      text: `${user.name} (${user.email}) si smazal/a účet${r.anonymised ? " – kvůli platbám je anonymizovaný, v přehledu plateb zůstává jako „Smazaný účet“" : " úplně"}.`,
    }).catch((e) => console.error("[account] notify failed", e));
    done = true;
  });
  if (!done) return res;
  await endSession();
  revalidatePath("/", "layout");
  redirect("/ucet-smazan");
}
