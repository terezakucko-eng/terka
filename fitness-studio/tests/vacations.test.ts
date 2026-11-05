import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, entitlements, orders, users } from "@/db/schema";
import { bookSession, joinWaitlist } from "@/domain/booking";
import { createMonthlyFees, feeOverview } from "@/domain/membership-fees";
import { cancelVacation, firstVacationDay, planVacation, vacationEligible, vacationsLeft, vacationsOf } from "@/domain/vacations";
import { pragueLocalToDate } from "@/lib/dates";
import { saveSettings } from "@/lib/settings";
import { daysByMonth, daysShare, vacationLabel } from "@/lib/vacation";
import { makeProduct, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
  await saveSettings(h.db, { membershipMonthlyFee: 1400 });
});
afterAll(async () => h.close());

const at = (s: string) => pragueLocalToDate(s);
const JAN20 = at("2027-01-20T10:00");
/** A member with commitment from October 2026 to the end of 2027, paying the default 1 400 Kč a month. */
const member = async (over: Partial<typeof entitlements.$inferInsert> = {}) => {
  const u = await makeUser(h.db);
  const [e] = await h.db
    .insert(entitlements)
    .values({ userId: u.id, kind: "membership", name: "Členství", validFrom: at("2026-10-01T00:00"), validUntil: at("2028-01-01T00:00"), ...over })
    .returning();
  return { u, e };
};
const fee = async (userId: string, period: string) =>
  h.db.select().from(orders).where(and(eq(orders.userId, userId), eq(orders.kind, "membership_fee"), eq(orders.period, period)));

describe("Zmražení členství – the rules", () => {
  it("labels and shares by days", () => {
    expect(vacationLabel("2027-02-08", "2027-02-14")).toBe("8.–14. 2. 2027");
    expect(vacationLabel("2027-03-29", "2027-04-04")).toBe("29. 3. – 4. 4. 2027");
    expect(vacationLabel("2027-12-28", "2028-01-03")).toBe("28. 12. 2027 – 3. 1. 2028");
    expect(daysByMonth("2027-03-29", "2027-04-04")).toEqual([{ period: "2027-03", days: 3, of: 31 }, { period: "2027-04", days: 4, of: 30 }]);
    expect(daysShare(140000, 7, 31)).toBe(31600);
    expect(daysShare(140000, 7, 28)).toBe(35000);
    expect(daysShare(250000, 7, 30)).toBe(58300);
    expect(firstVacationDay(at("2026-12-01T10:00"))).toBe("2027-01-01");
    expect(firstVacationDay(JAN20)).toBe("2027-01-21"); // from tomorrow – illness can't wait
  });

  it("from 2027, from tomorrow, for members with commitment, twice a year – the studio may do more", async () => {
    const { u } = await member();
    expect(await vacationEligible(h.db, u.id, at("2026-11-01T10:00"))).toBe(true);
    await expect(planVacation(h.db, { userId: u.id, startsOn: "2026-12-20" }, at("2026-11-01T10:00"))).rejects.toThrow("od 1. 1. 2027");
    await expect(planVacation(h.db, { userId: u.id, startsOn: "2027-01-20" }, JAN20)).rejects.toThrow("nejdřív od 21. 1. 2027");
    await planVacation(h.db, { userId: u.id, startsOn: "2027-02-08" }, JAN20);
    await expect(planVacation(h.db, { userId: u.id, startsOn: "2027-02-12" }, JAN20)).rejects.toThrow("už máš členství zmražené");
    await planVacation(h.db, { userId: u.id, startsOn: "2027-07-10" }, JAN20);
    await expect(planVacation(h.db, { userId: u.id, startsOn: "2027-08-10" }, JAN20)).rejects.toThrow("už máš 2 zmražení");
    // the studio may add a third one, even at short notice
    await expect(planVacation(h.db, { userId: u.id, startsOn: "2028-01-10" }, JAN20)).rejects.toThrow("platné členství"); // the membership ends
    await planVacation(h.db, { userId: u.id, startsOn: "2027-01-20", byStudio: true }, JAN20); // even today
    const list = await vacationsOf(h.db, u.id);
    expect(list.map((v) => v.label)).toEqual(["20.–26. 1. 2027", "8.–14. 2. 2027", "10.–16. 7. 2027"]);
    expect(vacationsLeft(list, "2027")).toBe(0);

    const flexible = await makeProduct(h.db, { kind: "membership", name: "Bez závazku", commitmentMonths: 0 });
    const { u: flex } = await member({ productId: flexible.id });
    expect(await vacationEligible(h.db, flex.id, JAN20)).toBe(false);
    await expect(planVacation(h.db, { userId: flex.id, startsOn: "2027-02-08" }, JAN20)).rejects.toThrow("člen se závazkem");
    const nobody = await makeUser(h.db);
    await expect(planVacation(h.db, { userId: nobody.id, startsOn: "2027-02-08" }, JAN20)).rejects.toThrow("člen se závazkem");
  });
});

