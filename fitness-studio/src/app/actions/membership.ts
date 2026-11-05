"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { endFlexibleMembership, periodStartLabel, switchMembership } from "@/domain/membership-fees";
import { cancelVacation, discountText, planVacation } from "@/domain/vacations";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
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

/** Můj účet: Zmražení členství – the member freezes a week. */
export async function planVacationAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/ucet");
  const res = await attempt(async () => {
    const r = await planVacation(await getDb(), { userId: user.id, startsOn: field.str(fd, "startsOn") });
    const saved = r.discount > 0 ? ` Ušetříš ${discountText(r.discounts)}.` : "";
    const n = r.cancelled.length;
    const classes = n ? ` ${n === 1 ? "Lekci" : "Lekce"} v tom týdnu (${n}) jsme ti zrušili a vstupy vrátili.` : "";
    return `Hotovo! Členství máš zmražené ${r.label}.${saved}${classes} Ať se ti daří a brzy na viděnou 💛`;
  });
  revalidatePath("/ucet");
  return res;
}

/** Můj účet: the member calls a frozen week off (until it starts). */
export async function cancelVacationAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/ucet");
  const res = await attempt(async () => {
    const r = await cancelVacation(await getDb(), { vacationId: field.str(fd, "id"), userId: user.id });
    return r.topUp > 0
      ? `Zmražení ${r.label} je zrušené. Sníženou platbu už máš zaplacenou, tak ti přišla výzva na doplatek ${formatPrice(r.topUp)}.`
      : `Zmražení ${r.label} je zrušené – platba je zase v plné výši a na lekce se můžeš přihlásit.`;
  });
  revalidatePath("/ucet");
  return res;
}
