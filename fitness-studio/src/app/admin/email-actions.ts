"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { content } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { EMAILS, emailKey, renderEmail, sampleVars, type EmailId } from "@/lib/email-templates";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { sendMail } from "@/lib/mail";

const templateId = (fd: FormData) => {
  const id = field.str(fd, "id");
  if (!(id in EMAILS)) throw new UserError("Neznámý e-mail.");
  return id as EmailId;
};

/** Saves the subject and text of one automatic e-mail (or resets it to the default). */
export async function saveEmailAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const res = await attempt(async () => {
    const id = templateId(fd);
    const db = await getDb();
    const keys = [emailKey(id, "subject"), emailKey(id, "body")];
    if (field.str(fd, "do") === "reset") {
      for (const key of keys) await db.delete(content).where(eq(content.key, key));
      return "Vráceno na původní text.";
    }
    const values = { subject: field.str(fd, "subject").trim(), body: field.str(fd, "body").replace(/\r\n/g, "\n").trim() };
    if (id !== "signature" && (!values.subject || !values.body)) throw new UserError("Předmět ani text nesmí být prázdný.");
    for (const part of ["subject", "body"] as const) {
      const key = emailKey(id, part);
      const def = EMAILS[id][part];
      if (values[part] === def) await db.delete(content).where(eq(content.key, key));
      else
        await db
          .insert(content)
          .values({ key, value: values[part], updatedAt: new Date() })
          .onConflictDoUpdate({ target: content.key, set: { value: values[part], updatedAt: new Date() } });
    }
    return "Uloženo – takhle teď e-mail odchází.";
  });
  revalidatePath("/admin/emaily");
  return res;
}

/** Sends the e-mail with sample data to the admin's own address. */
export async function sendEmailSampleAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  return attempt(async () => {
    const id = templateId(fd);
    const { subject, text } = await renderEmail(id, sampleVars(id));
    await sendMail({ to: admin.email, subject: `[ukázka] ${subject}`, text });
    return `Ukázka odešla na ${admin.email}.`;
  });
}
