import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookingOptions } from "@/domain/booking";
import { createProductOrder } from "@/domain/orders";
import { deductSolarium, solariumPasses } from "@/domain/solarium";
import { grantEntitlement } from "@/domain/users";
import { NOW, makeProduct, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("solarium", () => {
  it("deducts minutes across passes, soonest-expiring first", async () => {
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "solarium", name: "Slunce 20", entries: 20, validityDays: 10 }, NOW);
    await grantEntitlement(h.db, { userId: u.id, kind: "solarium", name: "Slunce 100", entries: 100, validityDays: 70 }, NOW);
    const left = await deductSolarium(h.db, { userId: u.id, minutes: 30, actorId: u.id }, NOW);
    expect(left).toBe(90);
    const passes = await solariumPasses(h.db, u.id, NOW);
    expect(passes.map((p) => [p.name, p.left])).toEqual([["Slunce 100", 90]]);
    await expect(deductSolarium(h.db, { userId: u.id, minutes: 91, actorId: u.id }, NOW)).rejects.toThrow(/jen 90 min/);
  });

  it("solarium minutes can't pay for classes", async () => {
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "solarium", name: "Slunce", entries: 100, validityDays: 70 }, NOW);
    const s = await makeSession(h.db);
    const opts = await bookingOptions(h.db, u.id, s);
    expect(opts.some((o) => o.label === "Slunce")).toBe(false);
  });

  it("members-only products need an active membership", async () => {
    const p = await makeProduct(h.db, { kind: "solarium", entries: 100, validityDays: 70, membersOnly: true, name: "Slunce pro členy" });
    const guest = await makeUser(h.db);
    await expect(createProductOrder(h.db, { userId: guest.id, productId: p.id }, NOW)).rejects.toThrow(/jen pro členy/);
    const member = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: member.id, kind: "membership", name: "Členství", entries: null, validityDays: 30 }, NOW);
    const { order } = await createProductOrder(h.db, { userId: member.id, productId: p.id }, NOW);
    expect(order.productId).toBe(p.id);
  });
});
