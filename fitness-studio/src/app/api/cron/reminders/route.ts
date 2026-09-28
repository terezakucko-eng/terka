import { getDb } from "@/db";
import { site } from "@/config/site";
import { dueReminders, markReminded } from "@/domain/reminders";
import { formatDay, formatTime } from "@/lib/dates";
import { sendMail } from "@/lib/mail";

export const maxDuration = 60;

/**
 * Reminder (Vercel Cron every 15 min, see vercel.json): e-mails clients who opted in about a class
 * or massage starting within the next REMINDER_HOURS. Each booking is reminded only once.
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
      await sendMail({
        to: b.email,
        subject: `Za chvíli: ${b.name} v ${formatTime(b.startsAt)}`,
        text: `Ahoj ${b.userName},\n\npřipomínáme dnešní lekci ${b.name} – ${formatDay(b.startsAt)} v ${formatTime(b.startsAt)}.\n\nKdyby ses nakonec nemohl/a dostavit, zruš prosím rezervaci, ať se místo uvolní dalším: ${site.url}/rozvrh/${b.sessionId}\n\nTěšíme se!`,
      });
      done.classes.push(b.id);
    } catch {
      // the next run would be too late anyway – just skip this one
    }
  }
  for (const m of massages) {
    try {
      await sendMail({
        to: m.email,
        subject: `Za chvíli: ${m.name} v ${formatTime(m.startsAt)}`,
        text: `Ahoj ${m.userName},\n\npřipomínáme dnešní masáž ${m.name} – ${formatDay(m.startsAt)} v ${formatTime(m.startsAt)}.\n\nDetail a případné zrušení: ${site.url}/masaze/rezervace/${m.id}\n\nTěšíme se!`,
      });
      done.massages.push(m.id);
    } catch {
      // skip
    }
  }
  await markReminded(db, done);
  return Response.json({ classes: done.classes.length, massages: done.massages.length });
}
