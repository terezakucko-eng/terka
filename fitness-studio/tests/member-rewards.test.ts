import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { announcements, bookings, classTypes, content, entitlements, type ClassType } from "@/db/schema";
import { bookSession, bookingOptions } from "@/domain/booking";
import { EARLY_BIRD, grantEarlyBirdGift } from "@/domain/early-bird";
import { createProductOrder, fulfillOrder } from "@/domain/orders";
import { withButtons } from "@/components/rich-text";
import { memberRewardNotes } from "@/domain/member-rewards";
import { pragueLocalToDate } from "@/lib/dates";
import { popupOver, popupSlot } from "@/lib/popup-seen";
import { NOW, makeProduct, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
let reformer: ClassType;
beforeAll(async () => {
  h = await testDb();
  const s = await makeSession(h.db);
  [reformer] = await h.db.update(classTypes).set({ slug: "reformer-fusion", name: "Reformer fusion", memberSurcharge: 25000 }).where(eq(classTypes.id, s.classTypeId)).returning();
});
afterAll(async () => h.close());

const JAN = pragueLocalToDate("2027-01-01T00:00");
const MIGRATION = "drizzle/0119_member_rewards_2027.sql";
const statements = () => readFileSync(MIGRATION, "utf8").split("--> statement-breakpoint");
const gifts = async (userId: string) =>
  h.db.select().from(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.name, EARLY_BIRD.name)));
const member = async (over: Partial<typeof entitlements.$inferInsert>) => {
  const u = await makeUser(h.db);
  await h.db.insert(entitlements).values({ userId: u.id, kind: "membership", name: "Členství", validFrom: NOW, validUntil: pragueLocalToDate("2027-10-05T00:00"), ...over });
  return u;
};

describe("dárek za včasnou rezervaci – 4× Reformer bez doplatku na rok 2027", () => {
  it("migration 0119: members on 1. 1. 2027 with commitment get it, once", async () => {
    const committed = await makeProduct(h.db, { kind: "membership", name: "Členství 2026", commitmentMonths: 12 });
    const flexible = await makeProduct(h.db, { kind: "membership", name: "Členství bez závazku", commitmentMonths: 0 });
    const yes = [
      await member({ productId: committed.id }),
      await member({ productId: committed.id, validFrom: JAN, validUntil: pragueLocalToDate("2028-01-01T00:00") }), // reserved in presale
      await member({}), // set up by the studio
    ];
    const no = [
      await member({ productId: committed.id, validUntil: new Date(JAN.getTime() - 60_000) }), // ends with 2026
      await member({ productId: committed.id, includedClassTypeId: reformer.id, includedPerMonth: 8 }), // Členství Reformer
      await member({ productId: flexible.id }),
      await member({ productId: committed.id, status: "cancelled" }),
    ];
    await h.db.execute(sql.raw(statements()[0]));
    await h.db.execute(sql.raw(statements()[0])); // safe to repeat
    for (const u of yes) {
      const g = await gifts(u.id);
      expect(g).toHaveLength(1);
      expect(g[0]).toMatchObject({ kind: "free", entriesTotal: 4, entriesUsed: 0, classTypeId: reformer.id, validFrom: JAN, validUntil: EARLY_BIRD.until });
    }
    for (const u of no) expect(await gifts(u.id)).toEqual([]);
    // the code agrees with the migration: nobody left
    expect(await grantEarlyBirdGift(h.db)).toBe(0);
  });

  it("buying membership for 2027 in December gives it right away; in January not any more", async () => {
    const y2027 = await makeProduct(h.db, { kind: "membership", name: "Členství 2027", price: 140000, commitmentMonths: 12, validityDays: 365, saleFrom: JAN, presaleFrom: NOW });
    const buy = async (at: Date) => {
      const u = await makeUser(h.db);
      const { order } = await createProductOrder(h.db, { userId: u.id, productId: y2027.id, commitmentAccepted: true }, at);
      await fulfillOrder(h.db, { orderId: order.id, provider: "transfer" }, at);
      return u;
    };
    const december = await buy(pragueLocalToDate("2026-12-10T10:00"));
    expect(await gifts(december.id)).toHaveLength(1);
    const january = await buy(pragueLocalToDate("2027-01-05T10:00"));
    expect(await gifts(january.id)).toEqual([]);
  });

  it("is offered first when booking Reformer – no surcharge; used up, the membership pays the surcharge again", async () => {
    const u = await member({});
    expect(await grantEarlyBirdGift(h.db, [u.id])).toBe(1);
    const [gift] = await gifts(u.id);
    const at = pragueLocalToDate("2027-01-08T10:00");
    const s = await makeSession(h.db, { classTypeId: reformer.id, capacity: 5, startsAt: pragueLocalToDate("2027-01-10T17:00") });

    const [first] = await bookingOptions(h.db, u.id, s, 1, at);
    expect(first).toMatchObject({ method: "free", entitlementId: gift.id });
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "free", entitlementId: gift.id }, at);
    expect(booking.surcharge).toBe(0);

    await h.db.update(entitlements).set({ entriesUsed: 4 }).where(eq(entitlements.id, gift.id));
    const later = await makeSession(h.db, { classTypeId: reformer.id, capacity: 5, startsAt: pragueLocalToDate("2027-01-11T17:00") });
    const next = (await bookingOptions(h.db, u.id, later, 1, at)).find((o) => !o.disabled);
    expect(next?.method).toBe("membership");
    const { booking: paid } = await bookSession(h.db, { userId: u.id, sessionId: later.id, method: "membership", entitlementId: next!.entitlementId }, at);
    const surcharge = async (id: string) => (await h.db.select().from(bookings).where(eq(bookings.id, id)))[0].surcharge;
    expect(await surcharge(booking.id)).toBe(0);
    expect(await surcharge(paid.id)).toBe(25000);
  });
});

