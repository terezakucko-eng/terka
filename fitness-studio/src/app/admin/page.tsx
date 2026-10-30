import Link from "next/link";
import { and, count, eq, gte, isNotNull, or, sum } from "drizzle-orm";
import { AdminTitle, Stat } from "@/components/admin";
import { Avatar } from "@/components/avatar";
import { SessionCard } from "@/components/session-card";
import { Badge, Empty } from "@/components/ui";
import { getDb } from "@/db";
import { entitlements, orders, users } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { addDays, dateKey, formatDateTime, formatDay, formatTime, pragueLocalToDate } from "@/lib/dates";
import { formatPrice, pluralCs } from "@/lib/money";
import { formatDayMonth, upcomingCelebrations } from "@/lib/profile";
import { listSessions } from "@/lib/queries";
import { pendingStudentProofs } from "@/domain/students";
import { passCardActivity } from "@/domain/pass-cards";
import { newMemberships } from "@/domain/stats";
import { transfersToCheck, unpaidBookings } from "@/domain/booking";
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
  // every unpaid lesson (surcharges too) – the full list with reminders is in Platby
  const unpaid = user.role === "admin" ? await unpaidBookings(db) : [];
  const unpaidSurcharges = unpaid.filter((b) => b.kind === "surcharge").length;
  // Pošli to dál over the last week, new memberships over the last month
  const since7 = new Date(now.getTime() - 7 * 86_400_000);
  const cardsWeek = user.role === "admin" ? await passCardActivity(db, since7) : null;
  const cardEvents = cardsWeek
    ? [...cardsWeek.scans.map((e) => ({ ...e, signUp: false })), ...cardsWeek.signUps.map((e) => ({ ...e, signUp: true }))]
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .slice(0, 8)
    : [];
  const memberships = user.role === "admin" ? await newMemberships(db, since30) : [];
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
      {unpaid.length > 0 && (
        <Link href="/admin/objednavky" className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-zlato/60 bg-zlato/10 p-5 transition hover:bg-zlato/20">
          <span>
            <strong>💳 Nezaplacené lekce ({unpaid.length})</strong>
            <span className="block text-sm text-les/70">
              {formatPrice(unpaid.reduce((a, b) => a + b.amount, 0))}
              {unpaidSurcharges > 0 && ` · ${pluralCs(unpaidSurcharges, "doplatek", "doplatky", "doplatků")}`}
              {unpaid.length - unpaidSurcharges > 0 && ` · ${pluralCs(unpaid.length - unpaidSurcharges, "vstup", "vstupy", "vstupů")}`}
              {" "}– zkontroluj VS, připomeň nebo strhni z kreditu
            </span>
          </span>
          <span className="eyebrow shrink-0 text-zeme">Platby →</span>
        </Link>
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
      {cardsWeek && (
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-zlato/50 bg-zlato/10 p-5">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-semibold">🐙 Pošli to dál · 7 dní</h2>
              <Link href="/admin/karticky" className="eyebrow text-zeme underline underline-offset-4">Kartičky</Link>
            </div>
            <p className="mt-1 text-sm text-les/60">
              Naskenováno {cardsWeek.scans.length}× · {pluralCs(cardsWeek.signUps.length, "registrace", "registrace", "registrací")}
            </p>
            {cardEvents.length === 0 ? (
              <p className="mt-3 text-sm text-les/60">Za posledních 7 dní kartičku nikdo nenaskenoval.</p>
            ) : (
              <ul className="mt-3 divide-y divide-linka/50 text-sm">
                {cardEvents.map((e, i) => (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                    <span>
                      {e.signUp ? (
                        <>
                          ✨ {e.userId ? <Link href={`/admin/klienti/${e.userId}`} className="font-semibold underline">{e.name}</Link> : e.name} – registrace přes {e.label}
                        </>
                      ) : (
                        <>
                          📱 {e.label} naskenovaná
                          {e.userId && (
                            <span className="text-les/60">
                              {" "}
                              (přihlášená: <Link href={`/admin/klienti/${e.userId}`} className="underline">{e.name}</Link>)
                            </span>
                          )}
                        </>
                      )}
                    </span>
                    <span className="text-xs text-les/50">{formatDay(e.at)} {formatTime(e.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-2xl border border-linka/60 bg-white/60 p-5">
            <h2 className="font-semibold">🆕 Nová členství · 30 dní ({memberships.length})</h2>
            {memberships.length === 0 ? (
              <p className="mt-3 text-sm text-les/60">Za posledních 30 dní žádné nové členství.</p>
            ) : (
              <ul className="mt-3 divide-y divide-linka/50 text-sm">
                {memberships.slice(0, 10).map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                    <span>
                      <Link href={`/admin/klienti/${m.userId}`} className="font-semibold underline">{m.name}</Link>
                      <span className="text-les/60"> · {m.product}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {m.how === "paid" ? (
                        <Badge tone="green">Zaplaceno</Badge>
                      ) : m.how === "waiting" ? (
                        <Badge tone="gold">Čeká na platbu</Badge>
                      ) : m.how === "presale" ? (
                        <Badge tone="neutral">Předprodej</Badge>
                      ) : (
                        <Badge tone="neutral">Zadáno ve studiu</Badge>
                      )}
                      <span className="text-xs text-les/50">{formatDay(m.at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {memberships.length > 10 && <p className="mt-2 text-xs text-les/60">… a {memberships.length - 10} dalších</p>}
          </section>
        </div>
      )}
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
