import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, campaigns, classSessions } from "@/db/schema";
import { adminAddBooking } from "@/domain/booking";
import { audienceRecipients } from "@/domain/campaigns";
import { NOW, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const MAIL = "6f1d2b84-93ae-4c57-b0e8-1a7c5d39e264";
const NOTE = "Lekce se nekoná – dnes 17. 11. máme z provozních důvodů zavřeno. Moc se omlouváme! Přihlášeným vracíme vstup nebo kredit na účet. Uvidíme se zítra 18. 11.";
const migrate = async () => {
  for (const statement of readFileSync("drizzle/0162_closed_today_17_11.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const session = async (id: string) => (await h.db.select().from(classSessions).where(eq(classSessions.id, id)))[0];

describe("migration 0162: closed on Tuesday 17 Nov 2026", () => {
  it("the apology e-mail waits as a draft in Zprávy – a service message for the members, nothing is sent", async () => {
    const [c] = await h.db.select().from(campaigns).where(eq(campaigns.id, MAIL));
    expect(c).toMatchObject({ channel: "email", purpose: "service", status: "draft", audience: { segment: "members" }, sentCount: 0, recipientCount: 0, sentAt: null });
    expect(c.subject).toBe("Dnes 17. 11. máme zavřeno – uvidíme se zítra");
    expect(c.body).toContain("Ahoj {{osloveni}},");
    expect(c.body).toContain("dnes 17. 11. máme z provozních důvodů zavřeno");
    expect(c.body).toContain("Zítra 18. 11. už jsme zase tady");
    await expect(audienceRecipients(h.db, c)).resolves.toBeInstanceOf(Array);
  });

  it("cancels today's lessons nobody is signed up for; the ones with clients wait for the studio's click", async () => {
    const empty = await makeSession(h.db, { startsAt: new Date("2026-11-17T16:00:00Z"), capacity: 10 }); // 17:00 in Prague
    const booked = await makeSession(h.db, { startsAt: new Date("2026-11-17T17:00:00Z"), capacity: 10 });
    const own = await makeSession(h.db, { startsAt: new Date("2026-11-17T06:00:00Z"), capacity: 10, note: "Workshop" });
    const monday = await makeSession(h.db, { startsAt: new Date("2026-11-16T22:30:00Z"), capacity: 10 }); // 23:30 Monday in Prague
    const tomorrow = await makeSession(h.db, { startsAt: new Date("2026-11-17T23:00:00Z"), capacity: 10 }); // Wednesday 0:00 in Prague
    const u = await makeUser(h.db);
    const b = await adminAddBooking(h.db, { sessionId: booked.id, userId: u.id, pay: "admin" }, NOW);

    await migrate();
    expect(await session(empty.id)).toMatchObject({ status: "cancelled", note: NOTE });
    expect(await session(booked.id)).toMatchObject({ status: "scheduled", note: NOTE });
    expect((await h.db.select().from(bookings).where(eq(bookings.id, b.id)))[0].status).toBe("confirmed");
    expect(await session(own.id)).toMatchObject({ status: "cancelled", note: "Workshop" });
    for (const s of [monday, tomorrow]) expect(await session(s.id)).toMatchObject({ status: "scheduled", note: null });

    // again: nothing new – one draft, the booked lesson still waits
    await h.db.update(campaigns).set({ subject: "Vlastní předmět" }).where(eq(campaigns.id, MAIL));
    await migrate();
    expect(await h.db.select().from(campaigns).where(eq(campaigns.id, MAIL))).toMatchObject([{ subject: "Vlastní předmět" }]);
    expect(await session(booked.id)).toMatchObject({ status: "scheduled" });
  });
});
