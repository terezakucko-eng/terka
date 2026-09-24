import { site } from "@/config/site";

type Mail = { to: string; subject: string; text: string };

/**
 * Sends transactional e-mail via Resend (https://resend.com) when
 * RESEND_API_KEY is set, otherwise prints it to the server log.
 * Never throws – a failed e-mail must not break a booking.
 */
export async function sendMail({ to, subject, text }: Mail) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM ?? `${site.name} <${site.email}>`;
  const body = `${text}\n\n—\n${site.name} · ${site.tagline}\n${site.url}`;
  if (!key) {
    console.info(`[mail] → ${to}\n${subject}\n${body}\n`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text: body }),
    });
    if (!res.ok) console.error("[mail] failed", res.status, await res.text());
  } catch (e) {
    console.error("[mail] failed", e);
  }
}
