"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { setAiImages } from "@/lib/ai-images";
import { attempt, field, type FormState } from "@/lib/form";

/** Admin → Obrázky (AI): mark pictures as made with AI (one, or all listed). */
export async function aiImageAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const res = await attempt(async () => {
    const srcs = fd.getAll("src").filter((v): v is string => typeof v === "string");
    const on = field.bool(fd, "on");
    await setAiImages(await getDb(), srcs, on);
    return on ? "Označeno – na webu se u obrázku ukáže „Ilustrační foto · AI“." : "Označení zrušeno.";
  });
  revalidatePath("/", "layout");
  return res;
}
