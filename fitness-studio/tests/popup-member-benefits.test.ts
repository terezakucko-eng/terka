import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { content } from "@/db/schema";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const migrate = async () => {
  for (const statement of readFileSync("drizzle/0182_popup_member_benefits.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const text = async () => (await h.db.select().from(content).where(eq(content.key, "popupNext.text")))[0]?.value;

describe("migration 0182: member benefits in the Membership 2027 pop-up", () => {
  it("adds the year-round benefits to the end of the pop-up text, once", async () => {
    // all migrations ran
    const t = await text();
    expect(t).toMatch(/^Přihlas se ke členství na rok 2027 do 30\. 11\./);
    expect(t).toMatch(/Jako členka máš navíc spoustu výhod – infrasaunu zdarma, levnější masáže, slevy na akce a další\.$/);
    await migrate();
    expect(await text()).toBe(t);
  });

  it("leaves a text the studio wrote in Obsah webu alone", async () => {
    await h.db.update(content).set({ value: "Vlastní text studia" }).where(eq(content.key, "popupNext.text"));
    await migrate();
    expect(await text()).toBe("Vlastní text studia");
  });
});
