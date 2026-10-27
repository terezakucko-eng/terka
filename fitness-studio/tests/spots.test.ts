import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookSession, seatsLeft } from "@/domain/booking";
import { isYes, sessionOf, spotsHint } from "@/lib/spots";
import { NOW, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("free places in the bar and the pop-up", () => {
  it("says how many are left, in Czech", () => {
    expect(spotsHint(0)).toMatch(/Obsazeno/);
    expect(spotsHint(1)).toBe("Zbývá poslední místo!");
    expect(spotsHint(3)).toBe("Zbývají už jen 3 místa!");
    expect(spotsHint(6)).toBe("Zbývá 6 volných míst");
  });

  it("recognises a link to one class and a yes", () => {
    expect(sessionOf("/rozvrh/3f3a2507-1b0e-48c3-a9d8-d7d0afc7a21c")).toBe("3f3a2507-1b0e-48c3-a9d8-d7d0afc7a21c");
    expect(sessionOf("https://www.octopush.fit/rozvrh/3f3a2507-1b0e-48c3-a9d8-d7d0afc7a21c?x=1")).toBe("3f3a2507-1b0e-48c3-a9d8-d7d0afc7a21c");
    expect(sessionOf("/cenik")).toBeUndefined();
    expect(isYes(" Ano ")).toBe(true);
    expect(isYes("")).toBe(false);
  });

  it("the count goes down when someone books", async () => {
    const s = await makeSession(h.db, { capacity: 3 });
    expect((await seatsLeft(h.db, [s.id], NOW)).get(s.id)).toBe(3);
    const u = await makeUser(h.db, 10);
    await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "credits" }, NOW);
    expect((await seatsLeft(h.db, [s.id], NOW)).get(s.id)).toBe(2);
  });
});
