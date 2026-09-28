import { desc, eq, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { reviews, type Review } from "@/db/schema";
import { UserError } from "@/lib/errors";

export const MAX_REVIEW = 1500;

function clean(input: { rating: number; body: string; authorName: string }) {
  const rating = Math.round(input.rating);
  if (!(rating >= 1 && rating <= 5)) throw new UserError("Vyber počet hvězdiček (1–5).");
  const body = input.body.replace(/\r\n/g, "\n").trim();
  if (body.length < 10) throw new UserError("Napiš prosím aspoň pár slov.");
  if (body.length > MAX_REVIEW) throw new UserError(`Recenze je moc dlouhá (max. ${MAX_REVIEW} znaků).`);
  const authorName = input.authorName.trim();
  if (!authorName) throw new UserError("Vyplň jméno.");
  return { rating, body, authorName: authorName.slice(0, 80) };
}

/** A client's own review: one per client, every change waits for approval again. */
export async function saveClientReview(db: Executor, userId: string, input: { rating: number; body: string; authorName: string }) {
  const v = clean(input);
  const [r] = await db
    .insert(reviews)
    .values({ ...v, userId, source: "web", status: "pending" })
    .onConflictDoUpdate({
      target: reviews.userId,
      set: { ...v, status: "pending", updatedAt: new Date() },
    })
    .returning();
  return r;
}

/** Admin: adds a review from Google / the old website, or edits any review. */
export async function saveAdminReview(
  db: Executor,
  input: { id?: string; rating: number; body: string; authorName: string; source?: Review["source"]; createdAt?: Date | null },
) {
  const v = clean(input);
  if (input.id) {
    await db
      .update(reviews)
      .set({ ...v, ...(input.createdAt ? { createdAt: input.createdAt } : {}), updatedAt: new Date() })
      .where(eq(reviews.id, input.id));
    return;
  }
  await db.insert(reviews).values({
    ...v,
    source: input.source ?? "manual",
    status: "approved",
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
  });
}

export const approvedReviews = (db: Executor, limit?: number) => {
  const q = db
    .select()
    .from(reviews)
    .where(eq(reviews.status, "approved"))
    .orderBy(desc(reviews.isFeatured), desc(reviews.createdAt));
  return limit ? q.limit(limit) : q;
};

export async function reviewStats(db: Executor) {
  const [r] = await db
    .select({ count: sql<number>`count(*)::int`, avg: sql<number | null>`avg(${reviews.rating})::float` })
    .from(reviews)
    .where(eq(reviews.status, "approved"));
  return { count: r.count, average: r.avg ? Math.round(r.avg * 10) / 10 : null };
}

export async function myReview(db: Executor, userId: string) {
  const [r] = await db.select().from(reviews).where(eq(reviews.userId, userId));
  return r ?? null;
}

/** "1 recenze", "3 recenze", "5 recenzí" */
export const reviewsLabel = (n: number) => `${n} ${n >= 1 && n <= 4 ? "recenze" : "recenzí"}`;
