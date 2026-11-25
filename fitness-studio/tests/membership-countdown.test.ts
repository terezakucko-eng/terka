import { readFileSync } from "node:fs";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { content } from "@/db/schema";
import { nextDeadline, parseCountdown } from "@/lib/countdown";
import { pragueLocalToDate } from "@/lib/dates";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const migrate = async () => {
  for (const statement of readFileSync("drizzle/0181_membership_countdown.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const KEYS = ["promoBar.text", "promoBar.linkLabel", "promoBar.linkUrl", "promoBar.until", "promoBar.countdown", "popupNext.countdown"];
const values = async () => Object.fromEntries((await h.db.select().from(content).where(inArray(content.key, KEYS))).map((r) => [r.key, r.value]));
const BAR = "🎅 Fitness Ježíšek už balí dárky pro členky 2027 – přihlas se do 30. 11.";

describe("migration 0181: countdown to the end of the Membership 2027 offer", () => {
  it("puts a countdown in the bar and the pop-up – Ježíšek until 30 Nov, then 4× Reformer until the end of the year", async () => {
    // all migrations ran
    const v = await values();
    expect(v).toMatchObject({
      "promoBar.text": BAR,
      "promoBar.linkLabel": "Chci členství",
      "promoBar.linkUrl": "/cenik?rok=2027",
      "promoBar.until": "2026-11-30",
      "promoBar.countdown": "2026-11-30 | zbývá",
    });
    const bar = parseCountdown(v["promoBar.countdown"]);
    expect(bar).toEqual([{ at: pragueLocalToDate("2026-12-01T00:00").getTime(), label: "zbývá" }]);
    const popup = parseCountdown(v["popupNext.countdown"]);
    expect(nextDeadline(popup, pragueLocalToDate("2026-11-25T12:00").getTime())?.label).toBe("🎅 Přihlášky pro Fitness Ježíška končí za");
    expect(nextDeadline(popup, pragueLocalToDate("2026-12-01T00:00").getTime())?.label).toBe("🎁 4× Reformer bez doplatku – přihlášky končí za");
    expect(nextDeadline(popup, pragueLocalToDate("2027-01-01T00:00").getTime())).toBeNull();

    await migrate();
    expect(await values()).toEqual(v);
  });

  it("leaves what the studio set in Obsah webu alone", async () => {
    await h.db.update(content).set({ value: "🎄 Vlastní lišta studia" }).where(eq(content.key, "promoBar.text"));
    await h.db.update(content).set({ value: "2026-12-24 | do Vánoc" }).where(eq(content.key, "popupNext.countdown"));
    await h.db.delete(content).where(eq(content.key, "promoBar.countdown"));
    await migrate();
    const v = await values();
    expect(v["promoBar.text"]).toBe("🎄 Vlastní lišta studia");
    expect(v["promoBar.countdown"]).toBeUndefined();
    expect(v["popupNext.countdown"]).toBe("2026-12-24 | do Vánoc");
  });
});
