import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classTypes, entitlements } from "@/db/schema";
import { bookSession, bookingOptions, cancelBooking, includedSummary, membershipIncluding, priorityWindow, viewerWindows, windowOf } from "@/domain/booking";
import { grantEntitlement } from "@/domain/users";
import { pragueLocalToDate } from "@/lib/dates";
import { duoSaves, passOn, priceOn, sessionPriceOn, typeOn } from "@/lib/price-list";
import { getSettings, saveSettings } from "@/lib/settings";
import { NOW, makeProduct, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

/**
 * A Reformer-like group class (6 places, members pay 120 Kč) and a class for two
 * (2 places, members pay 240 Kč, 2 entries from a pass) that counts as it, as two of its lessons – sessions at the given Prague times.
 */
async function reformerAndDuo(times: { group: string[]; duo: string[] }) {
  const group = [await makeSession(h.db, { capacity: 6, startsAt: pragueLocalToDate(times.group[0]) })];
  const groupId = group[0].classTypeId;
  await h.db.update(classTypes).set({ name: "Reformer fusion", memberSurcharge: 12000 }).where(eq(classTypes.id, groupId));
  for (const t of times.group.slice(1)) group.push(await makeSession(h.db, { classTypeId: groupId, capacity: 6, startsAt: pragueLocalToDate(t) }));

  const duo = [await makeSession(h.db, { capacity: 2, dropInPrice: 49000, startsAt: pragueLocalToDate(times.duo[0]) })];
  const duoId = duo[0].classTypeId;
  await h.db.update(classTypes).set({ name: "Reformer fusion ve dvou", memberSurcharge: 24000, passEntries: 2, countsAsTypeId: groupId, countsAsLessons: 2 }).where(eq(classTypes.id, duoId));
  for (const t of times.duo.slice(1)) duo.push(await makeSession(h.db, { classTypeId: duoId, capacity: 2, dropInPrice: 49000, startsAt: pragueLocalToDate(t) }));
  return { group, duo, groupId, duoId };
}
const surcharges = async (ids: string[]) => {
  const rows = await h.db.select().from(bookings).where(inArray(bookings.id, ids));
  return ids.map((id) => rows.find((b) => b.id === id)!.surcharge);
};

describe("a class's next price list", () => {
  const t = {
    dropInPrice: 49000, creditCost: 400, dropInPriceNext: 39000, creditCostNext: 340, memberSurchargeNextFrom: "2027-01-01",
    passEntries: 2, passSurcharge: null, passEntriesNext: 1, passSurchargeNext: 10000,
  };

  it("switches the drop-in price and the credit cost on its first day", () => {
    expect(priceOn(t, "2026-12-31")).toEqual({ dropInPrice: 49000, creditCost: 400 });
    expect(priceOn(t, "2027-01-01")).toEqual({ dropInPrice: 39000, creditCost: 340 });
    expect(typeOn({ ...t, name: "Reformer fusion" }, "2027-03-10")).toMatchObject({ name: "Reformer fusion", dropInPrice: 39000, creditCost: 340, passEntries: 1, passSurcharge: 10000 });
  });

  it("switches what a pass takes – 2 entries until then, 1 entry and 100 Kč from then", () => {
    expect(passOn(t, "2026-12-31")).toEqual({ passEntries: 2, passSurcharge: null });
    expect(passOn(t, "2027-01-01")).toEqual({ passEntries: 1, passSurcharge: 10000 });
    // 0 = the surcharge ends; empty = no change
    expect(passOn({ ...t, passSurcharge: 5000, passSurchargeNext: 0 }, "2027-01-01")).toEqual({ passEntries: 1, passSurcharge: null });
    expect(passOn({ ...t, passSurcharge: 5000, passSurchargeNext: null, passEntriesNext: null }, "2027-01-01")).toEqual({ passEntries: 2, passSurcharge: 5000 });
  });

  it("changes only what is set, and nothing without a date", () => {
    expect(priceOn({ ...t, creditCostNext: null }, "2027-01-01")).toEqual({ dropInPrice: 39000, creditCost: 400 });
    expect(priceOn({ ...t, dropInPriceNext: null }, "2027-01-01")).toEqual({ dropInPrice: 49000, creditCost: 340 });
    expect(priceOn({ ...t, memberSurchargeNextFrom: null }, "2027-06-01")).toEqual({ dropInPrice: 49000, creditCost: 400 });
  });

  it("prices a new session by its day when the price was left as the class has it", () => {
    // added in December: a January Reformer gets the January price, a December one today's
    expect(sessionPriceOn(t, { creditCost: 400, dropInPrice: 49000 }, "2027-01-04", "2026-12-10")).toEqual({ creditCost: 340, dropInPrice: 39000 });
    expect(sessionPriceOn(t, { creditCost: 400, dropInPrice: 49000 }, "2026-12-28", "2026-12-10")).toEqual({ creditCost: 400, dropInPrice: 49000 });
    // a price typed in by hand stays, and so does a free class (no drop-in price)
    expect(sessionPriceOn(t, { creditCost: 430, dropInPrice: 55000 }, "2027-01-04", "2026-12-10")).toEqual({ creditCost: 430, dropInPrice: 55000 });
    expect(sessionPriceOn(t, { creditCost: 400, dropInPrice: null }, "2027-01-04", "2026-12-10")).toEqual({ creditCost: 340, dropInPrice: null });
    // once the new price list runs, nothing is left to switch
    expect(sessionPriceOn(t, { creditCost: 340, dropInPrice: 39000 }, "2027-02-01", "2027-01-15")).toEqual({ creditCost: 340, dropInPrice: 39000 });
  });

  it("offers the price for two only while it saves money", () => {
    expect(duoSaves({ duoPrice: 80000, dropInPrice: 49000 })).toBe(true);
    // from January two entries cost 780 Kč – „800 Kč za obě“ would be more
    expect(duoSaves({ duoPrice: 80000, dropInPrice: 39000 })).toBe(false);
    expect(duoSaves({ duoPrice: 78000, dropInPrice: 39000 })).toBe(false);
    expect(duoSaves({ duoPrice: null, dropInPrice: 39000 })).toBe(false);
    expect(duoSaves({ duoPrice: 80000, dropInPrice: null })).toBe(false);
  });
});

describe("a class that counts as another one (Reformer ve dvou → Reformer fusion)", () => {
  it("opens as early as the lesson it counts as for a membership with it included", async () => {
    const cfg = await getSettings(h.db);
    // Wednesday 28 Oct: on Monday 5 Oct members can't book it yet, the Reformer membership can – the class for two as well
    const { duo, groupId } = await reformerAndDuo({ group: ["2026-10-28T17:00"], duo: ["2026-10-28T18:00"] });
    const elsewhere = await makeSession(h.db, { startsAt: pragueLocalToDate("2026-10-28T19:00") });
    const member = await makeUser(h.db);
    const m = await grantEntitlement(h.db, { userId: member.id, kind: "membership", name: "Členství", entries: null, validityDays: 365 }, NOW);
    const reformerMember = await makeUser(h.db);
    const r = await grantEntitlement(h.db, { userId: reformerMember.id, kind: "membership", name: "Členství Reformer", entries: null, validityDays: 365 }, NOW);
    await h.db.update(entitlements).set({ includedClassTypeId: groupId, includedPerMonth: 8 }).where(eq(entitlements.id, r.id));

    expect((await viewerWindows(h.db, cfg, reformerMember.id, NOW)).forSession(duo[0])).toEqual(priorityWindow(cfg));
    expect((await viewerWindows(h.db, cfg, reformerMember.id, NOW)).forSession(elsewhere)).toEqual(windowOf(cfg, true));
    expect((await viewerWindows(h.db, cfg, member.id, NOW)).forSession(duo[0])).toEqual(windowOf(cfg, true));
    await expect(bookSession(h.db, { userId: member.id, sessionId: duo[0].id, method: "membership", entitlementId: m.id }, NOW)).rejects.toThrow("ještě nejsou otevřené");
    const { booking } = await bookSession(h.db, { userId: reformerMember.id, sessionId: duo[0].id, method: "membership", entitlementId: r.id }, NOW);
    expect(await surcharges([booking.id])).toEqual([0]);
  });

  it("shares the lessons included in the membership – a lesson for two takes two, its own surcharge once they're used up", async () => {
    // November classes can be booked already in October
    await saveSettings(h.db, { bookingWindowWeeks: 0, memberBookingWindowWeeks: 0, bookingWindowDays: 90, memberBookingWindowDays: 90 });
    const { group, duo, groupId, duoId } = await reformerAndDuo({ group: ["2026-11-03T17:00", "2026-11-10T17:00"], duo: ["2026-11-02T18:00", "2026-11-09T18:00"] });
    const tier = await makeProduct(h.db, { kind: "membership", name: "Členství Reformer", price: 230000, validityDays: 365, includedClassTypeId: groupId, includedPerMonth: 3 });
    expect(await membershipIncluding(h.db, duoId)).toEqual({ name: "Členství Reformer", perMonth: 3 });

    const u = await makeUser(h.db);
    const e = await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství Reformer", entries: null, validityDays: 365 }, NOW);
    await h.db.update(entitlements).set({ productId: tier.id, includedClassTypeId: groupId, includedPerMonth: 3 }).where(eq(entitlements.id, e.id));
    const opt = (s: (typeof duo)[number]) => bookingOptions(h.db, u.id, s).then((o) => o.find((x) => x.method === "membership")!);
    const book = (s: (typeof duo)[number]) =>
      bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: e.id }, NOW).then((r) => r.booking.id);

    expect((await opt(duo[0])).detail).toBe("neomezeně · v ceně členství (počítá se za 2 lekce), na listopad zbývají 3");
    const first = await book(duo[0]);
    // one left: enough for a group lesson, not for the lesson for two
    expect((await opt(duo[1])).detail).toMatch(/^neomezeně · doplatek 240\sKč \(kartou nebo převodem\), tahle lekce se počítá za 2 lekce v ceně a na listopad zbývá 1$/);
    expect((await opt(group[0])).detail).toBe("neomezeně · v ceně členství, na listopad zbývá 1");
    const second = await book(group[0]);
    const third = await book(duo[1]);
    const fourth = await book(group[1]);
    expect(await surcharges([first, second, third, fourth])).toEqual([0, 0, 24000, 12000]);
    expect((await includedSummary(h.db, [{ ...e, includedClassTypeId: groupId, includedPerMonth: 3 }], pragueLocalToDate("2026-11-01T10:00"))).get(e.id)).toMatchObject({
      className: "Reformer fusion",
      perMonth: 3,
      left: 0,
    });

    // a group lesson cancelled in time frees one: it goes to the next group lesson, the lesson for two needs two
    await cancelBooking(h.db, { bookingId: second, actorId: u.id }, NOW);
    expect(await surcharges([third, fourth])).toEqual([24000, 0]);
    // the lesson for two cancelled in time frees two: now the other lesson for two is in the price too
    await cancelBooking(h.db, { bookingId: first, actorId: u.id }, NOW);
    expect(await surcharges([third, fourth])).toEqual([0, 0]);
  });

  it("takes entries made for the lesson it counts as, not ones for another class", async () => {
    const { duo, groupId } = await reformerAndDuo({ group: ["2026-11-17T17:00"], duo: ["2026-11-16T18:00"] });
    const other = await makeSession(h.db, { startsAt: pragueLocalToDate("2026-11-16T19:00") });
    const u = await makeUser(h.db);
    const gift = await grantEntitlement(h.db, { userId: u.id, kind: "free", name: "Reformer bez doplatku 2027", entries: 4, validityDays: 365, classTypeId: groupId }, NOW);
    const elsewhere = await grantEntitlement(h.db, { userId: u.id, kind: "free", name: "Vstup zdarma – jiná lekce", entries: 1, validityDays: 365, classTypeId: other.classTypeId }, NOW);

    const opts = await bookingOptions(h.db, u.id, duo[0]);
    expect(opts.find((o) => o.entitlementId === gift.id)).toMatchObject({ method: "free" });
    expect(opts.find((o) => o.entitlementId === gift.id)?.disabled).toBeUndefined();
    expect(opts.find((o) => o.entitlementId === elsewhere.id)).toBeUndefined();
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: duo[0].id, method: "free", entitlementId: gift.id }, NOW);
    expect(await surcharges([booking.id])).toEqual([0]);
    // a lesson for two takes two of the four gifted lessons
    expect((await h.db.select().from(entitlements).where(eq(entitlements.id, gift.id)))[0].entriesUsed).toBe(2);
    await expect(bookSession(h.db, { userId: u.id, sessionId: duo[0].id, method: "free", entitlementId: elsewhere.id }, NOW)).rejects.toThrow();
  });
});

