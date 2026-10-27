import Link from "next/link";
import { aliasedTable, desc, eq, ilike, or, sql } from "drizzle-orm";
import { deleteOrderAction, markOrderPaidAction, setSurchargePaidAction } from "@/app/admin/actions";
import { AdminTitle, Table, Td } from "@/components/admin";
import { ActionForm } from "@/components/forms";
import { PayFromCredit, RemindPayment } from "@/components/remind-payment";
import { bookingStatusLabel, orderStatusLabel } from "@/components/labels";
import { Badge, Input, cx } from "@/components/ui";
import { getDb } from "@/db";
import { bookings, classSessions, classTypes, orders, users } from "@/db/schema";
import { unpaidBookings, usableCredit } from "@/domain/booking";
import { paidLateOk } from "@/domain/orders";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatDay, formatTime } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { sessionNameSql } from "@/lib/session-name";

const surchargeBooking = aliasedTable(bookings, "surcharge_booking");

export default async function OrdersPage({ searchParams }: PageProps<"/admin/objednavky">) {
  await requireAdmin();
  const { q } = await searchParams;
  const term = typeof q === "string" ? q.trim() : "";
  // "1088", "VS 1088" → the order number; anything else → the client's name
  const vs = term.replace(/^vs\s*/i, "");
  const db = await getDb();
  const [list, unpaid] = await Promise.all([
    db
      .select({ o: orders, u: users, lesson: { id: classSessions.id, startsAt: classSessions.startsAt, name: sessionNameSql } })
      .from(orders)
      .innerJoin(users, eq(orders.userId, users.id))
      // which class a drop-in / surcharge is for
      .leftJoin(surchargeBooking, eq(orders.bookingId, surchargeBooking.id))
      .leftJoin(classSessions, sql`${classSessions.id} = coalesce(${orders.sessionId}, ${surchargeBooking.sessionId})`)
      .leftJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
      .where(term ? (/^\d+$/.test(vs) ? eq(orders.number, Number(vs)) : or(ilike(users.name, `%${term}%`), ilike(users.email, `%${term}%`))) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(200),
    unpaidBookings(db),
  ]);
  const now = new Date();
  // a transfer that arrived: a drop-in's order is paid, a surcharge is marked paid
  const paidButton = (b: (typeof unpaid)[number]) =>
    b.kind === "drop_in" ? (
      <ActionForm action={markOrderPaidAction} confirm={`Platba ${formatPrice(b.amount)}${b.number ? ` (VS ${b.number})` : ""} dorazila?`}>
        <input type="hidden" name="orderId" value={b.orderId!} />
        <button className="text-xs font-semibold text-zeme underline">Zaplaceno</button>
      </ActionForm>
    ) : (
      <ActionForm action={setSurchargePaidAction} confirm={`Doplatek ${formatPrice(b.amount)} je zaplacený?`}>
        <input type="hidden" name="bookingId" value={b.bookingId} />
        <input type="hidden" name="paid" value="true" />
        <button className="text-xs font-semibold text-zeme underline">Zaplaceno</button>
      </ActionForm>
    );

  return (
    <>
      <AdminTitle title="Platby a objednávky">
        <form className="flex gap-2">
          <Input name="q" defaultValue={term} placeholder="VS nebo jméno klienta…" className="w-64" />
        </form>
      </AdminTitle>

      {!term && unpaid.length > 0 && (
        <section id="nezaplacene" className="mb-10 rounded-2xl border-2 border-zlato bg-zlato/10 p-4 sm:p-5">
          <h2 className="font-semibold">Nezaplacené lekce ({unpaid.length})</h2>
          <p className="mt-1 text-sm text-les/60">Porovnej VS s výpisem z banky – co dorazilo, označ Zaplaceno. Ostatním pošli připomínku.</p>
          <details className="mt-1 text-xs text-les/60">
            <summary className="cursor-pointer underline">Co tu je a co znamená „bez VS“?</summary>
            Jednorázové vstupy bez platby a nezaplacené doplatky členů. „Bez VS“ = doplatek, ke kterému klientovi nepřišla výzva (nové rezervace ji už dostávají v potvrzení) – připomínka mu VS i QR kód pošle. Má-li klient dost kreditu, doplatek strhneš tlačítkem Z kreditu.
          </details>
          {/* phones: one short card per lesson, the buttons in a row */}
          <ul className="mt-3 space-y-2 md:hidden">
            {unpaid.map((b) => (
              <li key={b.bookingId} className={cx("rounded-xl border border-linka/60 p-3", b.startsAt < now ? "bg-white/40" : "bg-white/80")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/klienti/${b.userId}`} className="font-semibold">{b.userName}</Link>
                    <Link href={`/admin/rozvrh/${b.sessionId}`} className="block text-sm text-les/70">
                      {b.name} · {formatDay(b.startsAt)} {formatTime(b.startsAt)}{b.startsAt < now && " · proběhla"}
                    </Link>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">{formatPrice(b.amount)}</p>
                    <p className="text-xs tabular-nums text-les/60">{b.vs ? `VS ${b.vs}` : "bez VS"}</p>
                  </div>
                </div>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-les/60">
                  <Badge tone="gold">{b.kind === "drop_in" ? "Vstup" : "Doplatek"}</Badge>
                  {b.status !== "confirmed" && <Badge tone={b.status === "no_show" ? "red" : "neutral"}>{bookingStatusLabel[b.status]}</Badge>}
                  {b.status === "pending_payment" && b.expiresAt && <span>bez platby odhlásím {formatDateTime(b.expiresAt)}</span>}
                </p>
                <div className="mt-2 flex flex-wrap items-start gap-x-5 gap-y-1 border-t border-linka/50 pt-2">
                  {paidButton(b)}
                  <RemindPayment bookingId={b.bookingId} remindedAt={b.remindedAt} />
                  {b.kind === "surcharge" && <PayFromCredit bookingId={b.bookingId} amount={b.amount} credit={usableCredit(b)} />}
                </div>
              </li>
            ))}
          </ul>
          <Table head={["VS", "Lekce", "Klient", "Co", "Částka", "Stav", ""]} className="mt-3 max-md:hidden">
            {unpaid.map((b) => (
              <tr key={b.bookingId} className={b.startsAt < now ? "bg-white/40" : ""}>
                <Td className="whitespace-nowrap font-semibold tabular-nums">{b.vs ?? <span className="text-xs font-normal text-les/50">zatím bez VS</span>}</Td>
                <Td className="whitespace-nowrap">
                  <Link href={`/admin/rozvrh/${b.sessionId}`} className="font-semibold underline-offset-4 hover:underline">{b.name}</Link>
                  <span className="block text-xs text-les/60">{formatDay(b.startsAt)} v {formatTime(b.startsAt)}{b.startsAt < now && " · proběhla"}</span>
                </Td>
                <Td><Link href={`/admin/klienti/${b.userId}`} className="underline-offset-4 hover:underline">{b.userName}</Link></Td>
                <Td>{b.kind === "drop_in" ? "Jednorázový vstup" : "Doplatek"}</Td>
                <Td className="whitespace-nowrap tabular-nums">{formatPrice(b.amount)}</Td>
                <Td>
                  <Badge tone={b.status === "no_show" ? "red" : "gold"}>{bookingStatusLabel[b.status]}</Badge>
                  {b.status === "pending_payment" && b.expiresAt && <span className="block text-xs text-les/60">bez platby odhlásím {formatDateTime(b.expiresAt)}</span>}
                </Td>
                <Td className="space-y-1 text-right">
                  {paidButton(b)}
                  <RemindPayment bookingId={b.bookingId} remindedAt={b.remindedAt} />
                  {b.kind === "surcharge" && <PayFromCredit bookingId={b.bookingId} amount={b.amount} credit={usableCredit(b)} />}
                </Td>
              </tr>
            ))}
          </Table>
        </section>
      )}

      <Table head={["VS", "Datum", "Klient", "Položka", "Částka", "Způsob", "Stav", ""]}>
        {list.map(({ o, u, lesson }) => (
          <tr key={o.id}>
            <Td className="font-semibold tabular-nums">{o.number}</Td>
            <Td className="whitespace-nowrap">{formatDateTime(o.createdAt)}</Td>
            <Td><Link href={`/admin/klienti/${u.id}`} className="underline-offset-4 hover:underline">{u.name}</Link></Td>
            <Td>
              {o.description}
              {lesson?.id && (
                <Link href={`/admin/rozvrh/${lesson.id}`} className="block text-xs text-les/60 underline-offset-4 hover:underline">
                  {lesson.name} · {formatDay(lesson.startsAt!)} v {formatTime(lesson.startsAt!)}
                </Link>
              )}
            </Td>
            <Td className="whitespace-nowrap tabular-nums">{formatPrice(o.amount)}</Td>
            <Td>{{ stripe: "Karta online", transfer: "Převodem", reception: "Recepce", manual: "Ručně", test: "Test", pending: "Nezvoleno" }[o.provider] ?? o.provider}</Td>
            <Td><Badge tone={o.status === "paid" ? "green" : o.status === "pending" ? "gold" : "neutral"}>{orderStatusLabel[o.status]}</Badge></Td>
            <Td className="space-y-1 text-right">
              {o.status === "pending" && o.kind !== "renewal" && (
                <ActionForm action={markOrderPaidAction} confirm="Označit jako zaplacené a připsat klientovi?">
                  <input type="hidden" name="orderId" value={o.id} />
                  <button className="text-xs font-semibold text-zeme underline">Zaplaceno</button>
                </ActionForm>
              )}
              {o.status === "pending" && (o.kind === "drop_in" || o.kind === "surcharge") && <RemindPayment orderId={o.id} />}
              {paidLateOk(o) && (
                <ActionForm
                  action={markOrderPaidAction}
                  confirm={`Platba č. ${o.number} (${formatPrice(o.amount)}) přesto dorazila? Když je na lekci ještě místo a rezervace jen propadla, místo se vrátí – jinak se částka připíše jako kredit.`}
                >
                  <input type="hidden" name="orderId" value={o.id} />
                  <button className="text-xs font-semibold text-zeme underline">Platba přesto dorazila</button>
                </ActionForm>
              )}
              <ActionForm
                action={deleteOrderAction}
                confirm={`Smazat objednávku č. ${o.number}? Klientovi se odebere, co z ní dostal (permanentka, kredit, místo na lekci…), a zmizí z tržeb.${o.provider === "stripe" ? " Peníze na kartu se tím NEVRACÍ – to se dělá ve Stripe." : ""}`}
              >
                <input type="hidden" name="orderId" value={o.id} />
                <button className="text-xs font-semibold text-chyba underline">Smazat</button>
              </ActionForm>
            </Td>
          </tr>
        ))}
      </Table>
      {term && list.length === 0 && <p className="mt-3 text-sm text-les/60">Nic nenalezeno.</p>}
      <p className="mt-3 text-xs text-les/50">{term ? `Hledání „${term}“ · ` : ""}Posledních 200 objednávek. Vrácení peněz za online platby se provádí v administraci Stripe. Hromadné smazání testovacích plateb najdeš v Nastavení → Start studia.</p>
    </>
  );
}
