import { readFileSync } from "node:fs";
import { and, asc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { announcements, campaigns, classSessions, classTypes, entitlements, instructors, products } from "@/db/schema";
import { adminAddBooking, bookingOptions } from "@/domain/booking";
import { grantEntitlement } from "@/domain/users";
import { dateKey, pragueLocalToDate } from "@/lib/dates";
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
const run = async (file: string) => {
  for (const statement of readFileSync(`drizzle/${file}.sql`, "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const migrate = () => run("0160_reformer_duo_from_december");

/** Tuesdays and Saturdays from 1 Dec 2026 to 31 Dec 2027 */
function duoDays() {
  const out: string[] = [];
  for (let d = new Date(Date.UTC(2026, 11, 1)); d <= new Date(Date.UTC(2027, 11, 31)); d = new Date(d.getTime() + 86_400_000))
    if (d.getUTCDay() === 2 || d.getUTCDay() === 6) out.push(d.toISOString().slice(0, 10));
  return out;
}

describe("migration 0160: Reformer from 1 December 2026 and Reformer Duo", () => {
  it("moves the new price list to December, renames the lesson for two and schedules it", async () => {
    // the studio as it was before 0159 ran on the web
    const [reformer] = await h.db
      .insert(classTypes)
      .values({
        name: "Reformer fusion", slug: "reformer-fusion", capacity: 6, creditCost: 400, dropInPrice: 49000, durationMin: 60,
        memberSurcharge: 10000, memberSurchargeNext: 25000, memberSurchargeNextFrom: "2027-01-01",
        priceNote: "Zaváděcí cena pro rok 2026", priceNoteUntil: "2027-01-01", passEntries: 2, duoPrice: 80000,
        firstVisitPrice: 20000, noFreeEntry: true, passCardEntry: true, cancellationHours: 24, sortOrder: 5,
      })
      .returning();
    await h.db.insert(products).values({
      id: TIER, kind: "membership", name: "Členství Reformer", price: 250000, validityDays: 365, includedClassTypeId: reformer.id, includedPerMonth: 8,
      description: "Vše z členství, 8× Reformer fusion měsíčně v ceně a přednostní rezervace Reformeru. Omezený počet členství.",
    });
    const [lektorka] = await h.db.insert(instructors).values({ name: "Lektorka", slug: "lektorka" }).returning();
    const session = (local: string) =>
      h.db.insert(classSessions).values({ classTypeId: reformer.id, instructorId: lektorka.id, room: "Reformer", startsAt: pragueLocalToDate(local), durationMin: 60, capacity: 6, creditCost: 400, dropInPrice: 49000 }).returning().then((r) => r[0]);
    const november = await session("2026-11-30T06:00");
    const bookedDec = await session("2026-12-02T17:00");
    const emptyDec = await session("2026-12-09T17:00");
    await adminAddBooking(h.db, { sessionId: bookedDec.id, userId: (await makeUser(h.db)).id, pay: "admin" }, NOW);

    await run("0159_reformer_prices_2027");
    await migrate();

    // the price list switches on 1 December, with a note until then
    const [ct] = await h.db.select().from(classTypes).where(eq(classTypes.id, reformer.id));
    expect(ct).toMatchObject({ memberSurchargeNextFrom: "2026-12-01", memberSurchargeNext: 12000, dropInPriceNext: 39000, creditCostNext: 340, passEntriesNext: 1, passSurchargeNext: 10000, capacity: 5, priceNote: "Od 1. 12. 2026 za 390 Kč", priceNoteUntil: "2026-12-01" });
    const s = async (id: string) => (await h.db.select().from(classSessions).where(eq(classSessions.id, id)))[0];
    expect(await s(november.id)).toMatchObject({ dropInPrice: 49000, creditCost: 400, capacity: 6 });
    // a December lesson someone booked keeps its price (refunds count from it), an empty one gets the new one; both for 5
    expect(await s(bookedDec.id)).toMatchObject({ dropInPrice: 49000, creditCost: 400, capacity: 5 });
    expect(await s(emptyDec.id)).toMatchObject({ dropInPrice: 39000, creditCost: 340, capacity: 5 });

    // Reformer Duo
    const [duo] = await h.db.select().from(classTypes).where(eq(classTypes.id, DUO));
    expect(duo).toMatchObject({ name: "Reformer Duo", slug: "reformer-duo", priceNote: "Novinka od 1. 12. 2026", priceNoteUntil: "2026-12-01", capacity: 2, dropInPrice: 49000, creditCost: 430, memberSurcharge: 24000, countsAsLessons: 2 });
    expect(duo.description.startsWith("Reformer Duo je hodina jen pro dva.")).toBe(true);
    expect(duo.keywords).toContain("reformer duo Ostrava");

    // its sessions: every Tuesday 18:00 and Saturday 7:30 (Prague time, summer time too) until the end of 2027
    const duoSessions = await h.db.select().from(classSessions).where(eq(classSessions.classTypeId, DUO)).orderBy(asc(classSessions.startsAt));
    expect(duoSessions.map((x) => dateKey(x.startsAt))).toEqual(duoDays());
    expect(duoSessions[0].startsAt).toEqual(pragueLocalToDate("2026-12-01T18:00"));
    expect(duoSessions.find((x) => dateKey(x.startsAt) === "2027-06-05")!.startsAt).toEqual(pragueLocalToDate("2027-06-05T07:30"));
    for (const x of duoSessions)
      expect(x).toMatchObject({ capacity: 2, creditCost: 430, dropInPrice: 49000, durationMin: 60, instructorId: lektorka.id, room: "Reformer", status: "scheduled" });
    expect(new Set(duoSessions.map((x) => x.seriesId)).size).toBe(2);

    // texts
    const [p] = await h.db.select().from(products).where(eq(products.id, TIER));
    expect(p.description).toBe("Vše z členství, 8× Reformer měsíčně v ceně (Reformer Duo se počítá za dvě) a přednostní rezervace Reformeru. Omezený počet členství.");
    const post = async (id: string) => (await h.db.select().from(announcements).where(eq(announcements.id, id)))[0];
    expect((await post("1dd44d7a-151f-4695-8a47-a11e64aa898f")).body).toContain("skupinová lekce i nový Reformer Duo (ten se počítá za dvě), bez doplatku");
    const gifts = (await post("ec9596c8-12e0-4cf2-97ff-d54610740a2d")).body;
    expect(gifts).toContain("na skupinovou lekci jednu, na Reformer Duo dvě. Na další Reformer se pak doplácí jako obvykle (skupinová lekce 120 Kč, Reformer Duo 240 Kč).");
    expect(gifts).not.toContain("ve dvou");
    const [mail] = await h.db.select().from(campaigns).where(eq(campaigns.id, "1b19f3f2-85a4-450e-a725-1e2a51640f4f"));
    expect(mail.body).toContain("(skupinová lekce 120 Kč, Reformer Duo 240 Kč)");
    const news = await post(NEWS);
    expect(news.title).toBe("🧘‍♀️ Reformer od prosince: levněji a nově Reformer Duo");
    for (const text of ["Od 1. 12. 2026 se na něj dostaneš levněji", "Termíny: pondělí 6:00, středa 17:00, pátek 6:30 a neděle 17:00.", "Novinka: Reformer Duo – 490 Kč", "Termíny: úterý 18:00 a sobota 7:30.", "Členství Reformer – od ledna 2 300 Kč měsíčně", 'href="/rozvrh?tyden=2026-11-30"'])
      expect(news.body).toContain(text);
    expect(news.body).not.toContain("ve dvou");

    // again: nothing more
    await migrate();
    expect(await h.db.select().from(classSessions).where(eq(classSessions.classTypeId, DUO))).toHaveLength(duoDays().length);
    expect((await h.db.select().from(classTypes).where(eq(classTypes.id, reformer.id)))[0].priceNote).toBe("Od 1. 12. 2026 za 390 Kč");
  });

  it("books by the December price list: pass 1 entry + 100 Kč, members 120 Kč, Reformer Duo 240 Kč", async () => {
    const [reformer] = await h.db.select().from(classTypes).where(eq(classTypes.slug, "reformer-fusion"));
    const [emptyDec] = await h.db.select().from(classSessions).where(and(eq(classSessions.classTypeId, reformer.id), eq(classSessions.startsAt, pragueLocalToDate("2026-12-09T17:00"))));
    const [november] = await h.db.select().from(classSessions).where(and(eq(classSessions.classTypeId, reformer.id), eq(classSessions.startsAt, pragueLocalToDate("2026-11-30T06:00"))));
    const [duoDec] = await h.db.select().from(classSessions).where(and(eq(classSessions.classTypeId, DUO), eq(classSessions.startsAt, pragueLocalToDate("2026-12-05T07:30"))));

    const holder = await makeUser(h.db);
    const pass = await grantEntitlement(h.db, { userId: holder.id, kind: "pass", name: "Permanentka 10 vstupů", entries: 10, validityDays: 120 }, NOW);
    const passOpt = async (s: typeof emptyDec) => (await bookingOptions(h.db, holder.id, s)).find((o) => o.entitlementId === pass.id)!.detail;
    expect(await passOpt(november)).toBe("zbývá 10 z 10 · strhnou se 2 vstupy");
    expect(await passOpt(emptyDec)).toMatch(/^zbývá 10 z 10 · doplatek 100\sKč/);
    expect(await passOpt(duoDec)).toBe("zbývá 10 z 10 · strhnou se 2 vstupy");

    const member = await makeUser(h.db);
    const m = await grantEntitlement(h.db, { userId: member.id, kind: "membership", name: "Členství 2026", entries: null, validityDays: 120 }, NOW);
    const memberOpt = async (s: typeof emptyDec) => (await bookingOptions(h.db, member.id, s)).find((o) => o.entitlementId === m.id)!.detail;
    expect(await memberOpt(november)).toMatch(/doplatek 100\sKč/);
    expect(await memberOpt(emptyDec)).toMatch(/doplatek 120\sKč/);
    expect(await memberOpt(duoDec)).toMatch(/doplatek 240\sKč/);

    // Členství Reformer starts in January: in December its holder books like any member
    const tierMember = await makeUser(h.db);
    const [t] = await h.db.insert(entitlements).values({
      userId: tierMember.id, kind: "membership", productId: TIER, name: "Členství Reformer", validFrom: pragueLocalToDate("2027-01-01T00:00"), validUntil: pragueLocalToDate("2028-01-01T00:00"),
      monthlyFee: 230000, includedClassTypeId: reformer.id, includedPerMonth: 8,
    }).returning();
    expect((await bookingOptions(h.db, tierMember.id, duoDec)).find((o) => o.entitlementId === t.id)).toBeUndefined();
  });
});