describe("a pass by the price list of the session's day", () => {
  it("takes 2 entries on a Reformer in December, 1 entry and 100 Kč in January; 2 entries on a lesson for two", async () => {
    await saveSettings(h.db, { bookingWindowWeeks: 0, memberBookingWindowWeeks: 0, bookingWindowDays: 120, memberBookingWindowDays: 120 });
    const { group, duo, groupId } = await reformerAndDuo({ group: ["2026-12-29T17:00", "2027-01-05T17:00"], duo: ["2027-01-06T17:00"] });
    await h.db.update(classTypes).set({ passEntries: 2, passEntriesNext: 1, passSurchargeNext: 10000, memberSurchargeNextFrom: "2027-01-01", memberSurchargeNext: 12000 }).where(eq(classTypes.id, groupId));
    const u = await makeUser(h.db);
    const pass = await grantEntitlement(h.db, { userId: u.id, kind: "pass", name: "Permanentka 10 vstupů", entries: 10, validityDays: 120 }, NOW);
    const opt = async (s: (typeof group)[number]) => (await bookingOptions(h.db, u.id, s)).find((o) => o.entitlementId === pass.id)!.detail;
    expect(await opt(group[0])).toBe("zbývá 10 z 10 · strhnou se 2 vstupy");
    expect(await opt(group[1])).toMatch(/^zbývá 10 z 10 · doplatek 100\sKč/);
    expect(await opt(duo[0])).toBe("zbývá 10 z 10 · strhnou se 2 vstupy");

    const book = (s: (typeof group)[number]) => bookSession(h.db, { userId: u.id, sessionId: s.id, method: "pass", entitlementId: pass.id }, NOW).then((r) => r.booking.id);
    const ids = [await book(group[0]), await book(group[1]), await book(duo[0])];
    expect(await surcharges(ids)).toEqual([0, 10000, 0]);
    // 2 + 1 + 2
    expect((await h.db.select().from(entitlements).where(eq(entitlements.id, pass.id)))[0].entriesUsed).toBe(5);
  });
});

describe("drop-in for two", () => {
  it("never costs more than two entries on their own", async () => {
    await saveSettings(h.db, { bookingWindowWeeks: 0, memberBookingWindowWeeks: 0, bookingWindowDays: 90, memberBookingWindowDays: 90 });
    // a January Reformer at the new 390 Kč while the class still has „800 Kč za obě“ from the 490 Kč days
    const s = await makeSession(h.db, { capacity: 6, dropInPrice: 39000 });
    await h.db.update(classTypes).set({ duoPrice: 80000 }).where(eq(classTypes.id, s.classTypeId));
    const u = await makeUser(h.db);
    expect((await bookingOptions(h.db, u.id, s, 2)).find((o) => o.method === "drop_in")?.label).toContain("780");
    // a real discount still applies
    await h.db.update(classTypes).set({ duoPrice: 70000 }).where(eq(classTypes.id, s.classTypeId));
    expect((await bookingOptions(h.db, u.id, s, 2)).find((o) => o.method === "drop_in")?.label).toContain("700");
  });
});
