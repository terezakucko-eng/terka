import { getContent } from "@/content";
import { getDb } from "@/db";
import { calendarEvents, calendarOwner } from "@/domain/calendar";
import { site } from "@/config/site";
import { icsCalendar, icsResponse } from "@/lib/ics";

/**
 * The client's own calendar feed (subscribed in the phone's calendar): every
 * booking appears by itself, a cancelled one disappears on the next refresh.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/kalendar/odber/[token]">) {
  const { token } = await ctx.params;
  const db = await getDb();
  const owner = await calendarOwner(db, token.replace(/\.ics$/, ""));
  if (!owner) return new Response("Kalendář nenalezen.", { status: 404 });
  const c = await getContent();
  const events = await calendarEvents(db, owner.id, `${c.raw("site.street")}, ${c.raw("site.city")}`);
  return icsResponse(icsCalendar(events, { name: `${site.name} – moje lekce` }), "octopush.ics", false);
}
