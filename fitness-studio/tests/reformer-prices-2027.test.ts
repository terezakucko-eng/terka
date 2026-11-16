import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { announcements, bookings, campaigns, classSessions, classTypes, creditTransactions, entitlements, orders, products, users } from "@/db/schema";
import { adminAddBooking, bookingOptions } from "@/domain/booking";
import { grantEntitlement } from "@/domain/users";
import { pragueLocalToDate } from "@/lib/dates";
import { saveSettings } from "@/lib/settings";
import { NOW, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
  await saveSettings(h.db, { bookingWindowWeeks: 0, memberBookingWindowWeeks: 0, bookingWindowDays: 120, memberBookingWindowDays: 120 });
});
afterAll(async () => h.close());

const TIER = "b09203a4-b468-4653-be2b-01d41922d888";
const DUO = "d2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46";
const NEWS = "a8e3c5d1-6f24-4b97-8c0e-2d71b4f9e635";
const GIFTS = "ec9596c8-12e0-4cf2-97ff-d54610740a2d";
const TIER_POST = "1dd44d7a-151f-4695-8a47-a11e64aa898f";
const GIFTS_MAIL = "1b19f3f2-85a4-450e-a725-1e2a51640f4f";
const NOTE = "Členství Reformer zlevnilo na 2 300 Kč – rozdíl za leden 2027";
const migrate = async () => {
  for (const statement of readFileSync("drizzle/0159_reformer_prices_2027.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const JAN = pragueLocalToDate("2027-01-01T00:00");
const YEAR_END = pragueLocalToDate("2028-01-01T00:00");

describe("migration 0159: Reformer prices from 1 January 2027", () => {
  it("does nothing to the texts while the new prices aren't in place", async () => {
    // all migrations ran on an empty studio: no Reformer, so the board and the draft e-mail stay as they were
    const [gifts] = await h.db.select().from(announcements).where(eq(announcements.id, GIFTS));
    expect(gifts.body).toContain("Na další Reformer se pak doplácí jako obvykle (250 Kč).");
    expect(await h.db.select().from(announcements).where(eq(announcements.id, NEWS))).toEqual([]);
  });

  it("sets the 2027 price list, the lesson for two, the cheaper Reformer membership – and the texts", async () => {
    // the studio as it is on 16 Nov 2026
    const [reformer] = await h.db
      .insert(classTypes)
      .values({
        name: "Reformer fusion", slug: "reformer-fusion", capacity: 6, creditCost: 400, dropInPrice: 49000, durationMin: 60,
        memberSurcharge: 10000, memberSurchargeNext: 25000, memberSurchargeNextFrom: "2027-01-01",
        priceNote: "Zaváděcí cena pro rok 2026", priceNoteUntil: "2027-01-01", passEntries: 2, duoPrice: 80000,
        firstVisitPrice: 20000, noFreeEntry: true, passCardEntry: true, cancellationHours: 24, color: "#A0C4B8", sortOrder: 5,
      })
      .returning();
    await h.db.insert(products).values({
      id: TIER, kind: "membership", name: "Členství Reformer", price: 250000, validityDays: 365, includedClassTypeId: reformer.id, includedPerMonth: 8, maxActive: 4,
      description: "Vše z členství, 8× Reformer fusion měsíčně v ceně a přednostní rezervace Reformeru. Omezený počet členství.",
    });
    const tier = (userId: string, over: Partial<typeof entitlements.$inferInsert> = {}) =>
      h.db.insert(entitlements).values({
        userId, kind: "membership", productId: TIER, name: "Členství Reformer", validFrom: JAN, validUntil: YEAR_END,
        monthlyFee: 250000, includedClassTypeId: reformer.id, includedPerMonth: 8, ...over,
      }).returning().then((r) => r[0]);
    // reserved in presale, pays by the December request
    const reserved = await makeUser(h.db);
    await tier(reserved.id, { note: "Předprodej – první měsíc zaplatí výzvou v prosinci" });
    // bought and paid January with the purchase
    const bought = await makeUser(h.db);
    const [paid] = await h.db.insert(orders).values({ userId: bought.id, kind: "product", productId: TIER, description: "Členství Reformer", amount: 250000, status: "paid", provider: "test", paidAt: NOW }).returning();
    await tier(bought.id, { orderId: paid.id });
    // a January fee request already out
    const asked = await makeUser(h.db);
    await tier(asked.id);
    const [fee] = await h.db.insert(orders).values({ userId: asked.id, kind: "membership_fee", period: "2027-01", description: "Členství – leden 2027", amount: 250000, provider: "transfer" }).returning();
    // the studio's own price for someone stays
    const own = await makeUser(h.db);
    const special = await tier(own.id, { monthlyFee: 200000 });

    const session = (local: string, capacity = 6) =>
      h.db.insert(classSessions).values({ classTypeId: reformer.id, startsAt: pragueLocalToDate(local), durationMin: 60, capacity, creditCost: 400, dropInPrice: 49000 }).returning().then((r) => r[0]);
    const december = await session("2026-12-29T17:00");
    const emptyJan = await session("2027-01-05T17:00");
    const bookedJan = await session("2027-01-08T06:30");
    const fullJan = await session("2027-01-10T17:00");
    await adminAddBooking(h.db, { sessionId: bookedJan.id, userId: (await makeUser(h.db)).id, pay: "admin" }, NOW);
    for (let i = 0; i < 6; i++) await adminAddBooking(h.db, { sessionId: fullJan.id, userId: (await makeUser(h.db)).id, pay: "admin" }, NOW);

    await migrate();

    const [ct] = await h.db.select().from(classTypes).where(eq(classTypes.id, reformer.id));
    expect(ct).toMatchObject({
      capacity: 5, dropInPrice: 49000, creditCost: 400, passEntries: 2, memberSurcharge: 10000,
      memberSurchargeNext: 12000, memberSurchargeNextFrom: "2027-01-01", dropInPriceNext: 39000, creditCostNext: 340, passEntriesNext: 1, passSurchargeNext: 10000,
      priceNote: "", priceNoteUntil: null,
    });
    const [duo] = await h.db.select().from(classTypes).where(eq(classTypes.id, DUO));
    expect(duo).toMatchObject({
      name: "Reformer fusion ve dvou", slug: "reformer-fusion-ve-dvou", capacity: 2, dropInPrice: 49000, creditCost: 430, memberSurcharge: 24000,
      passEntries: 2, passSurcharge: null, noFreeEntry: true, passCardEntry: false, firstVisitPrice: null, duoPrice: null, cancellationHours: 24,
      countsAsTypeId: reformer.id, countsAsLessons: 2, isActive: true, color: "#A0C4B8", priceNote: "Nově od ledna 2027", priceNoteUntil: "2027-01-01",
    });

    // sessions: December untouched; empty January ones at the new price; any January one for 5 unless more are in already
    const s = async (id: string) => (await h.db.select().from(classSessions).where(eq(classSessions.id, id)))[0];
    expect(await s(december.id)).toMatchObject({ capacity: 6, dropInPrice: 49000, creditCost: 400 });
    expect(await s(emptyJan.id)).toMatchObject({ capacity: 5, dropInPrice: 39000, creditCost: 340 });
    expect(await s(bookedJan.id)).toMatchObject({ capacity: 5, dropInPrice: 49000, creditCost: 400 });
    expect(await s(fullJan.id)).toMatchObject({ capacity: 6 });

    // the membership: 2 300 Kč for the price list and for everyone who has it reserved
    const [p] = await h.db.select().from(products).where(eq(products.id, TIER));
    expect(p.price).toBe(230000);
    expect(p.description).toBe("Vše z členství, 8× Reformer měsíčně v ceně (lekce ve dvou se počítá za dvě) a přednostní rezervace Reformeru. Omezený počet členství.");
    const fees = await h.db.select({ userId: entitlements.userId, fee: entitlements.monthlyFee }).from(entitlements).where(eq(entitlements.productId, TIER));
    for (const u of [reserved, bought, asked]) expect(fees.find((f) => f.userId === u.id)!.fee).toBe(230000);
    expect((await h.db.select().from(entitlements).where(eq(entitlements.id, special.id)))[0].monthlyFee).toBe(200000);
    expect((await h.db.select().from(orders).where(eq(orders.id, fee.id)))[0].amount).toBe(230000);
    // January paid at 2 500 Kč: the 200 Kč back as credit, nobody else gets any
    const credit = async (id: string) => (await h.db.select({ c: users.creditBalance }).from(users).where(eq(users.id, id)))[0].c;
    expect(await credit(bought.id)).toBe(200);
    for (const u of [reserved, asked, own]) expect(await credit(u.id)).toBe(0);
    expect(await h.db.select().from(creditTransactions).where(eq(creditTransactions.userId, bought.id))).toMatchObject([
      { delta: 200, balanceAfter: 200, reason: "refund", note: NOTE },
    ]);

    // the board and the draft e-mail
    const [gifts] = await h.db.select().from(announcements).where(eq(announcements.id, GIFTS));
    expect(gifts.body).toContain("Lekce využiješ kdykoli během roku 2027 – na skupinovou lekci jednu, na lekci ve dvou dvě. Na další Reformer se pak doplácí jako obvykle (skupinová lekce 120 Kč, lekce ve dvou 240 Kč).");
    expect(gifts.body).not.toContain("250 Kč");
    const [mail] = await h.db.select().from(campaigns).where(eq(campaigns.id, GIFTS_MAIL));
    expect(mail.body).toContain("(skupinová lekce 120 Kč, lekce ve dvou 240 Kč)");
    const [tierPost] = await h.db.select().from(announcements).where(eq(announcements.id, TIER_POST));
    expect(tierPost.body).toContain("💳 2 300 Kč měsíčně, členství na 12 měsíců – teď nic neplatíš, výzvu k platbě za leden ti pošleme v prosinci");
    expect(tierPost.body).toContain("<strong>8× Reformer měsíčně v ceně</strong> – skupinová lekce i nová lekce ve dvou (ta se počítá za dvě), bez doplatku");
    expect(tierPost.body).not.toContain("2 500");
    const [news] = await h.db.select().from(announcements).where(eq(announcements.id, NEWS));
    expect(news).toMatchObject({ title: "🧘‍♀️ Reformer od ledna: levněji a nově i ve dvou", isPinned: false, isPublished: true });
    for (const text of ["Jednorázově 390 Kč (místo 490 Kč) nebo 340 kreditů.", "S permanentkou 1 vstup + doplatek 100 Kč.", "Členové doplácí 120 Kč.", "Členové doplácí 240 Kč.", "S permanentkou 2 vstupy.", "Termíny: úterý 18:00, středa 17:00, pátek 6:30 a sobota 7:30.", 'href="/cenik?rok=2027"'])
      expect(news.body).toContain(text);

    // again: nothing more – one credit, one lesson for two, one post
    await migrate();
    expect(await credit(bought.id)).toBe(200);
    expect(await h.db.select().from(classTypes).where(eq(classTypes.slug, "reformer-fusion-ve-dvou"))).toHaveLength(1);
    expect(await h.db.select().from(announcements).where(eq(announcements.id, NEWS))).toHaveLength(1);
  });

  it("the lesson for two works with the Reformer membership, gifts and passes", async () => {
    const [reformer] = await h.db.select().from(classTypes).where(eq(classTypes.slug, "reformer-fusion"));
    const [duoSession] = await h.db.insert(classSessions).values({ classTypeId: DUO, startsAt: pragueLocalToDate("2027-01-06T17:00"), durationMin: 60, capacity: 2, creditCost: 430, dropInPrice: 49000 }).returning();
    const [groupSession] = await h.db.insert(classSessions).values({ classTypeId: reformer.id, startsAt: pragueLocalToDate("2027-01-07T17:00"), durationMin: 60, capacity: 5, creditCost: 340, dropInPrice: 39000 }).returning();

    const member = await makeUser(h.db);
    const [m] = await h.db.insert(entitlements).values({
      userId: member.id, kind: "membership", productId: TIER, name: "Členství Reformer", validFrom: NOW, validUntil: YEAR_END,
      monthlyFee: 230000, includedClassTypeId: reformer.id, includedPerMonth: 8,
    }).returning();
    const memberOpt = (await bookingOptions(h.db, member.id, duoSession)).find((o) => o.entitlementId === m.id)!;
    expect(memberOpt.detail).toBe("neomezeně · v ceně členství (počítá se za 2 lekce), na leden zbývá 8");

    const regular = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: regular.id, kind: "membership", name: "Členství 2027", entries: null, validityDays: 400 }, NOW);
    const surchargeOf = async (s: typeof duoSession) => (await bookingOptions(h.db, regular.id, s)).find((o) => o.method === "membership")!.detail;
    expect(await surchargeOf(duoSession)).toMatch(/doplatek 240\sKč/);
    expect(await surchargeOf(groupSession)).toMatch(/doplatek 120\sKč/);

    const holder = await makeUser(h.db);
    const pass = await grantEntitlement(h.db, { userId: holder.id, kind: "pass", name: "Permanentka 10 vstupů", entries: 10, validityDays: 120 }, NOW);
    const passOpt = async (s: typeof duoSession) => (await bookingOptions(h.db, holder.id, s)).find((o) => o.entitlementId === pass.id)!.detail;
    expect(await passOpt(duoSession)).toBe("zbývá 10 z 10 · strhnou se 2 vstupy");
    expect(await passOpt(groupSession)).toMatch(/^zbývá 10 z 10 · doplatek 100\sKč/);

    // the welcome free entry doesn't count on it
    const newcomer = await makeUser(h.db);
    const welcome = await grantEntitlement(h.db, { userId: newcomer.id, kind: "free", name: "Vstup zdarma", entries: 1, validityDays: 120 }, NOW);
    expect((await bookingOptions(h.db, newcomer.id, duoSession)).find((o) => o.entitlementId === welcome.id)?.disabled).toBe("Úvodní vstup zdarma na tuhle lekci použít nejde.");
    expect(await h.db.select().from(bookings).where(and(eq(bookings.sessionId, duoSession.id)))).toEqual([]);
  });
});
