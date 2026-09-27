import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classSessions, classTypes } from "@/db/schema";
import { deleteClassType } from "@/domain/catalog";
import { NOW, hours, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const typeRow = async (id: string) => (await h.db.select().from(classTypes).where(eq(classTypes.id, id)))[0];
const sessionsOf = async (id: string) =>
  h.db.select().from(classSessions).where(eq(classSessions.classTypeId, id));

describe("deleting class types", () => {
  it("removes the type together with sessions nobody booked", async () => {
    const s = await makeSession(h.db);
    expect(await deleteClassType(h.db, s.classTypeId, NOW)).toBe("deleted");
    expect(await typeRow(s.classTypeId)).toBeUndefined();
    expect(await sessionsOf(s.classTypeId)).toHaveLength(0);
  });

  it("refuses while an upcoming session has live bookings", async () => {
    const s = await makeSession(h.db);
    const u = await makeUser(h.db);
    await h.db.insert(bookings).values({ userId: u.id, sessionId: s.id, status: "confirmed" });
    await expect(deleteClassType(h.db, s.classTypeId, NOW)).rejects.toThrow(/nadcházející termín/);
    expect(await typeRow(s.classTypeId)).toBeDefined();
  });

  it("archives the type when past sessions have booking history", async () => {
    const past = await makeSession(h.db, { startsAt: hours(-48) });
    const [future] = await h.db
      .insert(classSessions)
      .values({ classTypeId: past.classTypeId, startsAt: hours(72), durationMin: 60, capacity: 5, creditCost: 1 })
      .returning();
    const u = await makeUser(h.db);
    await h.db.insert(bookings).values({ userId: u.id, sessionId: past.id, status: "attended" });

    expect(await deleteClassType(h.db, past.classTypeId, NOW)).toBe("archived");
    const t = await typeRow(past.classTypeId);
    expect(t.isActive).toBe(false);
    expect(t.archivedAt).not.toBeNull();
    const left = await sessionsOf(past.classTypeId);
    expect(left.map((s) => s.id)).toEqual([past.id]);
    expect(left.some((s) => s.id === future.id)).toBe(false);
  });
});
