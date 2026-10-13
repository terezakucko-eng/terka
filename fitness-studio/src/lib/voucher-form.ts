import type { VoucherChoice } from "@/domain/vouchers";
import { UserError } from "./errors";
import { field } from "./form";

/** „item“ is a product id, or amount-<Kč> / amount-custom with the amount in „customKc“. */
export function voucherChoice(fd: FormData): VoucherChoice {
  const item = field.str(fd, "item");
  if (!item) throw new UserError("Vyber, co chceš darovat.");
  const base = { recipientName: field.str(fd, "recipientName"), message: field.str(fd, "message") };
  if (!item.startsWith("amount-")) return { ...base, productId: item };
  const kc = item === "amount-custom" ? field.int(fd, "customKc") : Number(item.slice(7));
  return { ...base, amountKc: kc ?? 0 };
}
