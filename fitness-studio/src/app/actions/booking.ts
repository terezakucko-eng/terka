"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { orders, users } from "@/db/schema";
import {
  bookSession,
  cancelBooking,
  joinWaitlist,
  type Method,
} from "@/domain/booking";
import { abandonOrder, createProductOrder, createSurchargeOrder, fulfillOrder } from "@/domain/orders";
import { requireUser } from "@/lib/auth";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { notifyBooked, notifyCancelled, notifyPromoted, notifyStrike } from "@/lib/notify";
import { afterMemberStrike, assertNotPaused } from "@/domain/strikes";
import { cardPayments, paymentProvider, startCheckout, type PayMethod } from "@/lib/payments";

const METHODS: Method[] = ["credits", "pass", "membership", "free", "drop_in", "free_class"];

/** Clients who registered before the health confirmation existed confirm it with their next booking. */
async function confirmHealth(user: { id: string; healthConfirmedAt: Date | null }, fd: FormData) {
  if (user.healthConfirmedAt) return;
  if (!field.bool(fd, "health")) throw new UserError("Potvrď prosím, že ti zdravotní stav cvičení dovoluje.");
  await (await getDb()).update(users).set({ healthConfirmedAt: new Date() }).where(eq(users.id, user.id));
}

export async function bookAction(_: FormState, fd: FormData): Promise<FormState> {
  const sessionId = field.str(fd, "sessionId");
  const user = await requireUser(`/rozvrh/${sessionId}`);
  const [method, entitlementId, pay] = field.str(fd, "option").split(":");
  const payMethod: PayMethod = pay === "card" && cardPayments() ? "card" : "transfer";
  let checkoutUrl: string | null = null;

  const res = await attempt(async () => {
    if (!METHODS.includes(method as Method)) throw new UserError("Vyber způsob platby.");
    await confirmHealth(user, fd);
    const db = await getDb();
    await assertNotPaused(db, user.id);
    const { booking, order } = await bookSession(db, {
      userId: user.id,
      sessionId,
      method: method as Method,
      entitlementId: entitlementId || undefined,
      payLater: payMethod === "transfer",
      guestName: field.str(fd, "guestName") || undefined,
    });
    if (order) {
      if (booking.status === "confirmed") await notifyBooked(db, booking);
      try {
        checkoutUrl = await startCheckout(db, order, user, null, payMethod);
      } catch (e) {
        await abandonOrder(db, order.id);
        throw e instanceof UserError ? e : new UserError("Platební brána teď není dostupná.");
      }
      return;
    }
    await notifyBooked(db, booking);
    return "Hotovo! Místo je tvoje. Potvrzení jsme poslali e-mailem.";
  });
  if (checkoutUrl) redirect(checkoutUrl);
  revalidatePath("/", "layout");
  return res;
}

export async function waitlistAction(_: FormState, fd: FormData): Promise<FormState> {
  const sessionId = field.str(fd, "sessionId");
  const user = await requireUser(`/rozvrh/${sessionId}`);
  const res = await attempt(async () => {
    await confirmHealth(user, fd);
    await assertNotPaused(await getDb(), user.id);
    await joinWaitlist(await getDb(), { userId: user.id, sessionId });
    return "Jsi v pořadníku. Jakmile se uvolní místo, automaticky tě přihlásíme a dáme vědět e-mailem.";
  });
  revalidatePath("/", "layout");
  return res;
}

export async function cancelBookingAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const res = await attempt(async () => {
    const db = await getDb();
    const r = await cancelBooking(db, { bookingId: field.str(fd, "bookingId"), actorId: user.id });
    if (r.booking.status !== "waitlist") await notifyCancelled(db, r.booking, r.refunded);
    await notifyPromoted(db, r.promoted);
    if (r.booking.method === "membership" && r.booking.status === "confirmed" && r.late && !r.refunded)
      await notifyStrike(db, user.id, await afterMemberStrike(db, user.id));
    if (r.booking.status === "waitlist") return "Odhlášeno z pořadníku.";
    return r.refunded
      ? "Rezervace zrušena, vstup máš zpátky na účtu."
      : "Rezervace zrušena. Storno proběhlo po lhůtě, vstup propadá.";
  });
  revalidatePath("/", "layout");
  return res;
}

export async function buyProductAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/cenik");
  let url: string | null = null;
  const res = await attempt(async () => {
    const db = await getDb();
    const { order, product } = await createProductOrder(db, {
      userId: user.id,
      productId: field.str(fd, "productId"),
    });
    url = await startCheckout(db, order, user, product, field.str(fd, "pay") === "card" && cardPayments() ? "card" : "transfer");
  });
  if (url) redirect(url);
  return res;
}

/** Member surcharge (Reformer, Individuál) – pay by card online or by bank transfer. */
export async function paySurchargeAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/ucet");
  let url: string | null = null;
  const res = await attempt(async () => {
    const db = await getDb();
    const order = await createSurchargeOrder(db, { userId: user.id, bookingId: field.str(fd, "bookingId") });
    const method: PayMethod = field.str(fd, "pay") === "card" && cardPayments() ? "card" : "transfer";
    try {
      url = await startCheckout(db, order, user, null, method);
    } catch (e) {
      throw e instanceof UserError ? e : new UserError("Platební brána teď není dostupná. Zkus to prosím za chvíli, nebo zaplať převodem.");
    }
  });
  if (url) redirect(url);
  return res;
}

/** Pays an open order again (membership fee from Můj účet or the transfer page) – card or transfer. */
export async function payOrderAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/ucet");
  let url: string | null = null;
  const res = await attempt(async () => {
    const db = await getDb();
    const [o] = await db.select().from(orders).where(eq(orders.id, field.str(fd, "orderId")));
    if (!o || o.userId !== user.id || o.kind !== "membership_fee") throw new UserError("Platba nenalezena.");
    if (o.status !== "pending") throw new UserError("Tahle platba už je vyřízená.");
    const method: PayMethod = field.str(fd, "pay") === "card" && cardPayments() ? "card" : "transfer";
    try {
      url = await startCheckout(db, o, user, null, method);
    } catch (e) {
      throw e instanceof UserError ? e : new UserError("Platební brána teď není dostupná. Zkus to prosím za chvíli, nebo zaplať převodem.");
    }
  });
  if (url) redirect(url);
  return res;
}

/** Test gateway (only without Stripe keys) – simulates a successful payment. */
export async function testPayAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (paymentProvider() !== "test") return { error: "Testovací platby jsou vypnuté." };
  const orderId = field.str(fd, "orderId");
  const db = await getDb();
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o || o.userId !== user.id) return { error: "Objednávka nenalezena." };
  if (field.str(fd, "result") === "cancel") {
    await abandonOrder(db, o.id);
    redirect(`/platba/vysledek?order=${o.id}&stav=zruseno`);
  }
  await fulfillOrder(db, { orderId: o.id, provider: "test", providerRef: `test_${o.id}` });
  revalidatePath("/", "layout");
  redirect(`/platba/vysledek?order=${o.id}&stav=ok`);
}

