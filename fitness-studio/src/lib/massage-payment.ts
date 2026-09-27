import type { MassageBooking } from "@/db/schema";
import { czIban, qrSvg, spdPayload } from "./qr-payment";

/** Bank transfer details for a massage booking, or null when no account is set. */
export async function transferDetails(b: Pick<MassageBooking, "price" | "variableSymbol" | "serviceName">, account: string) {
  const iban = czIban(account);
  if (!account.trim()) return null;
  const vs = String(b.variableSymbol ?? "");
  const qr = iban ? await qrSvg(spdPayload({ iban, amountHalere: b.price, vs, message: `Masaz ${b.serviceName}` })) : null;
  return { account: account.trim(), iban, vs, qr };
}

/** Bank transfer details for any payment (orders use their number as VS). */
export async function bankTransfer(opts: { amount: number; vs: number | string; message: string }, account: string) {
  if (!account.trim()) return null;
  const iban = czIban(account);
  const vs = String(opts.vs);
  const qr = iban ? await qrSvg(spdPayload({ iban, amountHalere: opts.amount, vs, message: opts.message })) : null;
  return { account: account.trim(), iban, vs, qr };
}
