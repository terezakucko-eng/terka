import { eq } from "drizzle-orm";
import { ButtonLink, Card, Container, Eyebrow } from "@/components/ui";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
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
  const cancelled = stav === "zruseno" && !paid;

  return (
    <Container className="max-w-lg py-16">
      <Card className="text-center">
        <Eyebrow className="text-zeme">Platba</Eyebrow>
        <h1 className="mt-4 text-3xl font-semibold">
          {paid ? "Děkujeme, zaplaceno!" : cancelled ? "Platba byla zrušena" : "Platbu ověřujeme…"}
        </h1>
        <p className="mt-3 text-les/70">
          {paid
            ? mine?.kind === "drop_in"
              ? "Rezervace je potvrzená. Těšíme se na tebe."
              : "Nákup máš na účtu, můžeš rovnou rezervovat."
            : cancelled
              ? "Nic se nestrhlo. Můžeš to zkusit znovu."
              : "Potvrzení od banky obvykle dorazí do pár vteřin. Obnov stránku, nebo se podívej do svého účtu."}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/ucet" variant="dark">Můj účet</ButtonLink>
          <ButtonLink href="/rozvrh" variant="outline">Rozvrh</ButtonLink>
        </div>
      </Card>
    </Container>
  );
}
