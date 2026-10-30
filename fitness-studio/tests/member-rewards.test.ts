import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { announcements, bookings, classTypes, content, earlyBookings, entitlements, orders, type ClassType } from "@/db/schema";
import { bookSession, bookingOptions } from "@/domain/booking";
import { EARLY_BIRD, earlyBookingList, grantEarlyBirdGift, markSantaGiven } from "@/domain/early-bird";
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
const NOV5 = pragueLocalToDate("2026-11-05T10:00");
const statements = (file: string) => readFileSync(file, "utf8").split("--> statement-breakpoint");
const gifts = async (userId: string) =>
  h.db.select().from(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.name, EARLY_BIRD.name)));
const record = async (userId: string) => (await h.db.select().from(earlyBookings).where(eq(earlyBookings.userId, userId)))[0];
const member = async (over: Partial<typeof entitlements.$inferInsert>) => {
  const u = await makeUser(h.db);
  await h.db.insert(entitlements).values({ userId: u.id, kind: "membership", name: "Členství", validFrom: NOW, validUntil: pragueLocalToDate("2027-10-05T00:00"), createdAt: NOW, ...over });
  return u;
};

describe("dárek za včasnou rezervaci – 4× Reformer bez doplatku na rok 2027", () => {
  it("migration 0121 corrects 0119: only new memberships from 1. 11. 2026 to 1. 1. 2027, Členství Reformer too – recorded with the sign-up", async () => {
    const committed = await makeProduct(h.db, { kind: "membership", name: "Členství 2026", commitmentMonths: 12 });
    const flexible = await makeProduct(h.db, { kind: "membership", name: "Členství bez závazku", commitmentMonths: 0 });
    const presale = await member({ productId: committed.id, validFrom: JAN, validUntil: pragueLocalToDate("2028-01-01T00:00") }); // reserved in October
    const november = await member({ productId: committed.id, validFrom: NOV5, validUntil: pragueLocalToDate("2027-11-05T00:00"), createdAt: NOV5 });
    const december = await member({ validFrom: pragueLocalToDate("2026-12-01T00:00"), createdAt: pragueLocalToDate("2026-12-01T09:00") }); // set up by the studio
    const reformerTier = await member({ productId: committed.id, validFrom: JAN, validUntil: pragueLocalToDate("2028-01-01T00:00"), includedClassTypeId: reformer.id, includedPerMonth: 8 });
    const no = [
      await member({ productId: committed.id }), // a member since October: the membership runs into 2027, but isn't new
      await member({ productId: committed.id, validFrom: pragueLocalToDate("2027-01-05T00:00") }), // January
      await member({ productId: flexible.id, validFrom: NOV5 }),
      await member({ productId: committed.id, validFrom: NOV5, status: "cancelled" }),
    ];
    // 0119 as it ran first (the gift for every member on 1. 1. 2027), then 0121
    await h.db.execute(sql.raw(statements("drizzle/0119_member_rewards_2027.sql")[0]));
    expect(await gifts(no[0].id)).toHaveLength(1);
    const fix = statements("drizzle/0121_early_bookings.sql").slice(-6);
    for (const s of [...fix, ...fix]) await h.db.execute(sql.raw(s)); // safe to repeat
    for (const u of [presale, november, december, reformerTier]) {
      const g = await gifts(u.id);
      expect(g).toHaveLength(1);
      expect(g[0]).toMatchObject({ kind: "free", entriesTotal: 4, entriesUsed: 0, classTypeId: reformer.id, validFrom: JAN, validUntil: EARLY_BIRD.until });
      expect(await record(u.id)).toMatchObject({ giftId: g[0].id, santaGivenAt: null });
    }
    for (const u of no) {
      expect(await gifts(u.id)).toEqual([]);
      expect(await record(u.id)).toBeUndefined();
    }
    // signed up by 30. 11. → Fitness Ježíšek
    expect((await record(presale.id)).signedUpAt).toEqual(NOW);
    expect((await record(november.id)).signedUpAt).toEqual(NOV5);
    const list = await earlyBookingList(h.db);
    const santa = (id: string) => list.find((r) => r.b.userId === id)?.santa;
    expect([santa(presale.id), santa(november.id), santa(reformerTier.id), santa(december.id)]).toEqual([true, true, true, false]);
    // the code agrees with the migration: nobody left
    expect(await grantEarlyBirdGift(h.db)).toBe(0);

    // the studio ticks off Fitness Ježíšek's gift
    const row = list.find((r) => r.b.userId === november.id)!;
    await markSantaGiven(h.db, row.b.id, true, NOV5);
    expect((await record(november.id)).santaGivenAt).toEqual(NOV5);
    await markSantaGiven(h.db, row.b.id, false);
    expect((await record(november.id)).santaGivenAt).toBeNull();
  });

  it("buying a membership for 2027 in December gives it right away (no Ježíšek then); in January not any more", async () => {
    const y2027 = await makeProduct(h.db, { kind: "membership", name: "Členství 2027", price: 140000, commitmentMonths: 12, validityDays: 365, saleFrom: JAN, presaleFrom: NOW });
    const buy = async (at: Date) => {
      const u = await makeUser(h.db);
      const { order } = await createProductOrder(h.db, { userId: u.id, productId: y2027.id, commitmentAccepted: true }, at);
      await h.db.update(orders).set({ createdAt: at }).where(eq(orders.id, order.id));
      await fulfillOrder(h.db, { orderId: order.id, provider: "transfer" }, at);
      return u;
    };
    const december = await buy(pragueLocalToDate("2026-12-10T10:00"));
    expect(await gifts(december.id)).toHaveLength(1);
    expect(await record(december.id)).toMatchObject({ signedUpAt: pragueLocalToDate("2026-12-10T10:00") });
    const january = await buy(pragueLocalToDate("2027-01-05T10:00"));
    expect(await gifts(january.id)).toEqual([]);
    expect(await record(january.id)).toBeUndefined();
  });

  it("is offered first when booking Reformer – no surcharge; used up, the membership pays the surcharge again", async () => {
    const u = await member({ validFrom: NOV5 });
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
    // 0124: written plainly
    expect(post.title).toBe("🎁 Členství 2027: dárky za včasné přihlášení a novinka – zmražení členství");
    for (const text of [
      "Fitness Ježíšek s dárkem",
      "sjedná nové členství se závazkem na rok 2027, dostane 4 lekce Reformer fusion bez doplatku",
      "Platí i pro Členství Reformer – k 8 lekcím měsíčně máš 4 navíc. Klidně na ně pozvi kamarádku.",
      "Dárek dostáváš taky – lekce uvidíš v účtu od 1. 1. 2027.",
      "nejdříve od následujícího dne",
      "Je-li platba za daný měsíc už uhrazena, sleva se odečte z následujícího měsíce.",
    ])
      expect(post.body).toContain(text);
    expect(post.body).not.toContain("Program Dovolená");
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
    expect(next.text).toContain("dvakrát ročně si můžeš zmrazit členství na týden");
    expect(popupSlot({ title: next.title, from: next.from }, "2026-10-30")).toBe("popup");
    expect(popupSlot({ title: next.title, from: next.from }, "2026-10-31")).toBe("popupNext");
    expect(popupSlot({ title: "", from: next.from }, "2026-11-01")).toBe("popup");
    expect(popupOver(next.until, "2026-12-31")).toBe(false);
    expect(popupOver(next.until, "2027-01-01")).toBe(true);
  });
});

