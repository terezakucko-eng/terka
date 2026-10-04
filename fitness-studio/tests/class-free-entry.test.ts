import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes, entitlements } from "@/db/schema";
import { bookSession, bookingOptions } from "@/domain/booking";
import { grantEntitlement } from "@/domain/users";
import { NOW, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("free entries for one class (e.g. Reformer)", () => {
  it("work only on that class, even where intro entries don't, one entry per visit", async () => {
    const u = await makeUser(h.db);
    const reformer = await makeSession(h.db);
    await h.db
      .update(classTypes)
      .set({ name: "Reformer", noFreeEntry: true, passEntries: 2, memberSurcharge: 15000 })
      .where(eq(classTypes.id, reformer.classTypeId));
    const other = await makeSession(h.db);

    const general = await grantEntitlement(h.db, { userId: u.id, kind: "free", name: "Vstup zdarma", entries: 1, validityDays: 30 }, NOW);
    const ref = await grantEntitlement(
      h.db,
      { userId: u.id, kind: "free", name: "Vstup zdarma – Reformer", entries: 2, validityDays: 30, classTypeId: reformer.classTypeId },
      NOW,
    );

    // Reformer: the general free entry is blocked, the Reformer one is offered
    const onReformer = await bookingOptions(h.db, u.id, reformer);
    expect(onReformer.find((o) => o.entitlementId === general.id)?.disabled).toMatch(/nejde/);
    const pick = onReformer.find((o) => o.entitlementId === ref.id)!;
    expect(pick.disabled).toBeUndefined();
    expect(pick.detail).toBe("zbývá 2 z 2");

    // any other class: the Reformer entry isn't offered at all
    const onOther = await bookingOptions(h.db, u.id, other);
    expect(onOther.some((o) => o.entitlementId === ref.id)).toBe(false);
    await expect(
      bookSession(h.db, { userId: u.id, sessionId: other.id, method: "free", entitlementId: ref.id }, NOW),
    ).rejects.toThrow(/jinou lekci/);

    const { booking } = await bookSession(
      h.db,
      { userId: u.id, sessionId: reformer.id, method: "free", entitlementId: ref.id },
      NOW,
    );
    expect(booking.status).toBe("confirmed");
    const [e] = await h.db.select().from(entitlements).where(eq(entitlements.id, ref.id));
    expect(e.entriesUsed).toBe(1);
  });
});
