import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { announcements } from "@/db/schema";
import { placesLeftLabel } from "@/lib/price-list";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("places left in a limited membership", () => {
  it("says it so it moves people, in proper Czech", () => {
    expect([1, 2, 3, 4, 5].map((n) => placesLeftLabel(n))).toEqual([
      "Zbývá už jen 1 volné členství",
      "Zbývají už jen 2 volná členství",
      "Zbývají už jen 3 volná členství",
      "Zbývají už jen 4 volná členství",
      "Zbývá ještě 5 volných členství",
    ]);
  });

  it("migration 0091: the board post says only 3 are left", async () => {
    const [post] = await h.db.select().from(announcements).where(eq(announcements.id, "1dd44d7a-151f-4695-8a47-a11e64aa898f"));
    expect(post.title).toBe("🔥 Členství Reformer od 1. 1. 2027 – zbývají už jen 3!");
    expect(post.body).toContain("Zbývají už jen 3 volná členství na rok 2027!");
    expect(post.body).not.toContain("Jen 4 členství");
    await h.db.execute(sql.raw(readFileSync("drizzle/0091_reformer_places_left.sql", "utf8"))); // safe to repeat
    expect((await h.db.select().from(announcements).where(eq(announcements.id, post.id)))[0].body).toBe(post.body);
  });
});
