import { paySurchargeAction } from "@/app/actions/booking";
import { cardPayments } from "@/lib/payments";
import { credits, formatPrice } from "@/lib/money";
import { surchargeCredits } from "@/domain/booking";
import { ActionForm, SubmitButton } from "./forms";

/** Unpaid surcharge (membership / pass): pay by card online or get the transfer details. */
export function SurchargePay({ bookingId, amount, compact, credit = 0 }: { bookingId: string; amount: number; compact?: boolean; credit?: number }) {
  const card = cardPayments();
  // enough credit on the account: pay it from there in one click (1 Kč = 1 kredit)
  const fromCredit = credit >= surchargeCredits(amount);
  return (
    <ActionForm action={paySurchargeAction} className={compact ? "flex flex-wrap items-center gap-2" : "mt-6 rounded-2xl bg-zlato/10 p-5"}>
      <input type="hidden" name="bookingId" value={bookingId} />
      {!compact && (
        <p className="mb-3 text-sm text-les/80">
          K lekci patří doplatek <strong>{formatPrice(amount)}</strong>. Zaplať ho prosím {fromCredit ? "z kreditu, " : ""}{card ? "kartou nebo převodem" : "převodem"} – na místě se neplatí.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {fromCredit && (
          <SubmitButton name="pay" value="credit" variant="gold" className={compact ? "px-3 py-2 text-[0.65rem]" : undefined}>
            {compact ? `Doplatek z kreditu (${surchargeCredits(amount)})` : `Z kreditu (${credits(surchargeCredits(amount))}, máš ${credit})`}
          </SubmitButton>
        )}
        {card && (
          <SubmitButton name="pay" value="card" variant={fromCredit ? "outline" : "gold"} className={compact ? "px-3 py-2 text-[0.65rem]" : undefined}>
            {compact ? `Doplatek ${formatPrice(amount)} – kartou` : "Zaplatit kartou"}
          </SubmitButton>
        )}
        <SubmitButton name="pay" value="transfer" variant="outline" className={compact ? "px-3 py-2 text-[0.65rem]" : undefined}>
          {compact ? (card ? "Převodem" : `Doplatek ${formatPrice(amount)} – převodem`) : "Převodem (QR)"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
