import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import {
  DAILY_WISHES,
  adminWishes,
  markWishesRead,
  newWishCount,
  publicWishes,
  publishWish,
  replyToWish,
  setWishResolved,
  submitWish,
  userWishes,
} from "@/domain/wishes";
import { NOW, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("Schránka přání a nápadů", () => {
  it("keeps private and anonymous messages private and publishes only allowed ones", async () => {
    const u = await makeUser(h.db);
    await h.db.update(users).set({ name: "Jana Nováková", nickname: null }).where(eq(users.id, u.id));
    const me = { ...u, name: "Jana Nováková", nickname: null };

    await expect(submitWish(h.db, me, { kind: "nonsense", body: "Ahoj", allowPublic: false, anonymous: false }, NOW)).rejects.toThrow();
    await expect(submitWish(h.db, me, { kind: "idea", body: "  ", allowPublic: false, anonymous: false }, NOW)).rejects.toThrow();

    const priv = await submitWish(h.db, me, { kind: "concern", body: "V šatně je zima.", allowPublic: false, anonymous: false }, NOW);
    const pub = await submitWish(h.db, me, { kind: "praise", body: "Nejlepší lekce ve městě!", allowPublic: true, anonymous: false }, NOW);
    const anon = await submitWish(h.db, me, { kind: "idea", body: "Sobotní ranní lekce?", allowPublic: true, anonymous: true }, NOW);
    expect(pub.signature).toBe("Jana");
    expect(anon.signature).toBeNull();
    expect(await newWishCount(h.db)).toBe(3);

    const admin = await adminWishes(h.db);
    expect(admin.find((w) => w.id === anon.id)?.author).toBeNull();
    expect(admin.find((w) => w.id === priv.id)?.author?.name).toBe("Jana Nováková");

    await expect(publishWish(h.db, priv.id, true)).rejects.toThrow();
    await publishWish(h.db, pub.id, true);
    await publishWish(h.db, anon.id, true);
    expect((await publicWishes(h.db)).map((w) => [w.body, w.signature]).sort()).toEqual(
      [["Nejlepší lekce ve městě!", "Jana"], ["Sobotní ranní lekce?", null]].sort(),
    );

    const replied = await replyToWish(h.db, priv.id, "Díky, přitopíme!", NOW);
    expect(replied.reply).toBe("Díky, přitopíme!");
    expect(replied.status).toBe("read");
    await setWishResolved(h.db, priv.id, true);
    await markWishesRead(h.db);
    expect(await newWishCount(h.db)).toBe(0);
    const mine = await userWishes(h.db, u.id);
    expect(mine.find((w) => w.id === priv.id)?.status).toBe("resolved");
  });

  it("limits how many messages a client sends per day", async () => {
    const u = await makeUser(h.db);
    for (let i = 0; i < DAILY_WISHES; i++)
      await submitWish(h.db, u, { kind: "wish", body: `Přání ${i}`, allowPublic: false, anonymous: false }, NOW);
    await expect(submitWish(h.db, u, { kind: "wish", body: "Ještě jedno", allowPublic: false, anonymous: false }, NOW)).rejects.toThrow();
    const tomorrow = new Date(NOW.getTime() + 25 * 3_600_000);
    await expect(submitWish(h.db, u, { kind: "wish", body: "Zítra", allowPublic: false, anonymous: false }, tomorrow)).resolves.toBeTruthy();
  });
});
