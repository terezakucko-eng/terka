import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { testPayAction } from "@/app/actions/booking";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Container, Eyebrow } from "@/components/ui";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { paymentProvider } from "@/lib/payments";

/** Local stand-in for the payment gateway (no Stripe keys configured). */
export default async function TestPaymentPage({ searchParams }: PageProps<"/platba/test">) {
  const { order: id } = await searchParams;
  const user = await requireUser();
  if (paymentProvider() !== "test" || typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [o] = await (await getDb()).select().from(orders).where(eq(orders.id, id));
  if (!o || o.userId !== user.id) notFound();

  return (
    <Container className="max-w-lg py-16">
      <Card>
        <Eyebrow className="text-zeme">Testovací platební brána</Eyebrow>
        <p className="mt-2 text-sm text-les/60">Ostrá brána (Stripe) se zapne po doplnění klíčů. Tady si jen zkoušíš průchod.</p>
        <p className="mt-6 text-lg font-semibold">{o.description}</p>
        <p className="text-4xl font-light">{formatPrice(o.amount)}</p>
        <div className="mt-8 flex gap-3">
          <ActionForm action={testPayAction}>
            <input type="hidden" name="orderId" value={o.id} />
            <input type="hidden" name="result" value="ok" />
            <SubmitButton variant="gold">Zaplatit</SubmitButton>
          </ActionForm>
          <ActionForm action={testPayAction}>
            <input type="hidden" name="orderId" value={o.id} />
            <input type="hidden" name="result" value="cancel" />
            <SubmitButton variant="outline">Zrušit</SubmitButton>
          </ActionForm>
        </div>
      </Card>
    </Container>
  );
}