describe("board post and the next pop-up", () => {
  it("the post is pinned and ends with buttons to the price list and to booking", async () => {
    const [post] = await h.db.select().from(announcements).where(eq(announcements.id, "ec9596c8-12e0-4cf2-97ff-d54610740a2d"));
    expect(post).toMatchObject({ isPinned: true, isPublished: true });
    expect(post.body).toContain("Fitness Ježíšek");
    expect(post.body).toContain("Program Dovolená");
    const html = withButtons(post.body);
    expect(html).toContain('<a class="cta" href="/cenik?rok=2027">');
    expect(html).toContain('<a class="cta" href="/rozvrh">');
    // a link inside a sentence stays a link
    expect(withButtons('<p>Viz <a href="/x">ceník</a>.</p>')).not.toContain("cta");
  });

  it("the pop-up switches to the planned one on Saturday 31. 10. and leads to the post", async () => {
    const rows = await h.db.select().from(content).where(sql`${content.key} like 'popupNext.%'`);
    const next = Object.fromEntries(rows.map((r) => [r.key.slice("popupNext.".length), r.value]));
    expect(next.buttonUrl).toBe("/nastenka#ec9596c8-12e0-4cf2-97ff-d54610740a2d");
    expect(popupSlot({ title: next.title, from: next.from }, "2026-10-30")).toBe("popup");
    expect(popupSlot({ title: next.title, from: next.from }, "2026-10-31")).toBe("popupNext");
    expect(popupSlot({ title: "", from: next.from }, "2026-11-01")).toBe("popup");
    expect(popupOver(next.until, "2026-12-31")).toBe(false);
    expect(popupOver(next.until, "2027-01-01")).toBe(true);
  });
});

describe("terms", () => {
  it("migration 0119 adds Program Dovolená and the gift to saved terms – markdown or HTML – once", async () => {
    const parts = readFileSync(MIGRATION, "utf8").split("--> statement-breakpoint").slice(-2);
    const run = async () => {
      for (const s of parts) await h.db.execute(sql.raw(s));
    };
    const terms = async () => (await h.db.select().from(content).where(eq(content.key, "terms.body")))[0].value;
    await h.db.insert(content).values({ key: "terms.body", value: "## 4. Členství\n- Členství v účtu klienta spravuje studio.\n\n## 5. Platby\nKartou." });
    await run();
    await run();
    expect(await terms()).toMatch(/spravuje studio\.\n- Program Dovolená \(od 1\. 1\. 2027\)[^\n]*\n- Dárek za včasnou rezervaci[^\n]*\n\n## 5\. Platby/);
    expect((await terms()).match(/Program Dovolená/g)).toHaveLength(1);

    await h.db.update(content).set({ value: "<h2>4. Členství</h2><ul><li>Spravuje studio.</li></ul><h2>5. Platby</h2><p>Kartou.</p>" }).where(eq(content.key, "terms.body"));
    await run();
    await run();
    expect(await terms()).toMatch(/<\/ul><ul><li>Program Dovolená[^<]*<\/li><li>Dárek za včasnou rezervaci[^<]*<\/li><\/ul><h2>5\. Platby<\/h2>/);
    expect((await terms()).match(/Program Dovolená/g)).toHaveLength(1);
  });
});

describe("price list cards", () => {
  it("a membership with commitment shows Program Dovolená and, until the end of 2026, the gift", () => {
    const m = { kind: "membership" as const, commitmentMonths: 12, includedPerMonth: 0 };
    expect(memberRewardNotes(m, NOW)).toEqual([
      "🎁 Dárek za rezervaci do 31. 12. 2026: 4× Reformer v roce 2027 bez doplatku",
      "🏖️ Program Dovolená (od 1. 1. 2027): 2× ročně týden pryč – ten týden nezaplatíš",
    ]);
    expect(memberRewardNotes({ ...m, includedPerMonth: 8 }, NOW)).toHaveLength(1); // Členství Reformer: no gift
    expect(memberRewardNotes({ ...m, commitmentMonths: 0 }, NOW)).toEqual([]);
    expect(memberRewardNotes({ ...m, kind: "pass" }, NOW)).toEqual([]);
    expect(memberRewardNotes(m, JAN)).toEqual(["🏖️ Program Dovolená: 2× ročně týden pryč – ten týden nezaplatíš"]);
  });
});
