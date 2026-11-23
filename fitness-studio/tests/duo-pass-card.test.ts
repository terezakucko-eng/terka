import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes } from "@/db/schema";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const DUO = "d2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46";
const migrate = async () => {
  for (const statement of readFileSync("drizzle/0171_duo_pass_card.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};

describe("migration 0171: the pass card counts on Reformer Duo", () => {
  it("lets the card onto Duo, keeps the welcome entry off it", async () => {
    const [had] = await h.db.select().from(classTypes).where(eq(classTypes.id, DUO));
    if (had) await h.db.update(classTypes).set({ passCardEntry: false, noFreeEntry: true }).where(eq(classTypes.id, DUO));
    else await h.db.insert(classTypes).values({ id: DUO, name: "Reformer Duo", slug: "reformer-duo-card", capacity: 2, noFreeEntry: true, passCardEntry: false });
    await migrate();
    const [duo] = await h.db.select().from(classTypes).where(eq(classTypes.id, DUO));
    expect(duo).toMatchObject({ passCardEntry: true, noFreeEntry: true });
    await migrate();
    expect((await h.db.select().from(classTypes).where(eq(classTypes.id, DUO)))[0].passCardEntry).toBe(true);
  });
});
