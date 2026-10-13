"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { fulfillOrder } from "@/domain/orders";
import { cancelVoucher, createVoucherOrder, markVoucherNotified } from "@/domain/vouchers";
import { requireAdmin } from "@/lib/auth";
import { attempt, field, type FormState } from "@/lib/form";
import { voucherChoice } from "@/lib/voucher-form";

/**
 * Admin → Poukazy: a voucher sold at the reception (already paid). The sale
 * counts in revenue under the chosen client, or under the admin's account.
 */
export async function issueVoucherAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const res = await attempt(async () => {
    const db = await getDb();
    const { order, voucher } = await createVoucherOrder(db, field.str(fd, "client") || admin.id, voucherChoice(fd));
    await fulfillOrder(db, { orderId: order.id, provider: "reception" });
    // handed over at the desk – no „your voucher is ready“ e-mail
    await markVoucherNotified(db, voucher.id);
    return "Poukaz vystaven – stáhni si ho v seznamu níže a vytiskni.";
  });
  revalidatePath("/admin/poukazy");
  return res;
}

export async function cancelVoucherAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const res = await attempt(async () => {
    await cancelVoucher(await getDb(), field.str(fd, "id"));
    return "Poukaz zrušen. Peníze vrať případně v Platbách.";
  });
  revalidatePath("/admin/poukazy");
  return res;
}
