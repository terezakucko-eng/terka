import { getContent } from "@/content";
import { getDb } from "@/db";
import { calendarEvents, calendarOwner, studioEvents } from "@/domain/calendar";
import { site } from "@/config/site";
import { icsCalendar, icsResponse } from "@/lib/ics";

/**
 * The client's own calendar feed (subscribed in the phone's calendar): every
 * booking appears by itself, a cancelled one disappears on the next refresh.
 * The admin's feed is the studio's whole schedule, with how many are booked.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/kalendar/odber/[token]">) {
  const { token } = await ctx.params;
  const db = await getDb();
  const owner = await calendarOwner(db, token.replace(/\.ics$/, ""));
  if (!owner) return new Response("Kalendář nenalezen.", { status: 404 });
  const c = await getContent();
  const address = `${c.raw("site.street")}, ${c.raw("site.city")}`;
  if (owner.role === "admin") return icsResponse(icsCalendar(await studioEvents(db, address), { name: `${site.name} – rozvrh studia` }), "octopush.ics", false);
  const events = await calendarEvents(db, owner.id, address);
  return icsResponse(icsCalendar(events, { name: `${site.name} – moje lekce` }), "octopush.ics", false);
}
