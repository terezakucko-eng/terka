import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classTypes, entitlements, orders, products, type Product } from "@/db/schema";
import { bookSession, cancelBooking, joinWaitlist, priorityWindow, viewerWindows, windowOf } from "@/domain/booking";
import { createMonthlyFees, feeOverview, followMonthlyFee, membershipUpgrades, switchMembership, switchPeriod, switchableTo } from "@/domain/membership-fees";
import { createProductOrder, fulfillOrder } from "@/domain/orders";
import { grantEntitlement } from "@/domain/users";
import { pragueLocalToDate } from "@/lib/dates";
import { inPresale, onSale, priceListYears, productsForYear, saleStartsLater, surchargeOn, surchargeSteps, yearStart } from "@/lib/price-list";
import { getSettings } from "@/lib/settings";
import { NOW, makeProduct, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const JAN = pragueLocalToDate("2027-01-01T00:00");
const p = (over: Partial<Product>) => ({ isActive: true, saleFrom: null, saleUntil: null, ...over }) as Product;

describe("price lists by year", () => {
  it("sells a product only within its dates and shows next year's list once it's set", () => {
    const y2026 = p({ name: "Členství 2026", saleUntil: JAN });
    const y2027 = p({ name: "Členství 2027", saleFrom: JAN });
    const always = p({ name: "Permanentka 10" });
    expect([onSale(y2026, NOW), onSale(y2027, NOW), onSale(always, NOW)]).toEqual([true, false, true]);
    expect([onSale(y2026, JAN), onSale(y2027, JAN)]).toEqual([false, true]);

    expect(priceListYears([always], [], NOW)).toEqual([2026]);
    expect(priceListYears([always, y2027], [], NOW)).toEqual([2026, 2027]);
    expect(priceListYears([always], [{ memberSurchargeNextFrom: "2027-01-01" }], NOW)).toEqual([2026, 2027]);
    expect(productsForYear([y2026, y2027, always], 2026, NOW).map((x) => x.name)).toEqual(["Členství 2026", "Permanentka 10"]);
    expect(productsForYear([y2026, y2027, always], 2027, NOW).map((x) => x.name)).toEqual(["Členství 2027", "Permanentka 10"]);
    // from 1 January the 2027 list is the current one
    expect(priceListYears([y2026, y2027, always], [], JAN)).toEqual([2027]);
    expect(productsForYear([y2026, y2027, always], 2027, JAN).map((x) => x.name)).toEqual(["Členství 2027", "Permanentka 10"]);
  });

  it("members' surcharge: introductory 2026 price, the 2027 one from 1 January", () => {
    const reformer = { memberSurcharge: 10000, memberSurchargeFrom: "2026-11-01", memberSurchargeNext: 25000, memberSurchargeNextFrom: "2027-01-01" };
    expect([surchargeOn(reformer, "2026-10-20"), surchargeOn(reformer, "2026-11-02"), surchargeOn(reformer, "2027-01-05")]).toEqual([0, 10000, 25000]);
    expect(surchargeSteps(reformer, NOW, JAN)).toEqual([{ amount: 10000, from: "2026-11-01" }]);
    expect(surchargeSteps(reformer, JAN, yearStart(2028))).toEqual([{ amount: 25000, from: null }]);
  });

  it("won't sell next year's product before it starts, nor last year's after it ended", async () => {
    const u = await makeUser(h.db);
    const next = await makeProduct(h.db, { kind: "pass", entries: 10, saleFrom: JAN });
    const old = await makeProduct(h.db, { kind: "pass", entries: 10, saleUntil: NOW });
    await expect(createProductOrder(h.db, { userId: u.id, productId: next.id }, NOW)).rejects.toThrow("v prodeji od 1. 1. 2027");
    await expect(createProductOrder(h.db, { userId: u.id, productId: old.id }, NOW)).rejects.toThrow("už není v prodeji");
    await expect(createProductOrder(h.db, { userId: u.id, productId: next.id }, JAN)).resolves.toBeTruthy();
  });
});

describe("presale", () => {
  it("Členství 2027 is bought now and starts on 1 January – the purchase pays January", async () => {
    const y2027 = await makeProduct(h.db, { kind: "membership", name: "Členství 2027", price: 140000, validityDays: 365, saleFrom: JAN, presaleFrom: NOW, recurring: true });
    expect([inPresale(y2027, NOW), onSale(y2027, NOW), saleStartsLater(y2027, NOW)]).toEqual([true, true, false]);
    expect(onSale({ ...y2027, presaleFrom: null }, NOW)).toBe(false);
    // still in the 2027 tab only
    expect(productsForYear([y2027], 2026, NOW)).toEqual([]);

    const u = await makeUser(h.db);
    const { order } = await createProductOrder(h.db, { userId: u.id, productId: y2027.id, commitmentAccepted: true }, NOW);
    await fulfillOrder(h.db, { orderId: order.id, provider: "transfer" }, NOW);
    const [e] = await h.db.select().from(entitlements).where(eq(entitlements.userId, u.id));
    expect(e.validFrom).toEqual(JAN);
    expect(e.validUntil).toEqual(new Date(JAN.getTime() + 365 * 86_400_000));
    // not a member before January: no classes this year, no switching yet
    const soon = await makeSession(h.db, { startsAt: pragueLocalToDate("2026-10-07T17:00") });
    await expect(bookSession(h.db, { userId: u.id, sessionId: soon.id, method: "membership", entitlementId: e.id }, NOW)).rejects.toThrow(/Platí až od 1\.\s1\.\s2027/);
    expect(await membershipUpgrades(h.db, [e], NOW)).toEqual(new Map());

    // no fee for December, none for January (paid by the purchase), February as usual
    expect((await createMonthlyFees(h.db, { period: "2026-12", amountKc: 1400, userIds: [u.id] })).length).toBe(0);
    expect((await createMonthlyFees(h.db, { period: "2027-01", amountKc: 1400, userIds: [u.id] })).length).toBe(0);
    const jan = (await feeOverview(h.db, "2027-01")).rows.find((r) => r.userId === u.id);
    expect(jan).toMatchObject({ status: "purchase", amount: 140000 });
    expect((await createMonthlyFees(h.db, { period: "2027-02", amountKc: 1400, userIds: [u.id] })).map((o) => o.amount)).toEqual([140000]);
  });
});

describe("Členství Reformer in presale", () => {
  it("a client without membership buys it now – it starts in January; first come, first served", async () => {
    const s = await makeSession(h.db);
    const tier = await makeProduct(h.db, { kind: "membership", price: 250000, validityDays: 365, includedClassTypeId: s.classTypeId, includedPerMonth: 8, maxActive: 1, saleFrom: JAN, presaleFrom: NOW, sortOrder: -300 });
    const member = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: member.id, kind: "membership", name: "Členství 2026", entries: null, validityDays: 365 }, NOW);
    await expect(createProductOrder(h.db, { userId: member.id, productId: tier.id, commitmentAccepted: true }, NOW)).rejects.toThrow("přejdeš v Můj účet");

    const u = await makeUser(h.db);
    const { order } = await createProductOrder(h.db, { userId: u.id, productId: tier.id, commitmentAccepted: true }, NOW);
    await fulfillOrder(h.db, { orderId: order.id, provider: "transfer" }, NOW);
    const [e] = await h.db.select().from(entitlements).where(eq(entitlements.userId, u.id));
    expect(e).toMatchObject({ validFrom: JAN, monthlyFee: 250000, includedPerMonth: 8 });
    await expect(createProductOrder(h.db, { userId: (await makeUser(h.db)).id, productId: tier.id, commitmentAccepted: true }, NOW)).rejects.toThrow("obsazená");
    await h.db.update(products).set({ isActive: false }).where(eq(products.id, tier.id));
  });

  it("a member who can't switch in Můj účet buys it – a membership ending in December, or one without commitment", async () => {
    const s = await makeSession(h.db);
    const tier = await makeProduct(h.db, { kind: "membership", price: 250000, validityDays: 365, includedClassTypeId: s.classTypeId, includedPerMonth: 8, maxActive: 4, saleFrom: JAN, presaleFrom: NOW, sortOrder: -300 });
    const flexBasic = await makeProduct(h.db, { kind: "membership", price: 160000, validityDays: 3650, commitmentMonths: 0 });

    // ends on 31 December: the new one is her renewal from 1 January
    const ending = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: ending.id, kind: "membership", name: "Členství 2026", entries: null, validityDays: 1, validUntil: JAN }, NOW);
    expect(await switchableTo(h.db, ending.id, NOW)).toEqual(new Set());
    const { order } = await createProductOrder(h.db, { userId: ending.id, productId: tier.id, commitmentAccepted: true }, NOW);
    await fulfillOrder(h.db, { orderId: order.id, provider: "transfer" }, NOW);
    const [renewed] = await h.db.select().from(entitlements).where(and(eq(entitlements.userId, ending.id), eq(entitlements.productId, tier.id)));
    expect(renewed).toMatchObject({ validFrom: JAN, includedPerMonth: 8 });

    // without commitment there's nothing to switch to – she takes the one with commitment
    const flex = await makeUser(h.db);
    const { order: basic } = await createProductOrder(h.db, { userId: flex.id, productId: flexBasic.id, commitmentAccepted: true }, NOW);
    await fulfillOrder(h.db, { orderId: basic.id, provider: "transfer" }, NOW);
    expect(await switchableTo(h.db, flex.id, NOW)).toEqual(new Set());
    await expect(createProductOrder(h.db, { userId: flex.id, productId: tier.id, commitmentAccepted: true }, NOW)).resolves.toMatchObject({ product: { id: tier.id } });

    // a member still with us in January switches in Můj účet
    const staying = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: staying.id, kind: "membership", name: "Členství 2026", entries: null, validityDays: 365 }, NOW);
    expect(await switchableTo(h.db, staying.id, NOW)).toEqual(new Set([tier.id]));
    await expect(createProductOrder(h.db, { userId: staying.id, productId: tier.id, commitmentAccepted: true }, NOW)).rejects.toThrow("přejdeš v Můj účet");
    await h.db.update(products).set({ isActive: false }).where(inArray(products.id, [tier.id, flexBasic.id]));
  });
});

