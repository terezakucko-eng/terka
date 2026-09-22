import { getDb } from "@/db";
import { handleStripeWebhook } from "@/lib/payments";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET)
    return new Response("Missing signature", { status: 400 });
  try {
    await handleStripeWebhook(await getDb(), await req.text(), signature);
    return Response.json({ received: true });
  } catch (e) {
    console.error("[stripe webhook]", e);
    return new Response("Webhook error", { status: 400 });
  }
}
