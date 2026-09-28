import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { site } from "@/config/site";

/**
 * Delivery for bulk messages. Every channel has a real provider and a
 * "log" fallback used when keys are missing (development / testing):
 *   e-mail   → Resend            RESEND_API_KEY, MAIL_FROM
 *   SMS      → SMSbrána.cz       SMSBRANA_LOGIN, SMSBRANA_PASSWORD (SMS Connect)
 *              or BulkGate (CZ)  BULKGATE_APP_ID, BULKGATE_APP_TOKEN, BULKGATE_SENDER
 *   WhatsApp → Meta Cloud API    WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 */
export type SendResult = { ok: true; ref?: string } | { ok: false; error: string };

export function providerStatus() {
  return {
    email: process.env.RESEND_API_KEY ? "Resend" : null,
    sms: process.env.SMSBRANA_LOGIN && process.env.SMSBRANA_PASSWORD
      ? "SMSbrána.cz"
      : process.env.BULKGATE_APP_ID && process.env.BULKGATE_APP_TOKEN
        ? "BulkGate"
        : null,
    whatsapp:
      process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
        ? "WhatsApp Business (Meta)"
        : null,
  };
}

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { ok: res.ok, status: res.status, json: json as Record<string, unknown> | null, text };
}

/* ---------------------------------------------------------------- e-mail */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
};

/** Sends up to 100 e-mails in one Resend batch call. */
export async function sendEmailBatch(msgs: EmailMessage[]): Promise<SendResult[]> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    for (const m of msgs) console.info(`[newsletter] → ${m.to}: ${m.subject}`);
    return msgs.map(() => ({ ok: true, ref: "log" }));
  }
  const from = process.env.MAIL_FROM ?? `${site.name} <${site.email}>`;
  const r = await post(
    "https://api.resend.com/emails/batch",
    msgs.map((m) => ({
      from,
      to: m.to,
      subject: m.subject,
      html: m.html,
      text: m.text,
      headers: {
        "List-Unsubscribe": `<${m.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    })),
    { Authorization: `Bearer ${key}` },
  );
  if (!r.ok) return msgs.map(() => ({ ok: false, error: `Resend ${r.status}: ${r.text.slice(0, 200)}` }));
  const data = (r.json?.data as { id: string }[] | undefined) ?? [];
  return msgs.map((_, i) => ({ ok: true, ref: data[i]?.id }));
}

/* ------------------------------------------------------------------- SMS */

/** "20260928T101500" – the timestamp SMS Connect signs with. */
const smsConnectTime = (d: Date) => d.toISOString().slice(0, 19).replace(/[-:]/g, "");

/**
 * SMSbrána.cz – SMS Connect HTTP API. Signed login: auth = md5(password + time + salt),
 * so the password itself never travels. Replies with XML where <err>0</err> means sent.
 */
export async function sendSmsBrana(to: string, text: string, now = new Date()): Promise<SendResult> {
  const login = process.env.SMSBRANA_LOGIN!;
  const password = process.env.SMSBRANA_PASSWORD!;
  const time = smsConnectTime(now);
  const sul = randomBytes(8).toString("hex");
  const params = new URLSearchParams({
    action: "send_sms",
    login,
    time,
    sul,
    auth: createHash("md5").update(password + time + sul).digest("hex"),
    number: to.replace(/^\+/, ""),
    message: text,
  });
  try {
    const res = await fetch(`https://api.smsbrana.cz/smsconnect/http.php?${params}`);
    const body = await res.text();
    const err = body.match(/<err>(\d+)<\/err>/)?.[1];
    if (res.ok && err === "0") return { ok: true, ref: body.match(/<sms_id>([^<]+)<\/sms_id>/)?.[1] };
    return { ok: false, error: `SMSbrána ${res.status}, chyba ${err ?? "?"}: ${body.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: `SMSbrána: ${(e as Error).message}` };
  }
}

export async function sendSms(to: string, text: string): Promise<SendResult> {
  if (process.env.SMSBRANA_LOGIN && process.env.SMSBRANA_PASSWORD) return sendSmsBrana(to, text);
  const id = process.env.BULKGATE_APP_ID;
  const token = process.env.BULKGATE_APP_TOKEN;
  if (!id || !token) {
    console.info(`[sms] → ${to}: ${text}`);
    return { ok: true, ref: "log" };
  }
  const sender = process.env.BULKGATE_SENDER; // schválený text odesílatele, např. OCTOPUSH
  const r = await post("https://portal.bulkgate.com/api/1.0/simple/transactional", {
    application_id: id,
    application_token: token,
    number: to.replace(/^\+/, ""),
    text,
    unicode: /[^\x00-\x7F]/.test(text),
    ...(sender ? { sender_id: "gText", sender_id_value: sender } : { sender_id: "gSystem" }),
  });
  const data = r.json?.data as { status?: string; sms_id?: string } | undefined;
  if (r.ok && data?.sms_id) return { ok: true, ref: data.sms_id };
  return { ok: false, error: `BulkGate ${r.status}: ${r.text.slice(0, 200)}` };
}

/* -------------------------------------------------------------- WhatsApp */

/**
 * Business-initiated WhatsApp messages must use a template approved by Meta.
 * `params` fill the template's {{1}}, {{2}}… body variables.
 */
export async function sendWhatsAppTemplate(
  to: string,
  template: string,
  language: string,
  params: string[],
): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.info(`[whatsapp] → ${to}: template ${template} ${JSON.stringify(params)}`);
    return { ok: true, ref: "log" };
  }
  const r = await post(
    `https://graph.facebook.com/v21.0/${phoneId}/messages`,
    {
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: template,
        language: { code: language },
        ...(params.length
          ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] }
          : {}),
      },
    },
    { Authorization: `Bearer ${token}` },
  );
  const id = (r.json?.messages as { id: string }[] | undefined)?.[0]?.id;
  if (r.ok && id) return { ok: true, ref: id };
  return { ok: false, error: `WhatsApp ${r.status}: ${r.text.slice(0, 200)}` };
}
