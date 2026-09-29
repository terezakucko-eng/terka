import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { users, type MassageBooking } from "@/db/schema";
import { site } from "@/config/site";
import { formatDay, formatTime } from "./dates";
import { sendMail } from "./mail";
import { sendEmail } from "./email-templates";
import { formatPrice } from "./money";
import { cardPayments } from "./payments";
import { greetName } from "@/lib/vocative";

const when = (b: MassageBooking) => `${formatDay(b.startsAt)} v ${formatTime(b.startsAt)}`;

async function recipient(db: DB, b: MassageBooking) {
  if (b.userId) {
    const [u] = await db.select({ email: users.email, name: users.name, bookingEmails: users.bookingEmails }).from(users).where(eq(users.id, b.userId));
    if (u) return u;
  }
  return b.guestEmail ? { email: b.guestEmail, name: b.guestName ?? "", bookingEmails: true } : null;
}

export async function notifyMassageBooked(db: DB, b: MassageBooking, bankAccount: string, studioEmail: string) {
  const u = await recipient(db, b);
  const pay =
    b.payment === "pass"
      ? "Platba permanentkou – strhl se 1 vstup (při včasném zrušení se vrátí)."
      : b.payment === "transfer"
      ? `Cena: ${formatPrice(b.price)}. ${b.paidAt ? "Zaplaceno." : `Zaplatit můžeš ${[cardPayments() && "kartou v detailu rezervace", bankAccount && `převodem na účet ${bankAccount}, variabilní symbol ${b.variableSymbol}`].filter(Boolean).join(" nebo ")}.`}`
      : `Platba na místě: ${formatPrice(b.price)}.`;
  // payment instructions always go out; a plain confirmation only when wanted
  // (the reception's booking passes no studio e-mail – then the client is always told)
  const needsPayment = b.payment !== "pass" && !b.paidAt;
  if (u && (u.bookingEmails || needsPayment || !studioEmail))
    await sendEmail(u.email, "massageBooked", {
      osloveni: greetName(u.name),
      masaz: b.serviceName,
      termin: when(b),
      platba: pay,
      odkaz: `${site.url}/masaze/rezervace/${b.id}`,
    });
  if (studioEmail)
    await sendMail({
      to: studioEmail,
      subject: `Nová masáž: ${b.serviceName}, ${when(b)}`,
      text: `${u?.name ?? b.guestName ?? "Klient"} (${u?.email ?? b.guestPhone ?? ""})\n${b.serviceName}, ${when(b)}\n${b.payment === "pass" ? "Permanentkou" : b.payment === "transfer" ? `Online (karta/převod), VS ${b.variableSymbol}` : "Na místě"}${b.note ? `\nPoznámka: ${b.note}` : ""}\n\n${site.url}/admin/masaze`,
    });
}

export async function notifyMassageCancelled(db: DB, b: MassageBooking, studioEmail: string, byStudio: boolean) {
  const u = await recipient(db, b);
  const refund = b.paidAt ? "\nZaplacenou částku ti vrátíme." : "";
  if (u && (byStudio || u.bookingEmails))
    await sendEmail(u.email, "massageCancelled", {
      osloveni: greetName(u.name),
      kdo_zrusil: byStudio ? "musíme bohužel zrušit" : "zrušili jsme",
      masaz: b.serviceName,
      termin: when(b),
      vraceni: refund.trim(),
      odkaz: `${site.url}/masaze`,
    });
  if (!byStudio && studioEmail)
    await sendMail({
      to: studioEmail,
      subject: `Zrušená masáž: ${b.serviceName}, ${when(b)}`,
      text: `Masáž ${b.serviceName}, ${when(b)} byla zrušena online (${u?.name ?? b.guestName ?? ""}).${b.paidAt ? "\nByla zaplacená – vrať platbu (kartou přes Stripe, převodem na účet)." : ""}`,
    });
}
