import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classSessions, users } from "@/db/schema";
import { calendarEvents, calendarOwner } from "@/domain/calendar";
import { feedLinks, googleCalendarLink, icsCalendar } from "@/lib/ics";
import { NOW, hours, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("ics", () => {
  it("writes a valid calendar with escaped texts and folded long lines", () => {
    const ics = icsCalendar(
      [
        {
          uid: "x@octopush.fit",
          title: "Pilates; s Terezou, v sále",
          start: new Date("2026-10-14T16:00:00Z"),
          end: new Date("2026-10-14T17:00:00Z"),
          location: "Pospolitá 699/16, Ostrava",
          description: `Řádek 1\nŘádek 2 ${"dlouhý text ".repeat(10)}`,
        },
      ],
      { now: NOW, alarmMin: 60 },
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261014T160000Z\r\n");
    expect(ics).toContain("SUMMARY:Pilates\\; s Terezou\\, v sále\r\n");
    expect(ics).toContain("TRIGGER:-PT60M");
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    // unfolding gives the original description back
    expect(ics.replace(/\r\n /g, "")).toContain(`DESCRIPTION:Řádek 1\\nŘádek 2 ${"dlouhý text ".repeat(10)}`);
  });

  it("builds Google and subscription links", () => {
    const g = googleCalendarLink({ title: "Zumba", start: new Date("2026-10-14T16:00:00Z"), end: new Date("2026-10-14T17:00:00Z") });
    expect(g).toContain("dates=20261014T160000Z%2F20261014T170000Z");
    const f = feedLinks("abc");
    expect(f.webcal).toMatch(/^webcal:\/\/.+\/api\/kalendar\/odber\/abc\.ics$/);
    expect(decodeURIComponent(f.google)).toContain(`cid=${f.webcal}`);
  });
});

describe("calendar feed", () => {
  it("lists the client's own active bookings and finds the owner by the secret address", async () => {
    const u = await makeUser(h.db);
    const other = await makeUser(h.db);
    const a = await makeSession(h.db, { startsAt: hours(24) });
    const b = await makeSession(h.db, { startsAt: hours(72), title: "Dýňový brunch" });
    const c = await makeSession(h.db, { startsAt: hours(96) });
    const old = await makeSession(h.db, { startsAt: hours(-24 * 90) });
    await h.db.insert(bookings).values([
      { userId: u.id, sessionId: a.id, status: "confirmed", guestName: "Jana" },
      { userId: u.id, sessionId: b.id, status: "confirmed" },
      { userId: u.id, sessionId: c.id, status: "cancelled" },
      { userId: u.id, sessionId: old.id, status: "attended" },
      { userId: other.id, sessionId: c.id, status: "confirmed" },
    ]);
    await h.db.update(classSessions).set({ status: "cancelled" }).where(eq(classSessions.id, b.id));

    const events = await calendarEvents(h.db, u.id, "Pospolitá 699/16, Ostrava", NOW);
    expect(events.map((e) => e.title)).toEqual(["Pilates · OCTOPUSH"]);
    expect(events[0].description).toContain("S kamarádkou: Jana");
    expect(events[0].end.getTime() - events[0].start.getTime()).toBe(60 * 60_000);

    await h.db.update(classSessions).set({ status: "scheduled" }).where(eq(classSessions.id, b.id));
    expect((await calendarEvents(h.db, u.id, "x", NOW)).map((e) => e.title)).toEqual(["Pilates · OCTOPUSH", "Dýňový brunch · OCTOPUSH"]);

    const [{ token }] = await h.db.select({ token: users.calendarToken }).from(users).where(eq(users.id, u.id));
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect((await calendarOwner(h.db, token))?.id).toBe(u.id);
    expect(await calendarOwner(h.db, "nope")).toBeNull();
    await h.db.update(users).set({ deletedAt: NOW }).where(eq(users.id, u.id));
    expect(await calendarOwner(h.db, token)).toBeNull();
  });
});
