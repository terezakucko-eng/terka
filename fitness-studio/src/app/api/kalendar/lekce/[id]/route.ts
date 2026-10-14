import { getContent } from "@/content";
import { getDb } from "@/db";
import { lessonEvent } from "@/domain/calendar";
import { icsCalendar, icsResponse } from "@/lib/ics";
import { sessionDetail } from "@/lib/queries";

const UUID = /^[0-9a-f-]{36}$/i;

/** One lesson as an .ics file – „Přidat do kalendáře“ for Apple, Outlook and others. */
export async function GET(_: Request, ctx: RouteContext<"/api/kalendar/lekce/[id]">) {
  const { id } = await ctx.params;
  const r = UUID.test(id) ? await sessionDetail(await getDb(), id) : null;
  if (!r || r.s.status === "cancelled") return new Response("Lekce nenalezena.", { status: 404 });
  const c = await getContent();
  const event = lessonEvent(r.s, r.ct, `${c.raw("site.street")}, ${c.raw("site.city")}`);
  return icsResponse(icsCalendar([event], { alarmMin: 60 }), `octopush-${r.s.startsAt.toISOString().slice(0, 10)}.ics`);
}
