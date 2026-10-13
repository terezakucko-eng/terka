import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aiImageList, setAiImages } from "@/lib/ai-images";
import { getSettings } from "@/lib/settings";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("AI images", () => {
  it("marks and unmarks pictures without touching the business settings", async () => {
    expect(await aiImageList(h.db)).toEqual([]);
    await setAiImages(h.db, ["/media/b.webp", " /media/a.webp ", ""], true);
    await setAiImages(h.db, ["/media/a.webp"], true);
    expect(await aiImageList(h.db)).toEqual(["/media/a.webp", "/media/b.webp"]);
    await setAiImages(h.db, ["/media/b.webp"], false);
    expect(await aiImageList(h.db)).toEqual(["/media/a.webp"]);
    expect((await getSettings(h.db)).cancellationHours).toBe(12);
  });
});
