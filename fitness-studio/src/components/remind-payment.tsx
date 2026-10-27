import { remindPaymentAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/forms";
import { formatDateTime } from "@/lib/dates";

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
