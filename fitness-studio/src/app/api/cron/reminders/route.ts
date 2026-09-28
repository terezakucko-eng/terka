import { getDb } from "@/db";
import { site } from "@/config/site";
import { dueReminders, markReminded } from "@/domain/reminders";
import { formatDay, formatTime } from "@/lib/dates";
import { sendMail } from "@/lib/mail";
import { getSettings } from "@/lib/settings";

export const maxDuration = 60;

/**
 * Evening reminder (Vercel Cron, see vercel.json): e-mails clients who opted in and are booked
 * on a class or massage tomorrow. Each booking is reminded only once.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });
  const db = await getDb();
  const cfg = await getSettings(db);
  const { classes, massages } = await dueReminders(db);
  const done = { classes: [] as string[], massages: [] as string[] };

  for (const b of classes) {
    try {
      await sendMail({
        to: b.email,
        subject: `Zítra: ${b.name} v ${formatTime(b.startsAt)}`,
        text: `Ahoj ${b.userName},\n\npřipomínáme zítřejší lekci ${b.name} – ${formatDay(b.startsAt)} v ${formatTime(b.startsAt)}.\n\nKdyž to nestihneš, zruš prosím rezervaci včas (zdarma nejpozději ${cfg.cancellationHours} h předem), ať se místo uvolní dalším: ${site.url}/rozvrh/${b.sessionId}\n\nTěšíme se!`,
      });
      done.classes.push(b.id);
    } catch {
      // try again tomorrow evening is pointless – just skip this one
    }
  }
  for (const m of massages) {
    try {
      await sendMail({
        to: m.email,
        subject: `Zítra: ${m.name} v ${formatTime(m.startsAt)}`,
        text: `Ahoj ${m.userName},\n\npřipomínáme zítřejší masáž ${m.name} – ${formatDay(m.startsAt)} v ${formatTime(m.startsAt)}.\n\nDetail a případné zrušení: ${site.url}/masaze/rezervace/${m.id}\n\nTěšíme se!`,
      });
      done.massages.push(m.id);
    } catch {
      // skip
    }
  }
  await markReminded(db, done);
  return Response.json({ classes: done.classes.length, massages: done.massages.length });
}
