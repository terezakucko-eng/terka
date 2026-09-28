import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Badge, ButtonLink, Card, Container, Eyebrow } from "@/components/ui";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { bankTransfer } from "@/lib/massage-payment";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = { title: "Platba převodem" };

/** Bank details + QR code for an order paid by transfer. */
export default async function TransferPage({ searchParams }: PageProps<"/platba/prevod">) {
  const { order: id } = await searchParams;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await requireUser(`/platba/prevod?order=${id}`);
  const [o] = await (await getDb()).select().from(orders).where(eq(orders.id, id));
  if (!o || o.userId !== user.id) notFound();
  const c = await getContent();
  const paid = o.status === "paid";
  const off = o.status === "cancelled" || o.status === "expired";
  const t = paid || off ? null : await bankTransfer({ amount: o.amount, vs: o.number ?? "", message: o.description }, c("massages.bankAccount"));

  return (
    <Container className="max-w-3xl py-12 sm:py-16">
      {o.kind === "drop_in" && !off && (
        <p className="mb-8 flex items-center gap-3 rounded-2xl bg-forest p-5 text-papir">
          <CheckCircle2 className="size-6 shrink-0 text-zlato" /> Místo na lekci máš rezervované. Potvrzení ti přišlo e-mailem.
        </p>
      )}
      <Eyebrow className="text-zeme">Platba převodem</Eyebrow>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">{o.description}</h1>
      <p className="mt-3 text-3xl font-light">{formatPrice(o.amount)}</p>
      <div className="mt-4">
        {paid ? <Badge tone="green">Zaplaceno</Badge> : off ? <Badge tone="red">Zrušeno</Badge> : <Badge tone="gold">Čeká na platbu</Badge>}
      </div>

      {t && (
        <Card className="mt-8 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-les/60">Částka</dt><dd className="font-semibold">{formatPrice(o.amount)}</dd>
            <dt className="text-les/60">Příjemce</dt><dd>{c("massages.bankHolder")}</dd>
            <dt className="text-les/60">Číslo účtu</dt><dd className="font-semibold tabular-nums">{t.account}</dd>
            {t.iban && (<><dt className="text-les/60">IBAN</dt><dd className="tabular-nums">{t.iban}</dd></>)}
            <dt className="text-les/60">Variabilní symbol</dt><dd className="font-semibold tabular-nums">{t.vs}</dd>
          </dl>
          {t.qr && (
            <figure className="text-center">
              <div className="mx-auto w-40" dangerouslySetInnerHTML={{ __html: t.qr }} />
              <figcaption className="mt-2 text-xs text-les/60">QR platba – naskenuj v bankovní aplikaci</figcaption>
            </figure>
          )}
        </Card>
      )}
      {!paid && !off && !t && (
        <p className="mt-8 text-les/70">Platební údaje ti brzy pošleme e-mailem.</p>
      )}
      {!paid && !off && (
        <p className="mt-6 max-w-xl text-sm text-les/70">
          {o.kind === "drop_in"
            ? "Jakmile platba dorazí na účet, místo na lekci je tvoje. Pošli ji prosím co nejdřív."
            : "Jakmile platba dorazí, připíšeme ti nákup na účet – obvykle do 1–2 pracovních dnů. Údaje k platbě najdeš i ve svém účtu."}
        </p>
      )}
      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/ucet" variant="dark">Můj účet</ButtonLink>
        <ButtonLink href="/rozvrh" variant="outline">Rozvrh</ButtonLink>
      </div>
    </Container>
  );
}
