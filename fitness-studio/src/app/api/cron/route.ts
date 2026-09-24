import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns } from "@/db/schema";
import { expireStalePending } from "@/domain/booking";
import { processCampaign } from "@/domain/campaigns";
import { campaignSender, newsletterFooter } from "@/lib/campaign-sender";
import { unsubscribeUrl } from "@/lib/links";

export const maxDuration = 60;

/**
 * Housekeeping (Vercel Cron, see vercel.json):
 * releases spots held by unpaid drop-ins and finishes campaigns whose
 * sending page was closed.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });
  const db = await getDb();
  const expired = await db.transaction((tx) => expireStalePending(tx, new Date()));

  const started = Date.now();
  let sent = 0;
  const footer = await newsletterFooter();
  for (const c of await db.select().from(campaigns).where(eq(campaigns.status, "sending"))) {
    let r = { remaining: 1, sent: 0, failed: 0 };
    while (r.remaining > 0 && Date.now() - started < 45_000) {
      r = await processCampaign(db, c.id, campaignSender(c, footer), unsubscribeUrl, 50);
      sent += r.sent;
    }
  }
  return Response.json({ expired, sent });
}
