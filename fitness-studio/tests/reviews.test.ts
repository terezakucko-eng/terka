import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reviews } from "@/db/schema";
import { approvedReviews, myReview, reviewStats, saveAdminReview, saveClientReview } from "@/domain/reviews";
import { makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("reviews", () => {
  it("one review per client, waiting for approval again after each change", async () => {
    const u = await makeUser(h.db);
    const r = await saveClientReview(h.db, u.id, { rating: 5, body: "Skvělé lekce a parta!", authorName: "Jana N." });
    expect(r.status).toBe("pending");
    expect(await approvedReviews(h.db)).toHaveLength(0);

    await h.db.update(reviews).set({ status: "approved" }).where(eq(reviews.id, r.id));
    expect(await approvedReviews(h.db)).toHaveLength(1);

    const again = await saveClientReview(h.db, u.id, { rating: 4, body: "Pořád skvělé, jen víc lekcí ráno.", authorName: "Jana N." });
    expect(again.id).toBe(r.id);
    expect(again.status).toBe("pending");
    expect((await myReview(h.db, u.id))?.rating).toBe(4);
    expect(await approvedReviews(h.db)).toHaveLength(0);
  });

  it("validates input", async () => {
    const u = await makeUser(h.db);
    await expect(saveClientReview(h.db, u.id, { rating: 0, body: "Dost dlouhý text", authorName: "A" })).rejects.toThrow(/hvězdiček/);
    await expect(saveClientReview(h.db, u.id, { rating: 5, body: "krátce", authorName: "A" })).rejects.toThrow(/pár slov/);
  });

  it("admin-added reviews are published and counted", async () => {
    await saveAdminReview(h.db, { rating: 5, body: "Nejlepší studio v Ostravě.", authorName: "Petra K.", source: "google" });
    await saveAdminReview(h.db, { rating: 4, body: "Moc příjemné prostředí.", authorName: "Eva", createdAt: new Date("2025-05-01T10:00:00Z") });
    const stats = await reviewStats(h.db);
    expect(stats).toEqual({ count: 2, average: 4.5 });
    const list = await approvedReviews(h.db, 3);
    expect(list[0].authorName).toBe("Petra K.");
    expect(list.find((r) => r.authorName === "Eva")?.source).toBe("manual");
  });
});
