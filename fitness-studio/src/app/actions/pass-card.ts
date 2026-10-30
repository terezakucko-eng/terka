"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { comeAlone, passOnUnused, recordPassCardScan } from "@/domain/pass-cards";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { attempt, field, type FormState } from "@/lib/form";
import { UserError } from "@/lib/errors";

/** „Přijdu sama“ – the friend's place goes to the next one, the card is charged again. */
export async function comeAloneAction(): Promise<FormState> {
  const user = await requireUser("/ucet");
  const res = await attempt(async () => {
    if (!(await comeAlone(await getDb(), user.id))) throw new UserError("Místo na kartičce už mezitím někdo využil.");
    return "Kartička je zase nabitá 🔋 – předej ji dál někomu novému.";
  });
  revalidatePath("/ucet");
  return res;
}

/** The card's page was opened (scanned, or a link to it followed) – the studio's own looks don't count. */
export async function passCardScanAction(code: string) {
  const user = await getCurrentUser();
  if (user && user.role !== "client") return;
  await recordPassCardScan(await getDb(), code, user?.id ?? null);
}

/** „Nezajímá mě – pošlu kartičku dál“: the card goes on charged with both places, then the thank-you. */
export async function passOnCardAction(fd: FormData) {
  const code = field.str(fd, "code").trim().toUpperCase();
  // only a newcomer's „no, thanks“ – someone with an account sees a different page
  if (!(await getCurrentUser())) await passOnUnused(await getDb(), code);
  redirect(`/karticka/${encodeURIComponent(code)}?ne`);
}