describe("terms", () => {
  it("0119 adds the two points to saved terms – markdown or HTML – once, 0121 rewrites them", async () => {
    const add = readFileSync("drizzle/0119_member_rewards_2027.sql", "utf8").split("--> statement-breakpoint").slice(-2);
    const fix = statements("drizzle/0121_early_bookings.sql").slice(-1);
    const run = async (parts: string[]) => {
      for (const s of parts) await h.db.execute(sql.raw(s));
    };
    const terms = async () => (await h.db.select().from(content).where(eq(content.key, "terms.body")))[0].value;
    await h.db.insert(content).values({ key: "terms.body", value: "## 4. Členství\n- Členství v účtu klienta spravuje studio.\n\n## 5. Platby\nKartou." });
    await run(add);
    await run(add);
    expect(await terms()).toMatch(/spravuje studio\.\n- Program Dovolená \(od 1\. 1\. 2027\)[^\n]*\n- Dárek za včasnou rezervaci[^\n]*\n\n## 5\. Platby/);
    await run(fix);
    await run(fix);
    expect(await terms()).toMatch(/spravuje studio\.\n- Zmražení členství \(od 1\. 1\. 2027\)[^\n]*nejdříve od následujícího dne[^\n]*\n- Dárek za včasnou rezervaci: kdo si sjedná nové členství[^\n]*Fitness Ježíška[^\n]*\n\n## 5\. Platby/);
    expect(await terms()).not.toContain("Program Dovolená");

    await h.db.update(content).set({ value: "<h2>4. Členství</h2><ul><li>Spravuje studio.</li></ul><h2>5. Platby</h2><p>Kartou.</p>" }).where(eq(content.key, "terms.body"));
    await run(add);
    await run(add);
    await run(fix);
    expect(await terms()).toMatch(/<\/ul><ul><li>Zmražení členství[^<]*<\/li><li>Dárek za včasnou rezervaci: kdo si sjedná nové členství[^<]*<\/li><\/ul><h2>5\. Platby<\/h2>/);
    expect((await terms()).match(/Zmražení členství \(od/g)).toHaveLength(1);
  });
});

describe("price list cards", () => {
  it("a membership with commitment starting in time shows Fitness Ježíšek and the gift; every one shows Zmražení členství", () => {
    const m = { kind: "membership" as const, commitmentMonths: 12, saleFrom: null };
    const freeze = "❄️ Zmražení členství (od 1. 1. 2027): 2× ročně týden zdarma – dovolená, nemoc…";
    // bought on 5 October it starts then – not new for 2027; in presale it starts 1. 1. 2027
    expect(memberRewardNotes(m, NOW)).toEqual([freeze]);
    expect(memberRewardNotes({ ...m, saleFrom: JAN }, NOW)).toEqual([
      "🎅 Přihlas se do 30. 11. a v prosinci tě navštíví Fitness Ježíšek s dárkem",
      "🎁 Dárek za včasnou rezervaci: 4× Reformer v roce 2027 bez doplatku",
      freeze,
    ]);
    expect(memberRewardNotes(m, pragueLocalToDate("2026-12-02T10:00"))).toEqual([
      "🎁 Dárek za včasnou rezervaci: 4× Reformer v roce 2027 bez doplatku",
      freeze,
    ]);
    expect(memberRewardNotes({ ...m, commitmentMonths: 0 }, NOW)).toEqual([]);
    expect(memberRewardNotes({ ...m, kind: "pass" }, NOW)).toEqual([]);
    expect(memberRewardNotes(m, JAN)).toEqual(["❄️ Zmražení členství: 2× ročně týden zdarma – dovolená, nemoc…"]);
  });
});

describe("Barre Brunch pop-up", () => {
  it("migration 0122: ends tonight – the membership 2027 one follows from Saturday", async () => {
    await h.db.insert(content).values([{ key: "popup.title", value: "🥐 Barre + Brunch už tuto sobotu 31. 10." }, { key: "popup.until", value: "2026-10-31" }]).onConflictDoNothing();
    await h.db.execute(sql.raw(readFileSync("drizzle/0122_brunch_popup_ends_tonight.sql", "utf8")));
    const until = (await h.db.select().from(content).where(eq(content.key, "popup.until")))[0].value;
    expect(until).toBe("2026-10-30");
    expect(popupOver(until, "2026-10-30")).toBe(false);
    expect(popupOver(until, "2026-10-31")).toBe(true);
    expect(popupSlot({ title: "🎁 Dárky pro členy na rok 2027", from: "2026-10-31" }, "2026-10-31")).toBe("popupNext");
  });
});
