import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { users } from "@/db/schema";
import { createProductOrder } from "@/domain/orders";
import { deleteStudentProof, hasStudentProof, pendingStudentProofs, saveStudentProof } from "@/domain/students";
import { isStudent } from "@/lib/student";
import { NOW, makeProduct, makeUser, testDb } from "./helpers";

vi.mock("server-only", () => ({}));

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("student prices", () => {
  it("bought on trust: the client confirms she studies, a verified student doesn't have to", async () => {
    const pass = await makeProduct(h.db, { kind: "pass", name: "Studentská permanentka", price: 129000, entries: 10, validityDays: 90, studentsOnly: true });
    const u = await makeUser(h.db);
    // on the web without the tick
    await expect(createProductOrder(h.db, { userId: u.id, productId: pass.id, studentConfirmed: false }, NOW)).rejects.toThrow(/studuješ/);
    // with it
    const { order } = await createProductOrder(h.db, { userId: u.id, productId: pass.id, studentConfirmed: true }, NOW);
    expect(order.amount).toBe(129000);
    // the reception sells it without the web checkbox
    await expect(createProductOrder(h.db, { userId: u.id, productId: pass.id }, NOW)).resolves.toBeTruthy();

    // verified – no tick needed
    await h.db.update(users).set({ studentUntil: "2027-08-31" }).where(eq(users.id, u.id));
    await expect(createProductOrder(h.db, { userId: u.id, productId: pass.id, studentConfirmed: false }, NOW)).resolves.toBeTruthy();
  });

  it("an uploaded ISIC photo waits for the reception and goes away after the check", async () => {
    const u = await makeUser(h.db);
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#d2a772" } }).png().toBuffer();
    await saveStudentProof(h.db, u.id, new File([new Uint8Array(png)], "isic.png", { type: "image/png" }));
    expect(await hasStudentProof(h.db, u.id)).toBeInstanceOf(Date);
    expect((await pendingStudentProofs(h.db)).map((p) => p.id)).toContain(u.id);
    // a second upload replaces the first
    await saveStudentProof(h.db, u.id, new File([new Uint8Array(png)], "isic2.png", { type: "image/png" }));
    expect((await pendingStudentProofs(h.db)).filter((p) => p.id === u.id)).toHaveLength(1);

    await expect(saveStudentProof(h.db, u.id, new File(["x"], "a.pdf", { type: "application/pdf" }))).rejects.toThrow(/fotku/);
    await deleteStudentProof(h.db, u.id);
    expect(await hasStudentProof(h.db, u.id)).toBeNull();
  });

  it("isStudent counts the last day too", () => {
    expect(isStudent({ studentUntil: "2026-10-05" }, new Date("2026-10-05T20:00:00Z"))).toBe(true);
    expect(isStudent({ studentUntil: "2026-10-04" }, new Date("2026-10-05T08:00:00Z"))).toBe(false);
    expect(isStudent({ studentUntil: null })).toBe(false);
    expect(isStudent(null)).toBe(false);
  });
});
