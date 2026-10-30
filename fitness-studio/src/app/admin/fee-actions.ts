"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { createMonthlyFees, isPeriod, periodLabel, recordPastFees } from "@/domain/membership-fees";
import { cancelVacation, discountText, planVacation } from "@/domain/vacations";
import { requireAdmin } from "@/lib/auth";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { formatPrice, pluralCs } from "@/lib/money";
import { notifyFee } from "@/lib/notify";

const period = (fd: FormData) => {
  const p = field.str(fd, "period");
  if (!isPeriod(p)) throw new UserError("Neplatný měsíc.");
  return p;
};

/** Admin → Příspěvky: create the month's fee requests (all members, or one). */
export async function createFeesAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const res = await attempt(async () => {
    const p = period(fd);
    const amountKc = field.int(fd, "amount") ?? 0;
    const userId = field.str(fd, "userId");
    if (amountKc <= 0 && !userId) throw new UserError("Vyplň částku.");
    const db = await getDb();
    const created = await createMonthlyFees(db, {
      period: p,
      amountKc,
      discountPct: field.int(fd, "discount") ?? 0,
      userIds: userId ? [userId] : undefined,
    });
    const sent = field.bool(fd, "send") || userId ? await notifyFee(db, created) : 0;
    if (!created.length) return `Za ${periodLabel(p)} už mají výzvu všichni členové.`;
    return `Výzvy za ${periodLabel(p)}: ${created.length}${sent ? `, e-mailem odesláno ${sent}` : " (bez e-mailu)"}.`;
  });
  revalidatePath("/admin/prispevky");
  return res;
}

/** Sends the payment request e-mail again. */
export async function remindFeeAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const [o] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, field.str(fd, "orderId")), eq(orders.kind, "membership_fee"), eq(orders.status, "pending")));
    if (!o) throw new UserError("Výzva nenalezena nebo už je zaplacená.");
    await notifyFee(db, [o]);
    return "Připomínka odeslána.";
  });
}

/** Client detail: membership fees paid outside the web (before it started, cash) → paid months. */
export async function recordPastFeesAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const userId = field.str(fd, "userId");
  const res = await attempt(async () => {
    if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new UserError("Klient nenalezen.");
    const db = await getDb();
    const r = await recordPastFees(db, {
      userId,
      from: field.str(fd, "from"),
      to: field.str(fd, "to"),
      amountKc: field.int(fd, "amount") ?? 0,
    });
    if (!r.recorded) return "Všechny vybrané měsíce už platbu nebo výzvu mají.";
    const months = (n: number) => pluralCs(n, "měsíc", "měsíce", "měsíců");
    const skipped = r.skipped ? ` (${months(r.skipped)} přeskočeno – už měly platbu nebo výzvu)` : "";
    return `Zapsáno jako zaplacené: ${months(r.recorded)}${skipped}.`;
  });
  revalidatePath(`/admin/klienti/${userId}`);
  revalidatePath("/admin/prispevky");
  return res;
}

/** Admin → klient: Program Dovolená planned by the studio – any time, beyond the yearly limit. */
export async function adminPlanVacationAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const userId = field.str(fd, "userId");
  const res = await attempt(async () => {
    const r = await planVacation(await getDb(), { userId, startsOn: field.str(fd, "startsOn"), byStudio: true });
    const n = r.cancelled.length;
    return `Dovolená ${r.label} naplánovaná.${r.discount > 0 ? ` Sleva ${discountText(r.discounts)}.` : ""}${n ? ` Zrušeno ${pluralCs(n, "lekce", "lekce", "lekcí")} v tom týdnu.` : ""}`;
  });
  revalidatePath(`/admin/klienti/${userId}`);
  return res;
}

/** Admin → klient: calls a vacation off – a paid lower fee gets a top-up request. */
export async function adminCancelVacationAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const res = await attempt(async () => {
    const r = await cancelVacation(await getDb(), { vacationId: field.str(fd, "id"), byStudio: true });
    return `Dovolená ${r.label} zrušená.${r.topUp > 0 ? ` Výzva na doplatek ${formatPrice(r.topUp)}.` : ""}`;
  });
  revalidatePath(`/admin/klienti/${field.str(fd, "userId")}`);
  return res;
}
