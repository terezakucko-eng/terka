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
import { credits, formatPrice } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { transferPayBy } from "@/domain/booking";
import { creditedBack } from "@/domain/orders";
import { getSettings } from "@/lib/settings";
import { cardPayments } from "@/lib/payments";
import { payOrderAction } from "@/app/actions/booking";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata: Metadata = { title: "Platba převodem", robots: { index: false } };

/** Bank details + QR code for an order paid by transfer. */
export default async function TransferPage({ searchParams }: PageProps<"/platba/prevod">) {
  const { order: id } = await searchParams;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await requireUser(`/platba/prevod?order=${id}`);
  const db = await getDb();
  const [o] = await db.select().from(orders).where(eq(orders.id, id));
  if (!o || o.userId !== user.id) notFound();
  // a drop-in by transfer: what the client is told is "pay within 24 hours"
  const cfg = await getSettings(db);
  const payBy = o.kind === "drop_in" && o.expiresAt ? transferPayBy(cfg, o) : null;
  // the full "within 24 hours" – unless the class is so soon that the deadline is earlier
  const fullDay = !!payBy && payBy.getTime() - o.createdAt.getTime() >= cfg.transferHoldHours * 3_600_000;
  const c = await getContent();
  const paid = o.status === "paid";
  const off = o.status === "cancelled" || o.status === "expired";
  // paid after the booking was gone – it's on the account as credit
  const credited = paid && (o.kind === "drop_in" || o.kind === "surcharge") ? await creditedBack(db, o.id) : 0;
  const t = paid || off ? null : await bankTransfer({ amount: o.amount, vs: o.number ?? "", message: o.description }, c("massages.bankAccount"));

  return (
    <Container className="max-w-3xl py-12 sm:py-16">
      {o.kind === "drop_in" && paid && !credited && (
        <p className="mb-8 flex items-center gap-3 rounded-2xl bg-forest p-5 text-papir">
          <CheckCircle2 className="size-6 shrink-0 text-zlato" /> Platba dorazila – místo na lekci je tvoje.
        </p>
      )}
      {credited > 0 && (
        <p className="mb-8 flex items-center gap-3 rounded-2xl bg-forest p-5 text-papir">
          <CheckCircle2 className="size-6 shrink-0 text-zlato" />
          <span>Platba dorazila, ale rezervace už neplatila – máš ji na účtu jako kredit ({credits(credited)}). Můžeš s ním zaplatit jinou lekci.</span>
        </p>
      )}
      {/* the place is the client's only once paid (older bookings had it right away – no deadline) */}
      {o.kind === "drop_in" && !paid && !off && (
        <p className="mb-8 rounded-2xl border-2 border-zlato bg-zlato/15 p-5">
          {payBy ? (
            <>
              <strong>Platbu je nutné uhradit {fullDay ? `do ${cfg.transferHoldHours} hodin – do ${formatDateTime(payBy)}` : `do ${formatDateTime(payBy)}`}.</strong> Místo na lekci potvrdíme, jakmile platba dorazí – uvidíš to v Můj účet.
              Když nedorazí, z lekce tě odhlásíme a místo uvolníme pro ostatní.
            </>
          ) : (
            <>Místo na lekci máš rezervované. Zaplať prosím co nejdřív.</>
          )}
        </p>
      )}
      {o.kind === "drop_in" && o.status === "expired" && (
        <p className="mb-8 rounded-2xl border border-chyba/40 bg-chyba/10 p-5">
          <strong>Rezervace propadla</strong> – platba nedorazila včas, tak jsme tě z lekce odhlásili.
          Pokud je platba na cestě, nevadí – když bude volno, místo ti vrátíme, jinak ji dostaneš jako kredit.
        </p>
      )}
      <Eyebrow className="text-zeme">Platba převodem</Eyebrow>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">{o.description}</h1>
      <p className="mt-3 text-3xl font-light">{formatPrice(o.amount)}</p>
      <div className="mt-4">
        {paid ? <Badge tone="green">Zaplaceno</Badge> : off ? <Badge tone="red">{o.status === "expired" ? "Propadlo" : "Zrušeno"}</Badge> : <Badge tone="gold">Čeká na platbu</Badge>}
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
      {!paid && !off && (o.kind === "membership_fee" || o.kind === "surcharge") && cardPayments() && (
        <ActionForm action={payOrderAction} className="mt-6">
          <input type="hidden" name="orderId" value={o.id} />
          <SubmitButton name="pay" value="card" variant="gold">Zaplatit kartou</SubmitButton>
        </ActionForm>
      )}
      {!paid && !off && !t && (
        <p className="mt-8 text-les/70">Platební údaje ti brzy pošleme e-mailem.</p>
      )}
      {!paid && !off && (
        <p className="mt-6 max-w-xl text-sm text-les/70">
          {o.kind === "drop_in"
            ? "Pošli platbu prosím hned – rychlá (okamžitá) platba dorazí nejdřív."
            : o.kind === "membership_fee"
              ? "Jakmile platba dorazí, příspěvek označíme jako zaplacený – obvykle do 1–2 pracovních dnů."
              : o.kind === "voucher"
              ? "Jakmile platba dorazí, poukaz ti pošleme e-mailem a najdeš ho ke stažení v Můj účet – obvykle do 1–2 pracovních dnů."
              : o.kind === "surcharge"
              ? "Jakmile platba dorazí, doplatek u rezervace označíme jako zaplacený – obvykle do 1–2 pracovních dnů."
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
