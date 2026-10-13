import { getDb } from "@/db";
import { site } from "@/config/site";
import { dueReminders, markReminded } from "@/domain/reminders";
import { formatDay, formatTime } from "@/lib/dates";
import { sendEmail } from "@/lib/email-templates";
import { greetName } from "@/lib/vocative";
import { pushQuietly } from "@/lib/push";
import { sendGreetings, sendReferralThanks, sendWinbacks } from "@/lib/notify";
import { pragueHour } from "@/lib/dates";

export const maxDuration = 60;

/**
 * Reminder (Vercel Cron every 15 min, see vercel.json): e-mails clients who opted in about a class
 * or massage starting within the next REMINDER_HOURS. Each booking is reminded only once.
 * From 9:00 (Prague) it also sends the birthday / name-day wishes, from 10:00 „Chybíš nám“ –
 * each once, so the first run of the day does it and the later ones find nothing.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });
  const db = await getDb();
  const { classes, massages } = await dueReminders(db);
  const done = { classes: [] as string[], massages: [] as string[] };

  for (const b of classes) {
    try {
      await sendEmail(b.email, "reminderClass", {
        osloveni: greetName(b.userName),
        lekce: b.name,
        den: formatDay(b.startsAt),
        cas: formatTime(b.startsAt),
        odkaz: `${site.url}/rozvrh/${b.sessionId}`,
      });
      await pushQuietly(db, [b.userId], { title: `Za chvíli: ${b.name} v ${formatTime(b.startsAt)}`, body: "Připomínka lekce – těšíme se na tebe!", url: `${site.url}/rozvrh/${b.sessionId}` });
      done.classes.push(b.id);
    } catch {
      // the next run would be too late anyway – just skip this one
    }
  }
  for (const m of massages) {
    try {
      await sendEmail(m.email, "reminderMassage", {
        osloveni: greetName(m.userName),
        masaz: m.name,
        den: formatDay(m.startsAt),
        cas: formatTime(m.startsAt),
        odkaz: `${site.url}/masaze/rezervace/${m.id}`,
      });
      await pushQuietly(db, [m.userId], { title: `Za chvíli: ${m.name} v ${formatTime(m.startsAt)}`, body: "Připomínka masáže – těšíme se na tebe!", url: `${site.url}/masaze/rezervace/${m.id}` });
      done.massages.push(m.id);
    } catch {
      // skip
    }
  }
  await markReminded(db, done);
  const now = new Date();
  const hour = pragueHour(now);
  const greetings = hour >= 9 && hour < 21 ? await sendGreetings(db, now) : null;
  const winbacks = hour >= 10 && hour < 18 ? await sendWinbacks(db, now) : 0;
  const referralThanks = hour >= 8 && hour < 21 ? await sendReferralThanks(db, now) : 0;
  return Response.json({ classes: done.classes.length, massages: done.massages.length, greetings, winbacks, referralThanks });
}
