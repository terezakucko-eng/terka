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
