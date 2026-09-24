"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { entitlements, orders } from "@/db/schema";
import {
  bookSession,
  cancelBooking,
  joinWaitlist,
  type Method,
} from "@/domain/booking";
import { abandonOrder, createProductOrder, fulfillOrder } from "@/domain/orders";
import { requireUser } from "@/lib/auth";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { notifyBooked, notifyCancelled, notifyPromoted } from "@/lib/notify";
import { cancelRenewal, paymentProvider, startCheckout } from "@/lib/payments";

const METHODS: Method[] = ["credits", "pass", "membership", "free", "drop_in", "free_class"];

export async function bookAction(_: FormState, fd: FormData): Promise<FormState> {
  const sessionId = field.str(fd, "sessionId");
  const user = await requireUser(`/rozvrh/${sessionId}`);
  const [method, entitlementId] = field.str(fd, "option").split(":");
  let checkoutUrl: string | null = null;

  const res = await attempt(async () => {
    if (!METHODS.includes(method as Method)) throw new UserError("Vyber způsob platby.");
    const db = await getDb();
    const { booking, order } = await bookSession(db, {
      userId: user.id,
      sessionId,
      method: method as Method,
      entitlementId: entitlementId || undefined,
    });
    if (order) {
      try {
        checkoutUrl = await startCheckout(db, order, user);
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
    if (!paymentProvider()) throw new UserError("Online platby zatím nejsou spuštěné – zastav se na recepci.");
    const { order, product } = await createProductOrder(db, {
      userId: user.id,
      productId: field.str(fd, "productId"),
    });
    url = await startCheckout(db, order, user, product);
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

export async function cancelMembershipAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const res = await attempt(async () => {
    const db = await getDb();
    const [e] = await db
      .select()
      .from(entitlements)
      .where(eq(entitlements.id, field.str(fd, "entitlementId")));
    if (!e || e.userId !== user.id || !e.subscriptionId)
      throw new UserError("Členství nenalezeno.");
    await cancelRenewal(e.subscriptionId);
    await db
      .update(entitlements)
      .set({ renewalCancelled: true })
      .where(eq(entitlements.subscriptionId, e.subscriptionId));
    return "Automatické obnovení je zrušené. Členství platí do konce zaplaceného období.";
  });
  revalidatePath("/ucet");
  return res;
}
