import "server-only";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import type { DB } from "@/db";
import { orders, users, type Order, type Product, type User } from "@/db/schema";
import { site } from "@/config/site";
import {
  abandonOrder,
  fulfillOrder,
  markSubscriptionCancelled,
  renewMembership,
} from "@/domain/orders";

/**
 * Payment gateway. Production uses Stripe Checkout (karty, Apple Pay,
 * Google Pay; CZK). Without STRIPE_SECRET_KEY a local test gateway is used,
 * which is disabled in production unless ALLOW_TEST_PAYMENTS=true.
 */
export function paymentProvider(): "stripe" | "test" | null {
  if (process.env.STRIPE_SECRET_KEY) return "stripe";
  if (process.env.NODE_ENV !== "production" || process.env.ALLOW_TEST_PAYMENTS === "true")
    return "test";
  return null;
}

let _stripe: Stripe | null = null;
function stripe() {
  _stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

/** Returns the URL to send the client to for payment. */
export async function startCheckout(
  db: DB,
  order: Order,
  user: User,
  product?: Product | null,
): Promise<string> {
  const provider = paymentProvider();
  if (!provider) throw new Error("Online platby nejsou nastavené.");

  if (provider === "test") {
    await db.update(orders).set({ provider: "test" }).where(eq(orders.id, order.id));
    return `/platba/test?order=${order.id}`;
  }

  const recurring = product?.kind === "membership" && product.recurring;
  const returnUrl = `${site.url}/platba/vysledek?order=${order.id}`;
  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = {
    quantity: 1,
    price_data: {
      currency: "czk",
      unit_amount: order.amount,
      product_data: { name: order.description },
      ...(recurring ? { recurring: { interval: "month" as const } } : {}),
    },
  };

  const customer = await ensureCustomer(db, user);
  const session = await stripe().checkout.sessions.create({
    mode: recurring ? "subscription" : "payment",
    customer,
    line_items: [lineItem],
    client_reference_id: order.id,
    metadata: { orderId: order.id },
    ...(recurring
      ? { subscription_data: { metadata: { orderId: order.id } } }
      : { payment_intent_data: { metadata: { orderId: order.id } } }),
    locale: "cs",
    success_url: `${returnUrl}&stav=ok`,
    cancel_url: `${returnUrl}&stav=zruseno`,
    ...(order.expiresAt
      ? {
          expires_at: Math.max(
            Math.floor(order.expiresAt.getTime() / 1000),
            Math.floor(Date.now() / 1000) + 31 * 60,
          ),
        }
      : {}),
  });

  await db
    .update(orders)
    .set({ provider: "stripe", providerRef: session.id })
    .where(eq(orders.id, order.id));
  return session.url!;
}

async function ensureCustomer(db: DB, user: User) {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const c = await stripe().customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });
  await db.update(users).set({ stripeCustomerId: c.id }).where(eq(users.id, user.id));
  return c.id;
}

export async function cancelRenewal(subscriptionId: string) {
  if (paymentProvider() !== "stripe") return;
  await stripe().subscriptions.update(subscriptionId, { cancel_at_period_end: true });
}

const subscriptionOf = (inv: Stripe.Invoice) => {
  const sub = inv.parent?.subscription_details?.subscription;
  return typeof sub === "string" ? sub : (sub?.id ?? null);
};

/** Verifies and processes a Stripe webhook. */
export async function handleStripeWebhook(db: DB, rawBody: string, signature: string) {
  const event = stripe().webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      const orderId = s.metadata?.orderId;
      if (!orderId || s.payment_status === "unpaid") break;
      let periodEnd: Date | null = null;
      const subscriptionId =
        typeof s.subscription === "string" ? s.subscription : (s.subscription?.id ?? null);
      if (subscriptionId && s.invoice) {
        const inv = await stripe().invoices.retrieve(
          typeof s.invoice === "string" ? s.invoice : s.invoice.id!,
        );
        const end = inv.lines.data[0]?.period?.end;
        if (end) periodEnd = new Date(end * 1000);
      }
      await fulfillOrder(db, {
        orderId,
        provider: "stripe",
        providerRef: s.id,
        subscriptionId,
        periodEnd,
      });
      break;
    }
    case "checkout.session.expired": {
      const orderId = event.data.object.metadata?.orderId;
      if (orderId) await abandonOrder(db, orderId);
      break;
    }
    case "invoice.paid": {
      const inv = event.data.object;
      const sub = subscriptionOf(inv);
      if (!sub || inv.billing_reason !== "subscription_cycle") break;
      const period = inv.lines.data[0]?.period;
      if (!period) break;
      await renewMembership(db, {
        provider: "stripe",
        subscriptionId: sub,
        invoiceId: inv.id!,
        amount: inv.amount_paid,
        periodStart: new Date(period.start * 1000),
        periodEnd: new Date(period.end * 1000),
      });
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      if (event.type === "customer.subscription.deleted" || sub.cancel_at_period_end)
        await markSubscriptionCancelled(db, sub.id);
      break;
    }
  }
}
