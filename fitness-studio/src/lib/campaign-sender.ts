import "server-only";
import { getContent } from "@/content";
import type { Campaign } from "@/db/schema";
import { personalize, type Recipient, type Sender } from "@/domain/campaigns";
import { oneClickUnsubscribeUrl } from "./links";
import { sendEmailBatch, sendSms, sendWhatsAppTemplate } from "./messaging";
import { renderNewsletter } from "./newsletter";

/** Wires a campaign's content to the real delivery providers. */
export function campaignSender(c: Campaign, footer: string): Sender {
  const smsText = (r: Recipient, unsub: string) => {
    const body = personalize(c.body, r, unsub);
    // marketing SMS must offer an opt-out
    return c.purpose === "marketing" && !c.body.includes("{{odhlasit}}")
      ? `${body} Odhlaseni: ${unsub}`
      : body;
  };
  return {
    email: async (msgs) =>
      sendEmailBatch(
        msgs.map(({ to, r, unsubscribeUrl }) => {
          const { html, text } = renderNewsletter({
            subject: personalize(c.subject ?? "", r, unsubscribeUrl),
            body: personalize(c.body, r, unsubscribeUrl),
            unsubscribeUrl,
            footer,
          });
          return {
            to,
            subject: personalize(c.subject ?? "", r, unsubscribeUrl),
            html,
            text,
            unsubscribeUrl: oneClickUnsubscribeUrl(r.unsubscribeToken),
          };
        }),
      ),
    single: async (to, r, unsub) =>
      c.channel === "sms"
        ? sendSms(to, smsText(r, unsub))
        : sendWhatsAppTemplate(
            to,
            c.waTemplate ?? "",
            c.waLanguage || "cs",
            (c.waParams ?? []).map((p) => personalize(p, r, unsub)),
          ),
  };
}

/** Footer line for newsletters from the editable contact details. */
export async function newsletterFooter() {
  const c = await getContent();
  return `${c("site.companyName")} · ${c("site.street")}, ${c("site.zip")} ${c("site.city")}`;
}
