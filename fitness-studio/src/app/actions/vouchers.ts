"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { createVoucherOrder, redeemVoucher, voucherContents } from "@/domain/vouchers";
import { voucherChoice } from "@/lib/voucher-form";
import { requireUser } from "@/lib/auth";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { cardPayments, startCheckout } from "@/lib/payments";
import { isThrottled, recordAttempt } from "@/lib/throttle";

/** Dárkové poukazy: the signed-in client buys a voucher (card or transfer). */
export async function buyVoucherAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/poukazy");
  let url: string | null = null;
  const res = await attempt(async () => {
    const db = await getDb();
    const { order } = await createVoucherOrder(db, user.id, voucherChoice(fd));
    url = await startCheckout(db, order, user, null, field.str(fd, "pay") === "card" && cardPayments() ? "card" : "transfer");
  });
  if (url) redirect(url);
  return res;
}

/** Můj účet / /poukaz: the client redeems a voucher code. */
export async function redeemVoucherAction(_: FormState, fd: FormData): Promise<FormState> {
  const code = field.str(fd, "code");
  const user = await requireUser(`/poukaz?kod=${encodeURIComponent(code)}`);
  const res = await attempt(async () => {
    const db = await getDb();
    if (await isThrottled(db, "voucher", user.id))
      throw new UserError("Moc pokusů s neplatným kódem. Zkus to prosím za hodinu, nebo se ozvi na recepci.");
    try {
      const v = await redeemVoucher(db, code, user.id);
      return `Hotovo! 🎁 Na účet jsme ti připsali: ${voucherContents(v)}.`;
    } catch (e) {
      await recordAttempt(db, "voucher", user.id);
      throw e;
    }
  });
  revalidatePath("/ucet");
  return res;
}