describe("Zmražení členství – the fee", () => {
  it("no request yet: the month's request comes lower, by the week's share", async () => {
    const { u } = await member();
    const r = await planVacation(h.db, { userId: u.id, startsOn: "2027-02-08" }, JAN20);
    expect(r.discount).toBe(35000); // 1 400 Kč × 7 / 28
    await createMonthlyFees(h.db, { period: "2027-02", amountKc: 1400, userIds: [u.id] });
    const [o] = await fee(u.id, "2027-02");
    expect(o.amount).toBe(105000);
    expect(o.description.replace(/\u00a0/g, " ")).toBe("Členský příspěvek – únor 2027 · zmražení 8.–14. 2. 2027 −350 Kč");
    // the next month is a full one
    await createMonthlyFees(h.db, { period: "2027-03", amountKc: 1400, userIds: [u.id] });
    expect((await fee(u.id, "2027-03"))[0].amount).toBe(140000);
  });

  it("a week across two months lowers both by their days; Členství Reformer by its own fee", async () => {
    const { u } = await member({ monthlyFee: 250000 });
    const r = await planVacation(h.db, { userId: u.id, startsOn: "2027-03-29" }, JAN20);
    expect(r.discounts.map((d) => [d.period, d.days, d.amount])).toEqual([["2027-03", 3, 24200], ["2027-04", 4, 33300]]);
    await createMonthlyFees(h.db, { period: "2027-03", amountKc: 1400, userIds: [u.id] });
    await createMonthlyFees(h.db, { period: "2027-04", amountKc: 1400, userIds: [u.id] });
    expect((await fee(u.id, "2027-03"))[0].amount).toBe(250000 - 24200);
    expect((await fee(u.id, "2027-04"))[0].amount).toBe(250000 - 33300);
  });

  it("a request waiting for payment is lowered right away – and back up when the vacation is called off", async () => {
    const { u } = await member();
    await createMonthlyFees(h.db, { period: "2027-02", amountKc: 1400, userIds: [u.id] });
    const r = await planVacation(h.db, { userId: u.id, startsOn: "2027-02-08" }, JAN20);
    const [o] = await fee(u.id, "2027-02");
    expect(o).toMatchObject({ amount: 105000, status: "pending" });
    expect((await feeOverview(h.db, "2027-02")).rows.find((x) => x.userId === u.id)).toMatchObject({ status: "pending", amount: 105000 });

    await cancelVacation(h.db, { vacationId: r.vacation.id, userId: u.id }, JAN20);
    const [back] = await fee(u.id, "2027-02");
    expect(back).toMatchObject({ amount: 140000, description: "Členský příspěvek – únor 2027" });
    expect(await vacationsOf(h.db, u.id)).toEqual([]);
  });

  it("the month paid already: the next one is lower; called off after paying that, a top-up comes", async () => {
    const { u } = await member();
    await h.db.insert(orders).values({ userId: u.id, kind: "membership_fee", period: "2027-02", description: "únor", amount: 140000, provider: "transfer", status: "paid", paidAt: JAN20 });
    const r = await planVacation(h.db, { userId: u.id, startsOn: "2027-02-08" }, JAN20);
    expect(r.discounts.map((d) => [d.period, d.feePeriod, d.amount])).toEqual([["2027-02", "2027-03", 35000]]);
    await createMonthlyFees(h.db, { period: "2027-03", amountKc: 1400, userIds: [u.id] });
    const [march] = await fee(u.id, "2027-03");
    expect(march.amount).toBe(105000);
    await h.db.update(orders).set({ status: "paid", paidAt: JAN20 }).where(eq(orders.id, march.id));

    await expect(cancelVacation(h.db, { vacationId: r.vacation.id, userId: u.id }, at("2027-02-08T09:00"))).rejects.toThrow("už začalo");
    const { topUp } = await cancelVacation(h.db, { vacationId: r.vacation.id, userId: u.id }, at("2027-02-01T09:00"));
    expect(topUp).toBe(35000);
    const pending = (await fee(u.id, "2027-03")).find((o) => o.status === "pending")!;
    expect(pending).toMatchObject({ amount: 35000 });
    expect(pending.description).toContain("Doplatek členského příspěvku – březen 2027 (zrušené zmražení 8.–14. 2. 2027)");
  });

  it("someone else's vacation can't be called off by the client", async () => {
    const { u } = await member();
    const { u: other } = await member();
    const r = await planVacation(h.db, { userId: u.id, startsOn: "2027-05-03" }, JAN20);
    await expect(cancelVacation(h.db, { vacationId: r.vacation.id, userId: other.id }, JAN20)).rejects.toThrow("nenalezeno");
    await cancelVacation(h.db, { vacationId: r.vacation.id, byStudio: true }, at("2027-05-04T09:00")); // the studio may even once it started
  });
});

