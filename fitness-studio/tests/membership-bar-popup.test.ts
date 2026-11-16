import { readFileSync } from "node:fs";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { content } from "@/db/schema";
import { popupSlot } from "@/lib/popup-seen";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const migrate = async () => {
  for (const statement of readFileSync("drizzle/0161_membership_bar_popup_now.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const values = async (keys: string[]) =>
  Object.fromEntries((await h.db.select().from(content).where(inArray(content.key, keys))).map((r) => [r.key, r.value]));

describe("migration 0161: Membership 2027 in the bar and the pop-up from today", () => {
  it("shows the membership pop-up from 16 Nov and puts membership back in the bar instead of the Zumba SPECIAL", async () => {
    // all migrations ran: the Zumba SPECIAL bar and the pop-up planned for 17 Nov were switched
    const next = await values(["popupNext.from", "popupNext.title"]);
    expect(next["popupNext.from"]).toBe("2026-11-16");
    expect(popupSlot({ title: next["popupNext.title"], from: next["popupNext.from"] }, "2026-11-16")).toBe("popupNext");
    expect(await values(["promoBar.text", "promoBar.linkLabel", "promoBar.linkUrl", "promoBar.until", "promoBar.showSpots"])).toEqual({
      "promoBar.text": "🎁 Členství na rok 2027: přihlas se do 30. 11. a v prosinci přijde Fitness Ježíšek 🎅",
      "promoBar.linkLabel": "Všechno na nástěnce",
      "promoBar.linkUrl": "/nastenka#ec9596c8-12e0-4cf2-97ff-d54610740a2d",
      "promoBar.until": "2026-11-30",
      "promoBar.showSpots": "",
    });
  });

  it("leaves what the studio set in Obsah webu alone", async () => {
    await h.db.update(content).set({ value: "🎄 Vlastní lišta studia" }).where(eq(content.key, "promoBar.text"));
    await h.db.update(content).set({ value: "2026-11-20" }).where(eq(content.key, "popupNext.from"));
    await migrate();
    expect(await values(["promoBar.text", "popupNext.from"])).toEqual({ "promoBar.text": "🎄 Vlastní lišta studia", "popupNext.from": "2026-11-20" });
  });
});
