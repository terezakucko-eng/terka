import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LIMITS, isThrottled, pruneAttempts, recordAttempt } from "@/lib/throttle";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("login / reset throttling", () => {
  it("blocks after the limit and frees up once the window passes", async () => {
    const now = new Date("2026-10-01T10:00:00Z");
    for (let i = 0; i < LIMITS.login.max - 1; i++) await recordAttempt(h.db, "login", "a@b.cz", now);
    expect(await isThrottled(h.db, "login", "a@b.cz", now)).toBe(false);
    await recordAttempt(h.db, "login", "a@b.cz", now);
    expect(await isThrottled(h.db, "login", "a@b.cz", now)).toBe(true);
    // other e-mail and other kind are unaffected
    expect(await isThrottled(h.db, "login", "c@d.cz", now)).toBe(false);
    expect(await isThrottled(h.db, "reset", "a@b.cz", now)).toBe(false);
    const later = new Date(now.getTime() + LIMITS.login.windowMs + 1000);
    expect(await isThrottled(h.db, "login", "a@b.cz", later)).toBe(false);
    await pruneAttempts(h.db, new Date(now.getTime() + 2 * 86_400_000));
    expect(await isThrottled(h.db, "login", "a@b.cz", now)).toBe(false);
  });
});
