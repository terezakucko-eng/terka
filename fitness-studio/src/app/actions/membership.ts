"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { endFlexibleMembership } from "@/domain/membership-fees";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { attempt, field, type FormState } from "@/lib/form";
import { notifyMembershipEnded } from "@/lib/notify";

/** Můj účet: the client ends a membership without commitment (at the end of the last paid month). */
export async function endMembershipAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/ucet");
  const res = await attempt(async () => {
    const db = await getDb();
    const end = await endFlexibleMembership(db, user.id, field.str(fd, "id"));
    const last = new Date(end.getTime() - 1);
    await notifyMembershipEnded(db, user, last);
    return `Hotovo. Členství platí do ${formatDate(last)} – do té doby cvič jako dosud. Budeme rádi, když se vrátíš 💛`;
  });
  revalidatePath("/ucet");
  return res;
}