describe("Členství Reformer 2027", () => {
  it("has a limited number of places – buying and switching stop when they're taken", async () => {
    const s = await makeSession(h.db);
    const tier = await makeProduct(h.db, { kind: "membership", price: 250000, validityDays: 365, includedClassTypeId: s.classTypeId, includedPerMonth: 6, maxActive: 2, sortOrder: -100 });
    const basic = await makeProduct(h.db, { kind: "membership", price: 140000, validityDays: 365 });
    const buy = async (productId: string) => {
      const u = await makeUser(h.db);
      const { order } = await createProductOrder(h.db, { userId: u.id, productId, commitmentAccepted: true }, NOW);
      await fulfillOrder(h.db, { orderId: order.id, provider: "test" }, NOW);
      return u;
    };
    await buy(tier.id);
    const member = await buy(basic.id);
    const [e] = await h.db.select().from(entitlements).where(eq(entitlements.userId, member.id));
    expect((await membershipUpgrades(h.db, [e], NOW)).get(e.id)?.id).toBe(tier.id);
    await switchMembership(h.db, member.id, e.id, tier.id, NOW); // the 2nd and last place

    const late = await makeUser(h.db);
    await expect(createProductOrder(h.db, { userId: late.id, productId: tier.id, commitmentAccepted: true }, NOW)).rejects.toThrow("omezený počet členství");
    const other = await buy(basic.id);
    const [e2] = await h.db.select().from(entitlements).where(eq(entitlements.userId, other.id));
    expect(await membershipUpgrades(h.db, [e2], NOW)).toEqual(new Map());
    await expect(switchMembership(h.db, other.id, e2.id, tier.id, NOW)).rejects.toThrow("obsazená");
    await h.db.update(products).set({ isActive: false }).where(eq(products.id, tier.id));
  });

  it("can be booked ahead from 2026 and starts on 1 January", async () => {
    const s = await makeSession(h.db);
    const tier = await makeProduct(h.db, { kind: "membership", price: 250000, validityDays: 365, includedClassTypeId: s.classTypeId, includedPerMonth: 6, saleFrom: JAN, sortOrder: -200 });
    const u = await makeUser(h.db);
    const e = await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství 2026", entries: null, validityDays: 365 }, NOW);
    expect(await switchPeriod(h.db, u.id, NOW, tier)).toBe("2027-01");
    const done = await switchMembership(h.db, u.id, e.id, tier.id, NOW);
    expect(done.period).toBe("2027-01");
    await h.db.update(products).set({ isActive: false }).where(eq(products.id, tier.id));
  });

  it("books its class a week before other members and goes first on the waitlist", async () => {
    const cfg = await getSettings(h.db);
    expect(priorityWindow(cfg)).toEqual({ kind: "weeks", n: windowOf(cfg, true).n + 1 });
    // Wednesday 28 Oct: members (this week + 2) can't book it on Monday 5 Oct yet, the Reformer membership can
    const later = await makeSession(h.db, { capacity: 6, startsAt: pragueLocalToDate("2026-10-28T17:00") });
    const classTypeId = later.classTypeId;
    await h.db.update(classTypes).set({ memberSurcharge: 25000 }).where(eq(classTypes.id, classTypeId));
    const member = await makeUser(h.db);
    const m = await grantEntitlement(h.db, { userId: member.id, kind: "membership", name: "Členství", entries: null, validityDays: 365 }, NOW);
    const reformerMember = await makeUser(h.db);
    const r = await grantEntitlement(h.db, { userId: reformerMember.id, kind: "membership", name: "Členství Reformer", entries: null, validityDays: 365 }, NOW);
    await h.db.update(entitlements).set({ includedClassTypeId: classTypeId, includedPerMonth: 6 }).where(eq(entitlements.id, r.id));

    expect((await viewerWindows(h.db, cfg, reformerMember.id, NOW)).forSession(later)).toEqual(priorityWindow(cfg));
    expect((await viewerWindows(h.db, cfg, member.id, NOW)).forSession(later)).toEqual(windowOf(cfg, true));
    await expect(bookSession(h.db, { userId: member.id, sessionId: later.id, method: "membership", entitlementId: m.id }, NOW)).rejects.toThrow("ještě nejsou otevřené");
    const { booking } = await bookSession(h.db, { userId: reformerMember.id, sessionId: later.id, method: "membership", entitlementId: r.id }, NOW);
    expect(booking.status).toBe("confirmed");

    // a full class this week: the member joined the waitlist first, the Reformer membership still goes first
    const full = await makeSession(h.db, { classTypeId, capacity: 1, startsAt: pragueLocalToDate("2026-10-07T17:00") });
    const holder = await makeUser(h.db, 1000);
    const { booking: held } = await bookSession(h.db, { userId: holder.id, sessionId: full.id, method: "credits" }, NOW);
    await joinWaitlist(h.db, { userId: member.id, sessionId: full.id }, NOW);
    await joinWaitlist(h.db, { userId: reformerMember.id, sessionId: full.id }, NOW);
    const { promoted } = await cancelBooking(h.db, { bookingId: held.id, actorId: holder.id }, NOW);
    expect(promoted.map((b) => b.userId)).toEqual([reformerMember.id]);
    const [mine] = await h.db.select().from(bookings).where(and(eq(bookings.sessionId, full.id), eq(bookings.userId, reformerMember.id)));
    expect(mine).toMatchObject({ status: "confirmed", surcharge: 0 });
  });
});

