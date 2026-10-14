"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { endFlexibleMembership, periodStartLabel, switchMembership } from "@/domain/membership-fees";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { notifyMembershipEnded, notifyMembershipSwitched } from "@/lib/notify";

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

/** Můj účet: the client switches to a higher membership (e.g. Členství Reformer) from the next month. */
export async function switchMembershipAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/ucet");
  let switched = false;
  const res = await attempt(async () => {
    if (!field.bool(fd, "agree")) throw new UserError("Potvrď prosím změnu zaškrtnutím.");
    const db = await getDb();
    const done = await switchMembership(db, user.id, field.str(fd, "id"), field.str(fd, "productId"));
    await notifyMembershipSwitched(db, user, { from: done.previous, to: done.product.name, price: done.product.price, since: periodStartLabel(done.period) });
    switched = true;
  });
  revalidatePath("/ucet");
  // the offer (and its form) disappears once switched – the account says so instead
  if (switched) redirect("/ucet?clenstvi=zmena");
  return res;
}
