import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { users, type MassageBooking } from "@/db/schema";
import { site } from "@/config/site";
import { formatDay, formatTime } from "./dates";
import { sendMail } from "./mail";
import { formatPrice } from "./money";

const when = (b: MassageBooking) => `${formatDay(b.startsAt)} v ${formatTime(b.startsAt)}`;

async function recipient(db: DB, b: MassageBooking) {
  if (b.userId) {
    const [u] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, b.userId));
    if (u) return u;
  }
  return b.guestEmail ? { email: b.guestEmail, name: b.guestName ?? "" } : null;
}

export async function notifyMassageBooked(db: DB, b: MassageBooking, bankAccount: string, studioEmail: string) {
  const u = await recipient(db, b);
  const pay =
    b.payment === "pass"
      ? "Platba permanentkou – strhl se 1 vstup (při včasném zrušení se vrátí)."
      : b.payment === "transfer" && bankAccount
      ? `Platba převodem: ${formatPrice(b.price)} na účet ${bankAccount}, variabilní symbol ${b.variableSymbol}.\nQR kód najdeš v detailu rezervace.`
      : `Platba na místě (kartou): ${formatPrice(b.price)}.`;
  if (u)
    await sendMail({
      to: u.email,
      subject: `Masáž potvrzena: ${when(b)}`,
      text: `Ahoj ${u.name},\n\ntěšíme se na tebe – ${b.serviceName}, ${when(b)}.\n${pay}\n\nDetail a případné zrušení: ${site.url}/masaze/rezervace/${b.id}`,
    });
  if (studioEmail)
    await sendMail({
      to: studioEmail,
      subject: `Nová masáž: ${b.serviceName}, ${when(b)}`,
      text: `${u?.name ?? b.guestName ?? "Klient"} (${u?.email ?? b.guestPhone ?? ""})\n${b.serviceName}, ${when(b)}\n${b.payment === "pass" ? "Permanentkou" : b.payment === "transfer" ? `Převodem, VS ${b.variableSymbol}` : "Na místě"}${b.note ? `\nPoznámka: ${b.note}` : ""}\n\n${site.url}/admin/masaze`,
    });
}

export async function notifyMassageCancelled(db: DB, b: MassageBooking, studioEmail: string, byStudio: boolean) {
  const u = await recipient(db, b);
  const refund = b.paidAt ? "\nZaplacenou částku ti vrátíme převodem." : "";
  if (u)
    await sendMail({
      to: u.email,
      subject: `Masáž zrušena: ${when(b)}`,
      text: `Ahoj ${u.name},\n\n${byStudio ? "musíme bohužel zrušit" : "zrušili jsme"} tvoji masáž ${b.serviceName}, ${when(b)}.${refund}\n\nNový termín si můžeš vybrat na ${site.url}/masaze`,
    });
  if (!byStudio && studioEmail)
    await sendMail({
      to: studioEmail,
      subject: `Zrušená masáž: ${b.serviceName}, ${when(b)}`,
      text: `Masáž ${b.serviceName}, ${when(b)} byla zrušena online (${u?.name ?? b.guestName ?? ""}).${b.paidAt ? "\nByla zaplacená převodem – vrať platbu." : ""}`,
    });
}
