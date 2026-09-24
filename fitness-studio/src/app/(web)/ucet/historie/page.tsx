import { bookingStatusLabel, creditReasonLabel, entitlementKindLabel, methodLabel, orderStatusLabel } from "@/components/labels";
import { Badge, Card, Empty } from "@/components/ui";
import { getDb } from "@/db";
import { userBookings, userEntitlements, userLedger, userOrders } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPrice } from "@/lib/money";

export default async function HistoryPage() {
  const user = await requireUser("/ucet/historie");
  const db = await getDb();
  const [past, orderList, ledger, ents] = await Promise.all([
    userBookings(db, user.id, "past"),
    userOrders(db, user.id),
    userLedger(db, user.id),
    userEntitlements(db, user.id, false),
  ]);

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section>
        <h2 className="text-xl font-semibold">Proběhlé lekce</h2>
        <Card className="mt-4 p-0">
          {past.length === 0 ? <div className="p-6"><Empty>Zatím žádné.</Empty></div> : (
            <ul className="divide-y divide-linka/60">
              {past.map(({ b, s, ct }) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span><strong>{ct.name}</strong><br /><span className="text-les/60">{formatDateTime(s.startsAt)}{b.method && ` · ${methodLabel[b.method]}`}</span></span>
                  <Badge tone={b.status === "attended" ? "green" : b.status === "cancelled" ? "neutral" : "gold"}>{bookingStatusLabel[b.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
      <section className="space-y-10">
        <div>
          <h2 className="text-xl font-semibold">Platby</h2>
          <Card className="mt-4 p-0">
            {orderList.length === 0 ? <div className="p-6"><Empty>Žádné platby.</Empty></div> : (
              <ul className="divide-y divide-linka/60">
                {orderList.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span><strong>{o.description}</strong><br /><span className="text-les/60">č. {o.number} · {formatDateTime(o.createdAt)}</span></span>
                    <span className="text-right">{formatPrice(o.amount)}<br /><span className="text-xs text-les/60">{orderStatusLabel[o.status]}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Pohyby kreditu</h2>
          <Card className="mt-4 p-0">
            {ledger.length === 0 ? <div className="p-6"><Empty>Žádné pohyby.</Empty></div> : (
              <ul className="divide-y divide-linka/60">
                {ledger.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span>{creditReasonLabel[t.reason]}{t.note && <span className="text-les/60"> · {t.note}</span>}<br /><span className="text-les/60">{formatDateTime(t.createdAt)}</span></span>
                    <span className={t.delta > 0 ? "font-semibold text-ok" : "font-semibold"}>{t.delta > 0 ? "+" : ""}{t.delta}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div>
          <h2 className="text-xl font-semibold">Všechny permanentky</h2>
          <Card className="mt-4 p-0">
            {ents.length === 0 ? <div className="p-6"><Empty>Žádné.</Empty></div> : (
              <ul className="divide-y divide-linka/60">
                {ents.map((e) => (
                  <li key={e.id} className="px-5 py-3 text-sm">
                    <strong>{e.name}</strong> <span className="text-les/60">· {entitlementKindLabel[e.kind]} · {formatDate(e.validFrom)} – {formatDate(e.validUntil)} · {e.entriesTotal === null ? "neomezeně" : `${e.entriesUsed}/${e.entriesTotal} využito`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
