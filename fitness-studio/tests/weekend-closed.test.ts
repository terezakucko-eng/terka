import { readFileSync } from "node:fs";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { announcements, bookings, campaigns, classSessions } from "@/db/schema";
import { adminAddBooking } from "@/domain/booking";
import { audienceRecipients } from "@/domain/campaigns";
import { NOW, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const POST = "7c2e9a41-5d38-4b6f-8e17-3a90c4d1f5b2";
const MAIL = "9d4b7f20-6c15-4e83-a2d9-51f08e3b6c74";
const NOTE = "Lekce se nekoná – o víkendu 21.–22. 11. je studio zavřené (jsme na kurzu pilates). Přihlášeným vracíme vstup nebo kredit na účet.";
const migrate = async () => {
  for (const statement of readFileSync("drizzle/0157_weekend_closed_21_22.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const session = async (id: string) => (await h.db.select().from(classSessions).where(eq(classSessions.id, id)))[0];

describe("migration 0157: the studio is closed on the weekend of 21–22 Nov 2026", () => {
  it("says so on the board, pinned, with the way to next week's lessons", async () => {
    const [post] = await h.db.select().from(announcements).where(eq(announcements.id, POST));
    expect(post).toMatchObject({ title: "🧘‍♀️ O víkendu 21.–22. 11. máme zavřeno", isPinned: true, isPublished: true });
    expect(post.body).toContain("<strong>Reformer fusion (17:00)</strong> a <strong>Zumba fitness (18:00)</strong> se nekonají");
    expect(post.body).toContain('<a href="/rozvrh?tyden=2026-11-23">');
  });

  it("the e-mail waits as a draft in Zprávy – a service message for the members, nothing is sent", async () => {
    const [c] = await h.db.select().from(campaigns).where(eq(campaigns.id, MAIL));
    expect(c).toMatchObject({ channel: "email", purpose: "service", status: "draft", audience: { segment: "members" }, sentCount: 0, recipientCount: 0, sentAt: null });
    expect(c.subject).toBe("O víkendu 21.–22. 11. máme zavřeno");
    expect(c.body).toContain("Ahoj {{osloveni}},");
    expect(c.body).toContain("https://www.octopush.fit/rozvrh?tyden=2026-11-23");
    // a service message doesn't need the marketing consent – who gets it is the studio's choice before sending
    await expect(audienceRecipients(h.db, c)).resolves.toBeInstanceOf(Array);
  });

  it("cancels the weekend's lessons nobody is signed up for; the ones with clients wait for the studio's click", async () => {
    const empty = await makeSession(h.db, { startsAt: new Date("2026-11-22T17:00:00Z"), capacity: 10 }); // Sunday 18:00 in Prague
    const booked = await makeSession(h.db, { startsAt: new Date("2026-11-22T16:00:00Z"), capacity: 10 });
    const own = await makeSession(h.db, { startsAt: new Date("2026-11-21T08:00:00Z"), capacity: 10, note: "Workshop" });
    const friday = await makeSession(h.db, { startsAt: new Date("2026-11-20T15:00:00Z"), capacity: 10 });
    const lateFriday = await makeSession(h.db, { startsAt: new Date("2026-11-20T22:30:00Z"), capacity: 10 }); // 23:30 in Prague – still Friday
    const monday = await makeSession(h.db, { startsAt: new Date("2026-11-22T23:00:00Z"), capacity: 10 }); // Monday 0:00 in Prague
    const u = await makeUser(h.db);
    const b = await adminAddBooking(h.db, { sessionId: booked.id, userId: u.id, pay: "admin" }, NOW);

    await migrate();
    expect(await session(empty.id)).toMatchObject({ status: "cancelled", note: NOTE });
    // nothing is taken from the client behind the studio's back: the place and the booking stay until the studio cancels
    expect(await session(booked.id)).toMatchObject({ status: "scheduled", note: NOTE });
    expect((await h.db.select().from(bookings).where(eq(bookings.id, b.id)))[0].status).toBe("confirmed");
    // the studio's own note stays; the lesson is still cancelled when empty
    expect(await session(own.id)).toMatchObject({ status: "cancelled", note: "Workshop" });
    for (const s of [friday, lateFriday, monday]) expect(await session(s.id)).toMatchObject({ status: "scheduled", note: null });

    // again: nothing new – one post, one draft, the booked lesson still waits
    await migrate();
    expect(await h.db.select().from(announcements).where(eq(announcements.id, POST))).toHaveLength(1);
    expect(await h.db.select().from(campaigns).where(eq(campaigns.id, MAIL))).toHaveLength(1);
    expect((await h.db.select().from(classSessions).where(inArray(classSessions.id, [booked.id, friday.id, monday.id]))).map((s) => s.status)).toEqual(["scheduled", "scheduled", "scheduled"]);
  });

  it("what the studio rewrote stays", async () => {
    await h.db.update(announcements).set({ body: "<p>Vlastní text</p>", isPinned: false }).where(eq(announcements.id, POST));
    await h.db.update(campaigns).set({ subject: "Vlastní předmět" }).where(eq(campaigns.id, MAIL));
    await migrate();
    expect((await h.db.select().from(announcements).where(eq(announcements.id, POST)))[0]).toMatchObject({ body: "<p>Vlastní text</p>", isPinned: false });
    expect((await h.db.select().from(campaigns).where(eq(campaigns.id, MAIL)))[0].subject).toBe("Vlastní předmět");
  });
});
