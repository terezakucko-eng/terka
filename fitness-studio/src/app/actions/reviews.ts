"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { saveClientReview } from "@/domain/reviews";
import { requireUser } from "@/lib/auth";
import { attempt, field, type FormState } from "@/lib/form";
import { getContent } from "@/content";
import { site } from "@/config/site";
import { sendMail } from "@/lib/mail";

export async function saveReviewAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/recenze");
  const res = await attempt(async () => {
    const r = await saveClientReview(await getDb(), user.id, {
      rating: field.int(fd, "rating") ?? 0,
      body: field.str(fd, "body"),
      authorName: field.str(fd, "authorName"),
    });
    // let the studio know there's something to approve
    const c = await getContent();
    await sendMail({
      to: c.raw("site.email") || site.email,
      subject: `Nová recenze ke schválení (${"★".repeat(r.rating)})`,
      text: `${r.authorName} (${user.email}):\n\n${r.body}\n\nSchválit: ${site.url}/admin/recenze`,
    }).catch((e) => console.error("[reviews] notify failed", e));
    return "Díky! Recenze se zobrazí, jakmile ji schválíme. A pokud chceš, zkopíruj ji i na Google (tlačítko níže) – moc nám to pomůže.";
  });
  revalidatePath("/recenze");
  return res;
}
