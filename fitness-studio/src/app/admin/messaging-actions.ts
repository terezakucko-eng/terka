"use server";

import { and, eq, gt, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { campaigns, passwordResets, users, type Audience } from "@/db/schema";
import { processCampaign, startCampaign, type Channel, type Recipient } from "@/domain/campaigns";
import {
  IMPORTED_PASSWORD,
  decodeCsv,
  detectMapping,
  importClients,
  interpretRows,
  parseCsv,
  type ImportResult,
  type ImportRow,
} from "@/domain/import";
import { requireAdmin } from "@/lib/auth";
import { campaignSender, newsletterFooter } from "@/lib/campaign-sender";
import { UserError, errorMessage } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { unsubscribeUrl } from "@/lib/links";
import { sendMail } from "@/lib/mail";
import { createPasswordLink } from "@/lib/password-links";
import { normalizePhone } from "@/lib/phone";

const SEGMENTS: Audience["segment"][] = ["all", "members", "passes", "inactive", "new", "class_type", "session"];

export async function saveCampaignAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  let createdId: string | null = null;
  const res = await attempt(async () => {
    const channel = field.str(fd, "channel") as Channel;
    if (!["email", "sms", "whatsapp"].includes(channel)) throw new UserError("Vyber kanál.");
    const segment = field.str(fd, "segment") as Audience["segment"];
    if (!SEGMENTS.includes(segment)) throw new UserError("Vyber cílovou skupinu.");
    const audience: Audience = {
      segment,
      days: field.int(fd, "days") ?? undefined,
      classTypeId: field.str(fd, "classTypeId") || undefined,
      sessionId: field.str(fd, "sessionId") || undefined,
    };
    const values = {
      channel,
      purpose: field.str(fd, "purpose") === "service" ? "service" : "marketing",
      name: field.str(fd, "name") || "Bez názvu",
      subject: field.optional(fd, "subject"),
      body: field.str(fd, "body"),
      waTemplate: field.optional(fd, "waTemplate"),
      waLanguage: field.optional(fd, "waLanguage") ?? "cs",
      waParams: field
        .str(fd, "waParams")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      audience,
    };
    const db = await getDb();
    const id = field.str(fd, "id");
    if (id) {
      const [c] = await db
        .update(campaigns)
        .set(values)
        .where(and(eq(campaigns.id, id), eq(campaigns.status, "draft")))
        .returning();
      if (!c) throw new UserError("Odeslanou kampaň už nelze upravit.");
    } else {
      const [c] = await db.insert(campaigns).values({ ...values, createdBy: admin.id }).returning();
      createdId = c.id;
    }
    revalidatePath("/admin/zpravy", "layout");
    return "Uloženo.";
  });
  if (createdId) redirect(`/admin/zpravy/${createdId}`);
  return res;
}

export async function deleteCampaignAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  let ok = false;
  const res = await attempt(async () => {
    const [c] = await (await getDb())
      .delete(campaigns)
      .where(and(eq(campaigns.id, field.str(fd, "id")), eq(campaigns.status, "draft")))
      .returning();
    if (!c) throw new UserError("Smazat jde jen koncept.");
    ok = true;
  });
  if (ok) redirect("/admin/zpravy");
  return res;
}

/** Sends one sample to the admin (e-mail or phone) with their own data. */
export async function sendTestAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  return attempt(async () => {
    const [c] = await (await getDb()).select().from(campaigns).where(eq(campaigns.id, field.str(fd, "id")));
    if (!c) throw new UserError("Kampaň neexistuje.");
    const to = field.str(fd, "to");
    const r: Recipient = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      creditBalance: admin.creditBalance,
      unsubscribeToken: admin.unsubscribeToken,
    };
    const unsub = unsubscribeUrl(admin.unsubscribeToken);
    const sender = campaignSender(c, await newsletterFooter());
    let result;
    if (c.channel === "email") {
      if (!/@/.test(to)) throw new UserError("Zadej e-mail pro test.");
      [result] = await sender.email([{ to, r, unsubscribeUrl: unsub }]);
    } else {
      const phone = normalizePhone(to);
      if (!phone) throw new UserError("Zadej telefon pro test.");
      result = await sender.single(phone, r, unsub);
    }
    if (!result.ok) throw new UserError(`Nepodařilo se odeslat: ${result.error}`);
    return result.ref === "log"
      ? "Poskytovatel není nastaven – zpráva jen vypsána do logu serveru."
      : "Testovací zpráva odeslána.";
  });
}

