import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sent: { to: string; id: string; vars: Record<string, string> }[] = [];
vi.mock("@/lib/email-templates", () => ({
  sendEmail: vi.fn(async (to: string, id: string, vars: Record<string, string>) => void sent.push({ to, id, vars })),
}));
vi.mock("@/lib/push", () => ({ pushQuietly: vi.fn(async () => 0) }));

const { bookings, entitlements, users } = await import("@/db/schema");
const { celebrationDays, dueWinbacks } = await import("@/domain/greetings");
const { sendGreetings, sendWinbacks } = await import("@/lib/notify");
const { saveSettings } = await import("@/lib/settings");
const { NOW, hours, makeSession, makeUser, testDb } = await import("./helpers");

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());
beforeEach(() => void (sent.length = 0));

const DAY = 24;

describe("celebration days", () => {
  it("celebrates 29 February on the 28th in common years", () => {
    expect(celebrationDays(new Date("2027-02-28T10:00:00Z"))).toEqual(["02-28", "02-29"]);
    expect(celebrationDays(new Date("2028-02-28T10:00:00Z"))).toEqual(["02-28"]);
    expect(celebrationDays(new Date("2026-10-04T23:30:00Z"))).toEqual(["10-05"]); // already 5 Oct in Prague
  });
});

describe("birthday and name-day wishes", () => {
  it("greets once a year, gives the birthday gift and skips the name day on a birthday", async () => {
    const born = await makeUser(h.db);
    const both = await makeUser(h.db);
    const named = await makeUser(h.db);
    const admin = await makeUser(h.db);
    const gone = await makeUser(h.db);
    await h.db.update(users).set({ birthDate: "1990-10-05" }).where(eq(users.id, born.id));
    await h.db.update(users).set({ birthDate: "1985-10-05", nameDay: "10-05" }).where(eq(users.id, both.id));
    await h.db.update(users).set({ nameDay: "10-05" }).where(eq(users.id, named.id));
    await h.db.update(users).set({ birthDate: "1980-10-05", role: "admin" }).where(eq(users.id, admin.id));
    await h.db.update(users).set({ birthDate: "1980-10-05", deletedAt: NOW }).where(eq(users.id, gone.id));

    expect(await sendGreetings(h.db, NOW)).toEqual({ birthdays: 2, nameDays: 1 });
    expect(sent.map((m) => `${m.to}:${m.id}`).sort()).toEqual([`${born.email}:birthday`, `${both.email}:birthday`, `${named.email}:nameDay`].sort());
    expect(sent.find((m) => m.to === born.email)?.vars.darek).toContain("lekci zdarma, platí do 4. 11. 2026");

    const gifts = await h.db.select().from(entitlements).where(and(eq(entitlements.userId, born.id), eq(entitlements.kind, "free")));
    expect(gifts).toHaveLength(1);
    expect(gifts[0].entriesTotal).toBe(1);
    expect(gifts[0].validUntil.getTime() - NOW.getTime()).toBe(30 * DAY * 3_600_000);

    // later runs that day – nothing more
    sent.length = 0;
    expect(await sendGreetings(h.db, hours(5))).toEqual({ birthdays: 0, nameDays: 0 });
    expect(sent).toEqual([]);
    // next year again
    expect((await sendGreetings(h.db, new Date("2027-10-05T08:00:00Z"))).birthdays).toBe(2);
  });

  it("sends only wishes without a gift, and nothing when switched off", async () => {
    const u = await makeUser(h.db);
    await h.db.update(users).set({ birthDate: "1995-03-12" }).where(eq(users.id, u.id));
    const day = new Date("2026-03-12T09:00:00Z");
    await saveSettings(h.db, { birthdayGreetings: 0 });
    expect(await sendGreetings(h.db, day)).toEqual({ birthdays: 0, nameDays: 0 });
    await saveSettings(h.db, { birthdayGreetings: 1, birthdayGiftEntries: 0 });
    expect((await sendGreetings(h.db, day)).birthdays).toBe(1);
    expect(sent.at(-1)?.vars.darek).toBe("");
    expect(await h.db.select().from(entitlements).where(eq(entitlements.userId, u.id))).toHaveLength(0);
    await saveSettings(h.db, { birthdayGiftEntries: 1 });
  });
});

describe("„Chybíš nám“", () => {
  it("writes once per pause to clients with news consent and nothing booked", async () => {
    const away = await makeUser(h.db);
    const booked = await makeUser(h.db);
    const noConsent = await makeUser(h.db);
    const recent = await makeUser(h.db);
    const longGone = await makeUser(h.db);
    const unmarked = await makeUser(h.db); // attendance not marked – a past booking still counts
    for (const u of [away, booked, recent, longGone, unmarked]) await h.db.update(users).set({ marketingConsent: true }).where(eq(users.id, u.id));
    const past = await makeSession(h.db, { startsAt: hours(-30 * DAY) });
    const lastWeek = await makeSession(h.db, { startsAt: hours(-7 * DAY) });
    const ancient = await makeSession(h.db, { startsAt: hours(-200 * DAY) });
    const future = await makeSession(h.db, { startsAt: hours(3 * DAY) });
    await h.db.insert(bookings).values([
      { userId: away.id, sessionId: past.id, status: "attended" },
      { userId: booked.id, sessionId: past.id, status: "attended" },
      { userId: booked.id, sessionId: future.id, status: "confirmed" },
      { userId: noConsent.id, sessionId: past.id, status: "attended" },
      { userId: recent.id, sessionId: past.id, status: "attended" },
      { userId: recent.id, sessionId: lastWeek.id, status: "attended" },
      { userId: longGone.id, sessionId: ancient.id, status: "attended" },
      { userId: unmarked.id, sessionId: past.id, status: "confirmed" },
    ]);

    expect((await dueWinbacks(h.db, 28, NOW)).map((r) => r.id).sort()).toEqual([away.id, unmarked.id].sort());
    expect(await sendWinbacks(h.db, NOW)).toBe(2);
    expect(sent.find((m) => m.to === away.email)).toMatchObject({ id: "winback" });
    expect(sent[0].vars.odhlasit).toMatch(/\/o\/[0-9a-f]+$/);
    expect(await sendWinbacks(h.db, hours(DAY))).toBe(0);

    // comes back, then stays away again → another e-mail
    const back = await makeSession(h.db, { startsAt: hours(2 * DAY) });
    await h.db.insert(bookings).values({ userId: away.id, sessionId: back.id, status: "attended" });
    expect((await dueWinbacks(h.db, 28, hours(20 * DAY))).map((r) => r.id)).not.toContain(away.id);
    expect((await dueWinbacks(h.db, 28, hours(31 * DAY))).map((r) => r.id)).toContain(away.id);
    expect(await dueWinbacks(h.db, 0, hours(31 * DAY))).toEqual([]);
  });
});
