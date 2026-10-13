import { eq } from "drizzle-orm";
import { ButtonLink, Card, Container, Eyebrow } from "@/components/ui";
import { getDb } from "@/db";
import { orders, vouchers } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export default async function PaymentResultPage({ searchParams }: PageProps<"/platba/vysledek">) {
  const { order: id, stav } = await searchParams;
  const user = await requireUser();
  const order =
    typeof id === "string" && /^[0-9a-f-]{36}$/.test(id)
      ? (await (await getDb()).select().from(orders).where(eq(orders.id, id)))[0]
      : undefined;
  const mine = order && order.userId === user.id ? order : undefined;
  const paid = mine?.status === "paid";
  const [gift] = mine?.kind === "voucher" ? await (await getDb()).select().from(vouchers).where(eq(vouchers.orderId, mine.id)) : [];
  const cancelled = stav === "zruseno" && !paid;

  return (
    <Container className="max-w-lg py-16">
      <Card className="text-center">
        <Eyebrow className="text-zeme">Platba</Eyebrow>
        <h1 className="mt-4 text-3xl font-semibold">
          {paid ? "Děkujeme, zaplaceno!" : cancelled ? "Platba byla zrušena" : "Platbu ověřujeme…"}
        </h1>
        <p className="mt-3 text-les/70">
          {paid && gift
            ? "Dárkový poukaz je připravený 🎁 Stáhni si ho jako PDF – vytiskni ho, nebo ho rovnou pošli. Najdeš ho i v Můj účet."
            : paid
            ? mine?.kind === "drop_in" || mine?.kind === "surcharge" || mine?.kind === "massage" || mine?.kind === "membership_fee"
              ? "Zaplaceno, děkujeme. Těšíme se na tebe."
              : "Nákup máš na účtu, můžeš rovnou rezervovat."
            : cancelled
              ? "Nic se nestrhlo. Můžeš to zkusit znovu."
              : "Potvrzení od banky obvykle dorazí do pár vteřin. Obnov stránku, nebo se podívej do svého účtu."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {paid && gift && (
            <a href={`/api/poukaz/${gift.id}`} className="rounded-full bg-gold px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-les">
              Stáhnout poukaz
            </a>
          )}
          <ButtonLink href="/ucet" variant="dark">Můj účet</ButtonLink>
          <ButtonLink href="/rozvrh" variant="outline">Rozvrh</ButtonLink>
        </div>
      </Card>
    </Container>
  );
}
