import { NextResponse, type NextRequest } from "next/server";
import { and, eq, ilike, ne, or } from "drizzle-orm";
import { getDb } from "@/db";
import { classSessions, classTypes } from "@/db/schema";
import { pragueLocalToDate } from "@/lib/dates";

/**
 * A stable link to one class for posters and pop-ups, which are made before
 * the session exists: /rozvrh/termin?lekce=Zumba%20Toning&kdy=2026-10-09T17:00
 * opens that session's booking page, or the schedule of that week if there's
 * no such session (yet).
 */
export async function GET(req: NextRequest) {
  const lekce = req.nextUrl.searchParams.get("lekce")?.trim() ?? "";
  const kdy = req.nextUrl.searchParams.get("kdy")?.trim() ?? "";
  const fallback = new URL("/rozvrh", req.url);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(kdy)) return NextResponse.redirect(fallback);

  const startsAt = pragueLocalToDate(kdy);
  const day = new Date(`${kdy.slice(0, 10)}T12:00:00Z`);
  const monday = new Date(day.getTime() - ((day.getUTCDay() + 6) % 7) * 86_400_000);
  fallback.searchParams.set("tyden", monday.toISOString().slice(0, 10));

  const [s] = await (await getDb())
    .select({ id: classSessions.id })
    .from(classSessions)
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .where(
      and(
        eq(classSessions.startsAt, startsAt),
        ne(classSessions.status, "cancelled"),
        lekce ? or(ilike(classTypes.name, lekce), ilike(classSessions.title, lekce)) : undefined,
      ),
    )
    .limit(1);
  return NextResponse.redirect(s ? new URL(`/rozvrh/${s.id}`, req.url) : fallback);
}