describe("Zmražení členství – no classes that week", () => {
  it("cancels the week's bookings with the entry back, and won't book or queue then", async () => {
    const { u, e } = await member();
    const now = at("2027-02-01T10:00");
    const s = await makeSession(h.db, { startsAt: at("2027-02-10T17:00"), capacity: 5 });
    const outside = await makeSession(h.db, { startsAt: at("2027-02-15T17:00"), capacity: 5 });
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: e.id }, now);
    const { booking: kept } = await bookSession(h.db, { userId: u.id, sessionId: outside.id, method: "membership", entitlementId: e.id }, now);

    const r = await planVacation(h.db, { userId: u.id, startsOn: "2027-02-08" }, now);
    expect(r.cancelled.map((b) => b.id)).toEqual([booking.id]);
    const status = async (id: string) => (await h.db.select().from(bookings).where(eq(bookings.id, id)))[0].status;
    expect(await status(booking.id)).toBe("cancelled");
    expect(await status(kept.id)).toBe("confirmed");

    await expect(bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: e.id }, now)).rejects.toThrow("zmražené členství (8.–14. 2. 2027)");
    const full = await makeSession(h.db, { startsAt: at("2027-02-11T17:00"), capacity: 1 });
    const other = await makeUser(h.db, 1000);
    await bookSession(h.db, { userId: other.id, sessionId: full.id, method: "credits" }, now);
    await expect(joinWaitlist(h.db, { userId: u.id, sessionId: full.id }, now)).rejects.toThrow("zmražené členství");

    // plans changed: called off, she can book again
    await cancelVacation(h.db, { vacationId: r.vacation.id, userId: u.id }, now);
    await expect(bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: e.id }, now)).resolves.toBeTruthy();
  });

  it("ill from tomorrow: frozen at short notice, a class paid by credit inside the cancellation window comes back too", async () => {
    const { u } = await member();
    await h.db.update(users).set({ creditBalance: 500 }).where(eq(users.id, u.id));
    const now = at("2027-03-01T18:00");
    const s = await makeSession(h.db, { startsAt: at("2027-03-02T09:00"), capacity: 5, creditCost: 250 });
    await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "credits" }, now);
    const balance = async () => (await h.db.select().from(users).where(eq(users.id, u.id)))[0].creditBalance;
    expect(await balance()).toBe(250);
    const r = await planVacation(h.db, { userId: u.id, startsOn: "2027-03-02" }, now);
    expect(r.cancelled).toHaveLength(1);
    expect(await balance()).toBe(500);
  });
});
