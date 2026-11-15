import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { announcements, classSessions, classTypes, instructors } from "@/db/schema";
import { makeSession, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const ID = "e3b5a1d7-2c46-4f8a-b9d0-5a6c7e8f9012";
const NEXT_MONDAY = "14cbd914-b7f7-4386-9317-6332983bcdfc";
const POST = "146aa9e2-80ab-437c-b082-47ecb7403616";
const AT = new Date("2026-11-16T16:00:00Z"); // 17:00 in Prague
const LINE = "Zumba Toning v 17:00 se nakonec nekoná – omlouváme se. O to víc to společně rozjedeme v 18:00! 💃";

const migrate = async () => {
  for (const statement of readFileSync("drizzle/0156_silovy_16_11_back.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const at17 = () => h.db.select().from(classSessions).where(eq(classSessions.startsAt, AT));
const post = async () => (await h.db.select().from(announcements).where(eq(announcements.id, POST)))[0].body;

describe("migration 0156: Zdravé tělo | silový trénink back on Monday 16. 11. at 17:00", () => {
  it("does nothing where the Monday lessons aren't in the schedule (a fresh database)", async () => {
    await migrate();
    expect(await at17()).toHaveLength(0);
  });

  it("adds the lesson like the next Monday's one, open by the usual rules, and the board post says so", async () => {
    const [who] = await h.db.insert(instructors).values({ name: "Lektorka", slug: "lektorka-silovy" }).returning();
    const next = await makeSession(h.db, { id: NEXT_MONDAY, startsAt: new Date("2026-11-23T16:00:00Z"), instructorId: who.id, durationMin: 60, capacity: 12, creditCost: 220, dropInPrice: 25000, room: "Sál" });
    await h.db.update(classTypes).set({ name: "Zdravé tělo | silový trénink" }).where(eq(classTypes.id, next.classTypeId));
    await h.db.update(announcements).set({ body: `<p><strong>Změna programu:</strong> ${LINE}</p>` }).where(eq(announcements.id, POST));

    await migrate();
    const [s] = await at17();
    expect(s).toMatchObject({
      id: ID, classTypeId: next.classTypeId, instructorId: who.id, durationMin: 60, capacity: 12, creditCost: 220, dropInPrice: 25000,
      room: "Sál", status: "scheduled", title: null, note: null, bookingOpensAt: null, noFreeEntry: false, dropInOnly: false, bundleId: null,
    });
    expect(await post()).toBe(
      `<p><strong>Změna programu:</strong> Zumba Toning v 17:00 se nakonec nekoná – omlouváme se. V 17:00 je místo něj jako každé pondělí <a href="/rozvrh/${ID}">Zdravé tělo | silový trénink</a> a v 18:00 to společně rozjedeme na Zumbě! 💃</p>`,
    );

    // once only
    await migrate();
    expect(await at17()).toHaveLength(1);
    expect((await post()).match(/Zdravé tělo/g)).toHaveLength(1);
  });

  it("isn't added when the studio already has a lesson at that time, or took this one off again", async () => {
    // the studio cancelled it – it doesn't come back by itself, the post's link isn't added again
    await h.db.update(classSessions).set({ status: "cancelled" }).where(eq(classSessions.id, ID));
    await h.db.update(announcements).set({ body: `<p>${LINE}</p>` }).where(eq(announcements.id, POST));
    await migrate();
    expect((await at17()).map((s) => s.status)).toEqual(["cancelled"]);
    expect(await post()).toBe(`<p>${LINE}</p>`);

    // another lesson put there by hand stays the only one scheduled
    await h.db.delete(classSessions).where(eq(classSessions.id, ID));
    const own = await makeSession(h.db, { startsAt: AT });
    await migrate();
    expect((await at17()).map((s) => s.id)).toEqual([own.id]);
  });
});
