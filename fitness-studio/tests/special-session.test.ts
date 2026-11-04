import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes, content, entitlements } from "@/db/schema";
import { bookSession, bookingOptions } from "@/domain/booking";
import { grantEntitlement, registerUser } from "@/domain/users";
import { popupOver, popupSlot } from "@/lib/popup-seen";
import { NOW, hours, makeSession, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

let n = 0;
const newcomer = () => registerUser(h.db, { email: `special${++n}@test.cz`, name: "Nová Klientka", passwordHash: "x" }, NOW);
const mine = (userId: string) => h.db.select().from(entitlements).where(eq(entitlements.userId, userId));

describe("a special class (guest instructors) is always paid for", () => {
  it("the welcome lesson doesn't count there – it does on the usual class of the same kind", async () => {
    const u = await newcomer();
    const [welcome] = await mine(u.id);
    expect(welcome.kind).toBe("free");
    const usual = await makeSession(h.db, { capacity: 10, startsAt: hours(30) });
    const special = await makeSession(h.db, { capacity: 10, startsAt: hours(32), classTypeId: usual.classTypeId, title: "Zumba fitness SPECIAL", noFreeEntry: true });

    const free = async (s: typeof usual) => (await bookingOptions(h.db, u.id, s, 1, NOW)).find((o) => o.method === "free");
    expect((await free(usual))?.disabled).toBeUndefined();
    expect((await free(special))?.disabled).toMatch(/speciální lekci/);
    await expect(bookSession(h.db, { userId: u.id, sessionId: special.id, method: "free", entitlementId: welcome.id }, NOW)).rejects.toThrow(/speciální lekci/);

    // paying is fine: the drop-in is offered and books
    expect((await bookingOptions(h.db, u.id, special, 1, NOW)).find((o) => o.method === "drop_in")?.disabled).toBeUndefined();
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: special.id, method: "drop_in" }, NOW);
    expect(booking.status).toBe("pending_payment");
  });

  it("not even a free entry given for that very class, nor the intro price", async () => {
    const u = await newcomer();
    const usual = await makeSession(h.db, { capacity: 10, startsAt: hours(40) });
    await h.db.update(classTypes).set({ firstVisitPrice: 10000 }).where(eq(classTypes.id, usual.classTypeId));
    const special = await makeSession(h.db, { capacity: 10, startsAt: hours(42), classTypeId: usual.classTypeId, noFreeEntry: true });
    const own = await grantEntitlement(h.db, { userId: u.id, kind: "free", name: "Vstup zdarma – Zumba", entries: 1, validityDays: 30, classTypeId: usual.classTypeId }, NOW);

    const opts = await bookingOptions(h.db, u.id, special, 1, NOW);
    expect(opts.find((o) => o.entitlementId === own.id)?.disabled).toMatch(/speciální lekci/);
    expect(opts.find((o) => o.method === "drop_in")?.label).toMatch(/^Jednorázový vstup 250\sKč$/);
    // the usual class still has its intro price for a newcomer
    expect((await bookingOptions(h.db, u.id, usual, 1, NOW)).find((o) => o.method === "drop_in")?.label).toMatch(/^První lekce 100\sKč$/);
  });
});

describe("migration 0145: the Zumba SPECIAL pop-up", () => {
  it("shows through Monday 16. 11. with both lessons, the membership one comes back on 17. 11.", async () => {
    const c = Object.fromEntries((await h.db.select().from(content)).map((r) => [r.key, r.value]));
    expect(c["popup.title"]).toContain("Zumba SPECIAL");
    expect([c["popup.buttonUrl"], c["popup.buttonUrl2"]]).toEqual(["/rozvrh/5ea2983c-b146-45ae-b4b6-f86c43acc4c4", "/rozvrh/00d2c63c-54d6-4248-a5a0-842b458b2e96"]);
    expect(c["popup.image"]).toMatch(/^\/media\/.+\.webp$/);
    const next = { title: c["popupNext.title"], from: c["popupNext.from"] };
    expect(popupSlot(next, "2026-11-16")).toBe("popup");
    expect(popupOver(c["popup.until"], "2026-11-16")).toBe(false);
    expect(popupSlot(next, "2026-11-17")).toBe("popupNext");
  });
});
