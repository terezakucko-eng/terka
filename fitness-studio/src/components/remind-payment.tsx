import { paySurchargeFromCreditAction, remindPaymentAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/forms";
import { surchargeCredits } from "@/domain/booking";
import { formatDateTime } from "@/lib/dates";
import { credits, formatPrice } from "@/lib/money";

/** Reception: remind a client of an unpaid drop-in / surcharge – e-mail and push with a link to pay. */
export function RemindPayment({ bookingId, orderId, remindedAt }: { bookingId?: string; orderId?: string; remindedAt?: Date | null }) {
  return (
    <ActionForm
      action={remindPaymentAction}
      confirm={remindedAt ? `Připomenuto už ${formatDateTime(remindedAt)}. Poslat připomínku znovu?` : "Poslat připomínku platby? Přijde e-mailem a do mobilu s odkazem, kde zaplatit."}
      className="mt-1 flex flex-wrap items-center gap-x-2"
    >
      {bookingId && <input type="hidden" name="bookingId" value={bookingId} />}
      {orderId && <input type="hidden" name="orderId" value={orderId} />}
      <button className="text-xs font-semibold text-zeme underline">🔔 Připomenout platbu</button>
      {remindedAt && <span className="text-xs text-les/50">připomenuto {formatDateTime(remindedAt)}</span>}
    </ActionForm>
  );
}

/** Admin: the client has credit for it – take the surcharge from there (1 Kč = 1 kredit). Shown only when the credit covers it. */
export function PayFromCredit({ bookingId, amount, credit }: { bookingId: string; amount: number; credit: number }) {
  const need = surchargeCredits(amount);
  if (credit < need) return null;
  return (
    <ActionForm
      action={paySurchargeFromCreditAction}
      confirm={`Strhnout doplatek ${formatPrice(amount)} z kreditu klienta (−${credits(need)}, má ${credit})? Otevřená platba převodem se zruší.`}
      className="mt-1"
    >
      <input type="hidden" name="bookingId" value={bookingId} />
      <button className="text-xs font-semibold text-zeme underline">💳 Zaplatit z kreditu ({credits(need)})</button>
    </ActionForm>
  );
}
