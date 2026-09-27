import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { entitlements, massageServices, products } from "@/db/schema";
import { addAvailability, bookMassage, cancelMassage, massagePassesFor } from "@/domain/massages";
import { sellAtReception } from "@/domain/orders";
import { pragueLocalToDate } from "@/lib/dates";
import { NOW, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const at = (hm: string, day = "2026-10-06") => pragueLocalToDate(`${day}T${hm}`);

async function service(name: string) {
  const [s] = await h.db
    .insert(massageServices)
    .values({ name, slug: `m-${Math.random()}`, durationMin: 60, price: 70000 })
    .returning();
  return s;
}

describe("massage passes", () => {
  it("deducts an entry per booking, returns it on cancel and only fits its massage", async () => {
    const mad = await service("Maderoterapie");
    const other = await service("Relaxační");
    await addAvailability(h.db, { date: "2026-10-06", from: "09:00", to: "18:00", weeks: 1 });
    const [p] = await h.db
      .insert(products)
      .values({ kind: "massage_pass", name: "Maderoterapie 5×", price: 350000, entries: 5, validityDays: 60, massageServiceId: mad.id })
      .returning();
    const u = await makeUser(h.db);
    await sellAtReception(h.db, { userId: u.id, productId: p.id }, NOW);

    expect(await massagePassesFor(h.db, u.id, mad.id, at("09:00"))).toHaveLength(1);
    expect(await massagePassesFor(h.db, u.id, other.id, at("09:00"))).toHaveLength(0);
    await expect(
      bookMassage(h.db, { userId: u.id, serviceId: other.id, startsAt: at("09:00"), payment: "pass" }, NOW),
    ).rejects.toThrow(/permanentku/);

    const b = await bookMassage(h.db, { userId: u.id, serviceId: mad.id, startsAt: at("09:00"), payment: "pass" }, NOW);
    expect(b.price).toBe(0);
    expect(b.entitlementId).toBeTruthy();
    const [e1] = await h.db.select().from(entitlements).where(eq(entitlements.id, b.entitlementId!));
    expect(e1.entriesUsed).toBe(1);

    await cancelMassage(h.db, { bookingId: b.id, actorId: u.id }, NOW);
    const [e2] = await h.db.select().from(entitlements).where(eq(entitlements.id, b.entitlementId!));
    expect(e2.entriesUsed).toBe(0);
  });

  it("stops when the pass is used up", async () => {
    const s = await service("Obličej");
    await addAvailability(h.db, { date: "2026-10-07", from: "09:00", to: "18:00", weeks: 1 });
    const [p] = await h.db
      .insert(products)
      .values({ kind: "massage_pass", name: "Masáže 1×", price: 70000, entries: 1, validityDays: 30 })
      .returning();
    const u = await makeUser(h.db);
    await sellAtReception(h.db, { userId: u.id, productId: p.id }, NOW);
    await bookMassage(h.db, { userId: u.id, serviceId: s.id, startsAt: at("09:00", "2026-10-07"), payment: "pass" }, NOW);
    await expect(
      bookMassage(h.db, { userId: u.id, serviceId: s.id, startsAt: at("11:00", "2026-10-07"), payment: "pass" }, NOW),
    ).rejects.toThrow(/permanentku/);
  });
});