export async function startCampaignAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const res = await attempt(async () => {
    const c = await startCampaign(await getDb(), field.str(fd, "id"));
    return `Odesílání spuštěno – ${c.recipientCount} příjemců.`;
  });
  revalidatePath("/admin/zpravy", "layout");
  return res;
}

/** One step of sending; the admin page calls it repeatedly until done. */
export async function sendBatchAction(campaignId: string) {
  await requireAdmin();
  try {
    const db = await getDb();
    const [c] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
    if (!c) return { error: "Kampaň neexistuje.", remaining: 0, sent: 0, failed: 0 };
    const r = await processCampaign(db, c.id, campaignSender(c, await newsletterFooter()), unsubscribeUrl, c.channel === "email" ? 100 : 25);
    return { ...r, error: null as string | null };
  } catch (e) {
    return { error: errorMessage(e), remaining: 0, sent: 0, failed: 0 };
  }
}

/* ----------------------------------------------------------------- import */

export type ImportState =
  | {
      error?: string;
      dryRun?: boolean;
      columns?: string[];
      mapped?: Record<string, string>;
      preview?: ImportRow[];
      total?: number;
      invalid?: number;
      result?: ImportResult;
    }
  | undefined;

const FIELD_LABELS: Record<string, string> = {
  fullName: "Celé jméno",
  firstName: "Jméno",
  lastName: "Příjmení",
  email: "E-mail",
  phone: "Telefon",
  credits: "Kredit",
  entries: "Zbývající vstupy",
  validUntil: "Platnost do",
  newsletter: "Souhlas s newsletterem",
  note: "Poznámka",
};

export async function importAction(_: ImportState, fd: FormData): Promise<ImportState> {
  await requireAdmin();
  try {
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Vyber soubor CSV." };
    if (file.size > 5 * 1024 * 1024) return { error: "Soubor je větší než 5 MB." };
    const rows = parseCsv(decodeCsv(await file.arrayBuffer()));
    if (rows.length < 2) return { error: "Soubor neobsahuje žádná data." };
    const mapping = detectMapping(rows[0]);
    if (mapping.email === undefined)
      return { error: `Nenašla jsem sloupec s e-mailem. Sloupce v souboru: ${rows[0].join(", ")}` };
    const data = interpretRows(rows.slice(1), mapping);
    const mapped = Object.fromEntries(
      Object.entries(mapping).map(([k, i]) => [FIELD_LABELS[k] ?? k, rows[0][i!]]),
    );
    const base = {
      columns: rows[0],
      mapped,
      preview: data.slice(0, 8),
      total: data.length,
      invalid: data.filter((r) => !r.email).length,
    };
    if (fd.get("mode") !== "import") return { ...base, dryRun: true };
    const result = await importClients(await getDb(), data, {
      consentFromFile: field.bool(fd, "consent"),
    });
    revalidatePath("/admin/klienti");
    return { ...base, result };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** E-mails imported clients a 14-day link to set their password. */
export async function inviteImportedAction(): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const pending = await db
      .select()
      .from(users)
      .where(eq(users.passwordHash, IMPORTED_PASSWORD))
      .limit(500);
    if (!pending.length) return "Všichni převedení klienti už mají heslo nastavené.";
    // skip those invited in the last 7 days
    const recent = await db
      .select({ userId: passwordResets.userId })
      .from(passwordResets)
      .where(
        and(
          inArray(passwordResets.userId, pending.map((u) => u.id)),
          gt(passwordResets.createdAt, new Date(Date.now() - 7 * 86_400_000)),
        ),
      );
    const skip = new Set(recent.map((r) => r.userId));
    const batch = pending.filter((u) => !skip.has(u.id)).slice(0, 100);
    for (const u of batch) {
      const link = await createPasswordLink(u.id, 14 * 24, db);
      await sendMail({
        to: u.email,
        subject: `${site.name}: tvůj účet v novém rezervačním systému`,
        text: `Ahoj ${u.name.split(" ")[0]},\n\nspouštíme nový web a rezervace ${site.name}. Tvůj účet jsme převedli – včetně kreditu a permanentek.\n\nStačí si nastavit heslo (odkaz platí 14 dní):\n${link}\n\nPak se přihlásíš e-mailem ${u.email} a můžeš rezervovat.\n\nTěšíme se na tebe!`,
      });
    }
    const left = pending.length - skip.size - batch.length;
    return `Pozvánka odeslána ${batch.length} klientům.${left > 0 ? ` Zbývá ${left} – klikni znovu.` : ""}${skip.size ? ` ${skip.size} už pozvánku dostalo v posledních 7 dnech.` : ""}`;
  });
}
