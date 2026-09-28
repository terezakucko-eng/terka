"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { backups } from "@/db/schema";
import { createBackup } from "@/domain/backup";
import { requireAdmin } from "@/lib/auth";
import { attempt, field, type FormState } from "@/lib/form";

export async function backupNowAction(): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    await createBackup(await getDb(), "manual");
    revalidatePath("/admin/nastaveni");
    return "Záloha je hotová – můžeš si ji stáhnout.";
  });
}

export async function deleteBackupAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    await (await getDb()).delete(backups).where(eq(backups.id, field.str(fd, "id")));
    revalidatePath("/admin/nastaveni");
    return "Záloha smazána.";
  });
}