describe("a member's own monthly fee", () => {
  it("unpaid requests for the coming months follow it, this month and discounted ones stay", async () => {
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 365 }, NOW);
    const fee = (period: string, amount: number) =>
      h.db.insert(orders).values({ userId: u.id, kind: "membership_fee", period, description: period, amount, provider: "transfer" }).returning().then(([o]) => o);
    const [oct, nov, dec, jan] = [await fee("2026-10", 140000), await fee("2026-11", 140000), await fee("2026-12", 140000), await fee("2027-01", 70000)];
    expect(await followMonthlyFee(h.db, u.id, 140000, 100000, NOW)).toEqual(["2026-11", "2026-12"]);
    const amounts = await h.db.select({ id: orders.id, amount: orders.amount }).from(orders).where(eq(orders.userId, u.id));
    expect([oct, nov, dec, jan].map((o) => amounts.find((a) => a.id === o.id)!.amount)).toEqual([140000, 100000, 100000, 70000]);
  });

  it("a special price for a few months: the default one after its last month", async () => {
    const u = await makeUser(h.db);
    const e = await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 365 }, NOW);
    await h.db.update(entitlements).set({ monthlyFee: 100000, monthlyFeeUntil: "2026-12" }).where(eq(entitlements.id, e.id));
    const fee = async (period: string) => (await createMonthlyFees(h.db, { period, amountKc: 1400, userIds: [u.id] }))[0]?.amount;
    expect([await fee("2026-11"), await fee("2026-12"), await fee("2027-01")]).toEqual([100000, 100000, 140000]);
  });
});
