import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { CheckCircle2 } from "lucide-react";
import { cancelMassageAction } from "@/app/actions/massages";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Container, Eyebrow } from "@/components/ui";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { massageBookings } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatDay, formatTime } from "@/lib/dates";
import { transferDetails } from "@/lib/massage-payment";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = { title: "Rezervace masáže", robots: { index: false } };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function MassageBookingPage({ params, searchParams }: PageProps<"/masaze/rezervace/[id]">) {
  const { id } = await params;
  const { nova } = await searchParams;
  if (!UUID.test(id)) notFound();
  const user = await requireUser(`/masaze/rezervace/${id}`);
  const db = await getDb();
  const [b] = await db
    .select()
    .from(massageBookings)
    .where(and(eq(massageBookings.id, id), eq(massageBookings.userId, user.id)));
  if (!b) notFound();
  const c = await getContent();
  const transfer = b.payment === "transfer" ? await transferDetails(b, c("massages.bankAccount")) : null;
  const cancelled = b.status === "cancelled";

  return (
    <Container className="max-w-3xl py-12 sm:py-16">
      {nova && !cancelled && (
        <p className="mb-8 flex items-center gap-3 rounded-2xl bg-forest p-5 text-papir">
          <CheckCircle2 className="size-6 shrink-0 text-zlato" /> Hotovo, masáž máš zarezervovanou. Potvrzení ti přišlo e-mailem.
        </p>
      )}
      <Eyebrow className="text-zeme">Rezervace masáže</Eyebrow>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">{b.serviceName}</h1>
      <p className="mt-3 text-lg text-les/70">
        {formatDay(b.startsAt)}, {formatTime(b.startsAt)} – {formatTime(b.endsAt)}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {cancelled && <Badge tone="red">Zrušeno</Badge>}
        {!cancelled && b.paidAt && <Badge tone="green">Zaplaceno</Badge>}
        {!cancelled && !b.paidAt && <Badge tone="gold">{b.payment === "transfer" ? "Čeká na platbu převodem" : "Platba na místě"}</Badge>}
      </div>

      {!cancelled && b.payment === "transfer" && !b.paidAt && transfer && (
        <Card className="mt-8 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-les/60">Částka</dt><dd className="font-semibold">{formatPrice(b.price)}{b.memberRate && " (cena pro členy)"}</dd>
            <dt className="text-les/60">Příjemce</dt><dd>{c("massages.bankHolder")}</dd>
            <dt className="text-les/60">Číslo účtu</dt><dd className="font-semibold tabular-nums">{transfer.account}</dd>
            {transfer.iban && (<><dt className="text-les/60">IBAN</dt><dd className="tabular-nums">{transfer.iban}</dd></>)}
            <dt className="text-les/60">Variabilní symbol</dt><dd className="font-semibold tabular-nums">{transfer.vs}</dd>
          </dl>
          {transfer.qr && (
            <figure className="text-center">
              <div className="mx-auto w-40" dangerouslySetInnerHTML={{ __html: transfer.qr }} />
              <figcaption className="mt-2 text-xs text-les/60">QR platba – naskenuj v bankovní aplikaci</figcaption>
            </figure>
          )}
        </Card>
      )}
      {!cancelled && b.payment === "pass" && (
        <p className="mt-8 text-les/70">Zaplaceno permanentkou – strhl se 1 vstup. Při včasném zrušení se ti vrátí.</p>
      )}
      {!cancelled && b.payment === "on_site" && (
        <p className="mt-8 text-les/70">Platí se na místě kartou: <strong>{formatPrice(b.price)}</strong>{b.memberRate && " (cena pro členy)"}.</p>
      )}
      {b.note && <p className="mt-6 text-sm text-les/60">Tvoje poznámka: {b.note}</p>}

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Link href="/ucet" className="eyebrow text-zeme underline underline-offset-4">Můj účet</Link>
        {!cancelled && b.startsAt > new Date() && (
          <ActionForm action={cancelMassageAction} confirm="Opravdu zrušit masáž?">
            <input type="hidden" name="bookingId" value={b.id} />
            <SubmitButton variant="ghost" className="px-3 py-2 text-[0.65rem]">Zrušit rezervaci</SubmitButton>
          </ActionForm>
        )}
      </div>
    </Container>
  );
}
