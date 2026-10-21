"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { comeAlone } from "@/domain/pass-cards";
import { requireUser } from "@/lib/auth";
import { attempt, type FormState } from "@/lib/form";
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
