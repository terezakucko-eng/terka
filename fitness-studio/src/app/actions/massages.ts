"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { massageServices } from "@/db/schema";
import { bookMassage, cancelMassage } from "@/domain/massages";
import { createMassageOrder } from "@/domain/orders";
import { cardPayments, startCheckout } from "@/lib/payments";
import { requireUser } from "@/lib/auth";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { notifyMassageBooked, notifyMassageCancelled } from "@/lib/notify-massage";

export async function bookMassageAction(_: FormState, fd: FormData): Promise<FormState> {
  const db = await getDb();
  const [service] = await db.select().from(massageServices).where(eq(massageServices.id, field.str(fd, "serviceId")));
  const user = await requireUser(service ? `/masaze/${service.slug}` : "/masaze");
  let bookingId: string | null = null;
  let checkoutUrl: string | null = null;
  const res = await attempt(async () => {
    if (!service) throw new UserError("Tahle masáž už není v nabídce.");
    const slot = field.str(fd, "slot");
    if (!slot || Number.isNaN(Date.parse(slot))) throw new UserError("Vyber si čas.");
    const c = await getContent();
    const bankAccount = c("massages.bankAccount").trim();
    const chosen = field.str(fd, "payment");
    const card = chosen === "card" && cardPayments();
    // Paid online – by card right away, or by transfer. On site only when neither is set up.
    const payment = chosen === "pass" ? "pass" : card || bankAccount ? "transfer" : "on_site";
    const b = await bookMassage(db, {
      userId: user.id,
      serviceId: service.id,
      startsAt: new Date(slot),
      payment,
      note: field.optional(fd, "note"),
    });
    await notifyMassageBooked(db, b, bankAccount, c("site.email"));
    bookingId = b.id;
    if (card) {
      try {
        checkoutUrl = await startCheckout(db, await createMassageOrder(db, { userId: user.id, bookingId: b.id }), user, null, "card");
      } catch {
        // the booking stands; the detail page offers card or transfer again
      }
    }
  });
  if (checkoutUrl) redirect(checkoutUrl);
  if (bookingId) {
    revalidatePath("/", "layout");
    redirect(`/masaze/rezervace/${bookingId}?nova=1`);
  }
  return res;
}

/** Pays an online-booked massage by card (Stripe). */
export async function payMassageAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/ucet");
  let url: string | null = null;
  const res = await attempt(async () => {
    if (!cardPayments()) throw new UserError("Platba kartou teď není dostupná, zaplať prosím převodem.");
    const db = await getDb();
    const order = await createMassageOrder(db, { userId: user.id, bookingId: field.str(fd, "bookingId") });
    try {
      url = await startCheckout(db, order, user, null, "card");
    } catch (e) {
      throw e instanceof UserError ? e : new UserError("Platební brána teď není dostupná. Zkus to prosím za chvíli, nebo zaplať převodem.");
    }
  });
  if (url) redirect(url);
  return res;
}

export async function cancelMassageAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const res = await attempt(async () => {
    const db = await getDb();
    const b = await cancelMassage(db, { bookingId: field.str(fd, "bookingId"), actorId: user.id });
    await notifyMassageCancelled(db, b, (await getContent())("site.email"), false);
    if (b.entitlementId) return "Masáž zrušena. Vstup se ti vrátil na permanentku.";
    return b.paidAt ? "Masáž zrušena. Zaplacenou částku ti vrátíme." : "Masáž zrušena.";
  });
  revalidatePath("/", "layout");
  return res;
}
