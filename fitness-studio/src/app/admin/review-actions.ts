"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { reviews } from "@/db/schema";
import { saveAdminReview } from "@/domain/reviews";
import { requireAdmin } from "@/lib/auth";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { pragueLocalToDate } from "@/lib/dates";

const refresh = () => {
  revalidatePath("/", "layout");
};

export async function saveReviewAdminAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const date = field.str(fd, "date");
    const source = field.str(fd, "source");
    await saveAdminReview(await getDb(), {
      id: field.str(fd, "id") || undefined,
      rating: field.int(fd, "rating") ?? 0,
      body: field.str(fd, "body"),
      authorName: field.str(fd, "authorName"),
      source: source === "google" ? "google" : "manual",
      createdAt: /^\d{4}-\d{2}-\d{2}$/.test(date) ? pragueLocalToDate(`${date}T12:00`) : null,
    });
    refresh();
    return "Recenze uložena.";
  });
}

/** Schválit / skrýt / zvýraznit / smazat – one form, the button says which. */
export async function reviewStatusAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const id = field.str(fd, "id");
    const [r] = await db.select().from(reviews).where(eq(reviews.id, id));
    if (!r) throw new UserError("Recenze nenalezena.");
    const doIt = field.str(fd, "do");
    if (doIt === "delete") await db.delete(reviews).where(eq(reviews.id, id));
    else if (doIt === "approve") await db.update(reviews).set({ status: "approved" }).where(eq(reviews.id, id));
    else if (doIt === "hide") await db.update(reviews).set({ status: "hidden", isFeatured: false }).where(eq(reviews.id, id));
    else if (doIt === "feature") await db.update(reviews).set({ isFeatured: !r.isFeatured, status: "approved" }).where(eq(reviews.id, id));
    else throw new UserError("Neznámá akce.");
    refresh();
    return { delete: "Smazáno.", approve: "Schváleno – je na webu.", hide: "Skryto.", feature: r.isFeatured ? "Už není zvýrazněná." : "Zvýrazněno na úvodní stránce." }[doIt];
  });
}
