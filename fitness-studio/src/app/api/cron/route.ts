import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, users } from "@/db/schema";
import { site } from "@/config/site";
import { creditsExpiringSoon, expireCredits } from "@/domain/wallet";
import { dateKey, formatDate } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { createMonthlyFees, currentPeriod, shiftPeriod } from "@/domain/membership-fees";
import { notifyFee } from "@/lib/notify";
import { sendEmail } from "@/lib/email-templates";
import { expireStalePending } from "@/domain/booking";
import { processCampaign } from "@/domain/campaigns";
import { campaignSender, newsletterFooter } from "@/lib/campaign-sender";
import { unsubscribeUrl } from "@/lib/links";
import { greetName } from "@/lib/vocative";

export const maxDuration = 60;

/**
 * Housekeeping (Vercel Cron, see vercel.json):
 * releases spots held by unpaid drop-ins, zeroes expired credit (and
 * warns a week ahead), and finishes campaigns whose sending page was closed.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });
  const db = await getDb();
  const expired = await db.transaction((tx) => expireStalePending(tx, new Date()));
  const creditsExpired = await expireCredits(db);
  let creditWarnings = 0;
  for (const u of await creditsExpiringSoon(db)) {
    await sendEmail(u.email, "creditExpiry", {
      osloveni: greetName(u.name),
      kredit: String(u.balance),
      platnost: formatDate(u.expiresAt!),
      odkaz: `${site.url}/rozvrh`,
    });
    await db.update(users).set({ creditExpiryWarnedAt: new Date() }).where(eq(users.id, u.id));
    creditWarnings++;
  }

  // Membership fees for next month go out from the notice day on (idempotent, so a missed run catches up).
  let feeNotices = 0;
  const cfg = await getSettings(db);
  const now = new Date();
  if (cfg.membershipMonthlyFee > 0 && +dateKey(now).slice(8, 10) >= cfg.membershipFeeNoticeDay) {
    const created = await createMonthlyFees(db, { period: shiftPeriod(currentPeriod(now), 1), amountKc: cfg.membershipMonthlyFee });
    feeNotices = await notifyFee(db, created);
  }

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
  return Response.json({ expired, sent, creditsExpired, creditWarnings, feeNotices });
}
