import Link from "next/link";
import { and, count, eq, gte, sum } from "drizzle-orm";
import { AdminTitle, Stat } from "@/components/admin";
import { SessionCard } from "@/components/session-card";
import { Empty } from "@/components/ui";
import { getDb } from "@/db";
import { entitlements, orders, users } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { addDays, dateKey, pragueLocalToDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { listSessions } from "@/lib/queries";

export default async function AdminDashboard() {
  const user = await requireStaff();
  const db = await getDb();
  const now = new Date();
  const today = dateKey(now);
  const since30 = new Date(now.getTime() - 30 * 86_400_000);

  const [todaySessions, weekSessions, [rev], [members], [newClients]] = await Promise.all([
    listSessions(db, pragueLocalToDate(today), pragueLocalToDate(addDays(today, 1))),
    listSessions(db, now, pragueLocalToDate(addDays(today, 7)), { includeCancelled: false }),
    db.select({ total: sum(orders.amount) }).from(orders).where(and(eq(orders.status, "paid"), gte(orders.paidAt, since30))),
    db.select({ n: count() }).from(entitlements).where(and(eq(entitlements.kind, "membership"), eq(entitlements.status, "active"), gte(entitlements.validUntil, now))),
    db.select({ n: count() }).from(users).where(and(eq(users.role, "client"), gte(users.createdAt, since30))),
  ]);

  const capacity = weekSessions.reduce((a, s) => a + s.capacity, 0);
  const booked = weekSessions.reduce((a, s) => a + s.occupied, 0);

  return (
    <>
      <AdminTitle title={`Dobrý den, ${user.name.split(" ")[0]}`} />
      {user.role === "admin" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Tržby 30 dní" value={formatPrice(Number(rev.total ?? 0))} sub="zaplacené objednávky" />
          <Stat label="Aktivní členství" value={members.n} />
          <Stat label="Noví klienti" value={newClients.n} sub="za 30 dní" />
          <Stat label="Obsazenost 7 dní" value={capacity ? `${Math.round((booked / capacity) * 100)} %` : "—"} sub={`${booked} / ${capacity} míst`} />
        </div>
      )}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold">Dnešní lekce</h2>
          <Link href="/admin/rozvrh" className="eyebrow text-zeme underline underline-offset-4">Celý rozvrh</Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {todaySessions.length === 0 && <Empty>Dnes žádné lekce.</Empty>}
          {todaySessions.map((s) => (
            <Link key={s.id} href={`/admin/rozvrh/${s.id}`} className="block">
              <SessionCardAdmin s={s} />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function SessionCardAdmin({ s }: { s: Awaited<ReturnType<typeof listSessions>>[number] }) {
  return (
    <div className="pointer-events-none">
      <SessionCard s={s} />
    </div>
  );
}
