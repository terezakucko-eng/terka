import Link from "next/link";
import { and, count, eq, gte, isNotNull, or, sum } from "drizzle-orm";
import { AdminTitle, Stat } from "@/components/admin";
import { Avatar } from "@/components/avatar";
import { SessionCard } from "@/components/session-card";
import { Empty } from "@/components/ui";
import { getDb } from "@/db";
import { entitlements, orders, users } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { addDays, dateKey, formatDateTime, formatDay, formatTime, pragueLocalToDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { formatDayMonth, upcomingCelebrations } from "@/lib/profile";
import { listSessions } from "@/lib/queries";
import { pendingStudentProofs } from "@/domain/students";
import { transfersToCheck } from "@/domain/booking";
import { markOrderPaidAction } from "@/app/admin/actions";
import { RemindPayment } from "@/components/remind-payment";
import { getSettings } from "@/lib/settings";
import { ActionForm, SubmitButton } from "@/components/forms";

export default async function AdminDashboard() {
  const user = await requireStaff();
  const db = await getDb();
  const now = new Date();
  const today = dateKey(now);
  const since30 = new Date(now.getTime() - 30 * 86_400_000);

  const [todaySessions, weekSessions, [rev], [members], [newClients], celebrants] = await Promise.all([
    listSessions(db, pragueLocalToDate(today), pragueLocalToDate(addDays(today, 1))),
    listSessions(db, now, pragueLocalToDate(addDays(today, 7)), { includeCancelled: false }),
    db.select({ total: sum(orders.amount) }).from(orders).where(and(eq(orders.status, "paid"), gte(orders.paidAt, since30))),
    db.select({ n: count() }).from(entitlements).where(and(eq(entitlements.kind, "membership"), eq(entitlements.status, "active"), gte(entitlements.validUntil, now))),
    db.select({ n: count() }).from(users).where(and(eq(users.role, "client"), gte(users.createdAt, since30))),
    db
      .select({ id: users.id, name: users.name, nickname: users.nickname, avatar: users.avatar, birthDate: users.birthDate, nameDay: users.nameDay })
      .from(users)
      .where(or(isNotNull(users.birthDate), isNotNull(users.nameDay))),
  ]);
  const celebrations = upcomingCelebrations(celebrants, today, 7);
  // only the admin checks the ISIC photos
  const proofs = user.role === "admin" ? await pendingStudentProofs(db) : [];
  // drop-ins by transfer: the place is confirmed only once the payment is marked here (or in Platby)
  const transfers = user.role === "admin" ? await transfersToCheck(db, now) : [];
  const cfg = await getSettings(db);

  const capacity = weekSessions.reduce((a, s) => a + s.capacity, 0);
  const booked = weekSessions.reduce((a, s) => a + s.occupied, 0);

  return (
    <>
      <AdminTitle title={`Dobrý den, ${user.name.split(" ")[0]}`} />
      {transfers.length > 0 && (
        <section className="mb-8 rounded-2xl border-2 border-zlato bg-zlato/10 p-5">
          <h2 className="font-semibold">💸 Převody ke kontrole ({transfers.length})</h2>
          <p className="mt-1 text-sm text-les/60">
            Zkontroluj účet. Po kliknutí na Zaplaceno se místo potvrdí a klientce přijde potvrzení. Klientka má zaplatit do {cfg.transferHoldHours} h – když platba nedorazí do {cfg.transferGraceHours} h, systém ji z lekce sám odhlásí.
          </p>
          <ul className="mt-3 divide-y divide-linka/50">
            {transfers.map((t) => (
              <li key={t.orderId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="text-sm">
                  <strong>{t.userName}</strong> · <Link href={`/admin/rozvrh/${t.sessionId}`} className="underline underline-offset-4">{t.name} {formatDay(t.startsAt)} v {formatTime(t.startsAt)}</Link>
                  <span className="block text-les/70">{formatPrice(t.amount)} · VS {t.number} · zaplatit do {formatDateTime(t.payBy)} · bez platby odhlásím <strong>{formatDateTime(t.expiresAt!)}</strong></span>
                </span>
                <div className="flex flex-col items-end gap-1">
                  <ActionForm action={markOrderPaidAction} confirm={`Platba ${formatPrice(t.amount)} (VS ${t.number}) dorazila? Místo se potvrdí.`}>
                    <input type="hidden" name="orderId" value={t.orderId} />
                    <SubmitButton variant="gold" className="px-4 py-2 text-xs">Zaplaceno</SubmitButton>
                  </ActionForm>
                  {t.bookingId && <RemindPayment bookingId={t.bookingId} remindedAt={t.clientRemindedAt} />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {user.role === "admin" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Tržby 30 dní" value={formatPrice(Number(rev.total ?? 0))} sub="zaplacené objednávky" />
          <Stat label="Aktivní členství" value={members.n} />
          <Stat label="Noví klienti" value={newClients.n} sub="za 30 dní" />
          <Stat label="Obsazenost 7 dní" value={capacity ? `${Math.round((booked / capacity) * 100)} %` : "—"} sub={`${booked} / ${capacity} míst`} />
        </div>
      )}
      {user.role === "admin" && (
        <p className="mt-3 text-right text-sm">
          <Link href="/admin/statistiky" className="eyebrow text-zeme underline underline-offset-4">Statistiky po měsících →</Link>
        </p>
      )}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold">Dnešní lekce</h2>
          <Link href="/admin/rozvrh" className="eyebrow text-zeme underline underline-offset-4">Celý rozvrh</Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {todaySessions.length === 0 && <Empty>Dnes žádné lekce.</Empty>}
          {todaySessions.map((s) => (
            <SessionCard key={s.id} s={s} href={`/admin/rozvrh/${s.id}`} />
          ))}
        </div>
      </section>
      {proofs.length > 0 && (
        <section className="mt-10 rounded-2xl border border-zlato/50 bg-zlato/10 p-5">
          <h2 className="font-semibold">🎓 Ke kontrole: fotky ISIC ({proofs.length})</h2>
          <p className="mt-1 text-sm text-les/60">Klient nahrál fotku kvůli studentské ceně. Zkontroluj ji a v kartě klienta vyplň „Student do“ – fotka se pak smaže.</p>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm">
            {proofs.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/klienti/${p.id}#udaje`} className="inline-flex rounded-full border border-les/30 bg-papir px-3 py-1 hover:border-les">
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {celebrations.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Kdo slaví (7 dní)</h2>
          <p className="mt-1 text-sm text-les/60">Přání jim web posílá sám v den oslavy dopoledne (Nastavení → Přání a dárky).</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {celebrations.map(({ user: c, kind, date, age }) => {
              const content = (
                <>
                  <Avatar user={c} size={40} />
                  <span className="text-sm">
                    <strong>{c.name}</strong>
                    <span className="block text-les/60">
                      {kind === "birthday" ? `🎂 narozeniny${age ? ` (${age})` : ""}` : "🌷 svátek"} ·{" "}
                      {date === today ? <strong className="text-zeme">dnes</strong> : formatDayMonth(date.slice(5))}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={`${c.id}-${kind}`}>
                  {user.role === "admin" ? (
                    <Link href={`/admin/klienti/${c.id}`} className="flex items-center gap-3 rounded-xl border border-linka/60 bg-white/60 p-3 hover:border-zlato">{content}</Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl border border-linka/60 bg-white/60 p-3">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
