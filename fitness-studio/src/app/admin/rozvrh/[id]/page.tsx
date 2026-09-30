import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  adminAddBookingAction,
  adminCancelBookingAction,
  attendanceAction,
  cancelSessionAction,
  deleteSessionAction,
  setSurchargePaidAction,
  updateSessionAction,
} from "@/app/admin/actions";
import { AdminTitle, Panel, Table, Td } from "@/components/admin";
import { SessionFields } from "@/components/admin-forms";
import { ActionForm, SubmitButton } from "@/components/forms";
import { bookingStatusLabel, methodLabel } from "@/components/labels";
import { Badge, Card, Field, Input, Select, cx } from "@/components/ui";
import { getDb } from "@/db";
import { bookings, users } from "@/db/schema";
import { formatPrice } from "@/lib/money";
import { requireStaff } from "@/lib/auth";
import { formatDay, formatRange, toLocalInput } from "@/lib/dates";
import { activeClassTypes, activeInstructors, sessionDetail } from "@/lib/queries";
import { Avatar } from "@/components/avatar";
import { upcomingCelebrations } from "@/lib/profile";
import { dateKey, mondayOf } from "@/lib/dates";
import { ClientSelect } from "@/components/client-select";
import { splitName } from "@/lib/client-list";

export default async function AdminSessionPage({ params }: PageProps<"/admin/rozvrh/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const detail = await sessionDetail(db, id);
  if (!detail) notFound();
  const { s, ct, ins } = detail;
  const clientRows = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
    .from(users)
    .where(and(eq(users.role, "client"), isNull(users.deletedAt)));
  const collator = new Intl.Collator("cs");
  const clientOpts = clientRows
    .map((u) => {
      const { first, last } = splitName(u.name);
      return { id: u.id, label: last ? `${last} ${first}` : first, sub: [u.phone, u.email].filter(Boolean).join(" · ") };
    })
    .sort((a, b) => collator.compare(a.label, b.label));
  const [list, types, instructorList] = await Promise.all([
    db
      .select({ b: bookings, u: users })
      .from(bookings)
      .innerJoin(users, eq(bookings.userId, users.id))
      .where(eq(bookings.sessionId, s.id))
      .orderBy(asc(bookings.createdAt)),
    activeClassTypes(db),
    activeInstructors(db),
  ]);
  const active = list.filter(({ b }) => !["cancelled", "waitlist"].includes(b.status));
  const waitlist = list.filter(({ b }) => b.status === "waitlist");
  const cancelled = list.filter(({ b }) => b.status === "cancelled");
  const isAdmin = staff.role === "admin";
  type Row = (typeof list)[number];
  const who = (b: Row["b"], u: Row["u"]) => (
    <>
      <span className="flex items-center gap-2">
        <Avatar user={u} size={28} />
        {isAdmin ? <Link href={`/admin/klienti/${u.id}`} className="font-semibold underline-offset-4 hover:underline">{u.name}</Link> : <strong>{u.name}</strong>}
        {upcomingCelebrations([u], dateKey(s.startsAt), 1).map((x) => (
          <span key={x.kind} title={x.kind === "birthday" ? "Má narozeniny" : "Má svátek"}>{x.kind === "birthday" ? "🎂" : "🌷"}</span>
        ))}
      </span>
      {b.guestName && <><br /><Badge tone="gold">+1 {b.guestName}</Badge></>}
      <br /><span className="break-all text-xs text-les/50">{u.phone ?? u.email}</span>
    </>
  );
  const pay = (b: Row["b"]) => (
    <>
      {b.method ? methodLabel[b.method] : "—"}
      {b.surcharge > 0 && (
        <ActionForm action={setSurchargePaidAction} className="mt-1">
          <input type="hidden" name="bookingId" value={b.id} />
          <input type="hidden" name="paid" value={b.surchargePaidAt ? "false" : "true"} />
          <button title={b.surchargePaidAt ? "Zrušit zaplacení" : "Označit jako zaplacené"}>
            <Badge tone={b.surchargePaidAt ? "green" : "gold"}>
              Doplatek {formatPrice(b.surcharge)} {b.surchargePaidAt ? "✓" : "– nezaplaceno"}
            </Badge>
          </button>
        </ActionForm>
      )}
    </>
  );
  const statusBadge = (b: Row["b"]) => (
    <Badge tone={b.status === "attended" ? "green" : b.status === "no_show" ? "red" : "neutral"}>{bookingStatusLabel[b.status]}</Badge>
  );
  const attendance = (b: Row["b"], big?: string) =>
    b.status !== "pending_payment" && (
      <div className={big ? "mt-3 flex gap-2" : "flex gap-1"}>
        {(["attended", "no_show", "confirmed"] as const).map((st) => (
          <ActionForm key={st} action={attendanceAction} className={big && st !== "confirmed" ? "flex-1" : undefined}>
            <input type="hidden" name="bookingId" value={b.id} />
            <input type="hidden" name="status" value={st} />
            <button
              disabled={b.status === st}
              title={st === "confirmed" ? "Zrušit označení" : undefined}
              className={cx(
                "whitespace-nowrap rounded-full border border-linka px-2.5 py-1 text-xs font-semibold hover:border-les disabled:border-les disabled:bg-les disabled:text-papir",
                big && st !== "confirmed" && "w-full",
                big,
              )}
            >
              {st === "attended" ? "✓ Přišel" : st === "no_show" ? "✗ Nepřišel" : "—"}
            </button>
          </ActionForm>
        ))}
      </div>
    );
  const cancel = (b: Row["b"]) => (
    <ActionForm action={adminCancelBookingAction} confirm="Odhlásit klienta z lekce?" className="flex items-center gap-3">
      <input type="hidden" name="bookingId" value={b.id} />
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="refund" defaultChecked /> vrátit vstup</label>
      <button className="text-xs font-semibold text-chyba underline">Odhlásit</button>
    </ActionForm>
  );

  return (
    <>
      <Link href={`/admin/rozvrh?tyden=${mondayOf(dateKey(s.startsAt))}`} className="eyebrow text-les/60 hover:text-les">← Rozvrh</Link>
      <AdminTitle title={`${ct.name} · ${formatDay(s.startsAt)} ${formatRange(s.startsAt, s.durationMin)}`}>
        {s.status === "cancelled" ? <Badge tone="red">Zrušeno</Badge> : <Badge tone="green">{active.reduce((n, { b }) => n + b.seats, 0)}/{s.capacity} přihlášeno</Badge>}
      </AdminTitle>
      <p className="-mt-6 mb-8 text-les/60">{ins?.name ?? "Bez lektora"}{s.room && ` · ${s.room}`}{s.isFree && " · lekce zdarma"}</p>

      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">Přihlášení klienti a docházka</h2>
          {/* phones: one card per client, big attendance buttons */}
          <ul className="space-y-3 md:hidden">
            {active.map(({ b, u }) => (
              <li key={b.id} className="rounded-2xl border border-linka/60 bg-white/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">{who(b, u)}</div>
                  {statusBadge(b)}
                </div>
                <div className="mt-2 text-sm text-les/70">{pay(b)}</div>
                {attendance(b, "flex-1 py-2.5 text-sm")}
                <div className="mt-3 border-t border-linka/40 pt-3">{cancel(b)}</div>
              </li>
            ))}
            {active.length === 0 && <li className="text-sm text-les/50">Zatím nikdo.</li>}
          </ul>
          <Table head={["Klient", "Platba", "Stav", "Docházka", ""]} className="max-md:hidden">
            {active.map(({ b, u }) => (
              <tr key={b.id}>
                <Td>{who(b, u)}</Td>
                <Td>{pay(b)}</Td>
                <Td>{statusBadge(b)}</Td>
                <Td>{attendance(b)}</Td>
                <Td>{cancel(b)}</Td>
              </tr>
            ))}
            {active.length === 0 && <tr><Td className="text-les/50">Zatím nikdo.</Td></tr>}
          </Table>

          {waitlist.length > 0 && (
            <>
              <h2 className="text-lg font-semibold">Pořadník</h2>
              <Table head={["#", "Klient", ""]}>
                {waitlist.map(({ b, u }, i) => (
                  <tr key={b.id}>
                    <Td>{i + 1}.</Td>
                    <Td>{u.name} <span className="text-xs text-les/50">{u.email}</span></Td>
                    <Td>
                      <ActionForm action={adminCancelBookingAction}>
                        <input type="hidden" name="bookingId" value={b.id} />
                        <button className="text-xs font-semibold text-chyba underline">Odebrat</button>
                      </ActionForm>
                    </Td>
                  </tr>
                ))}
              </Table>
            </>
          )}
          {cancelled.length > 0 && (
            <p className="text-sm text-les/50">Zrušené rezervace: {cancelled.map(({ b, u }) => `${u.name}${b.lateCancel ? " (pozdní storno)" : ""}`).join(", ")}</p>
          )}
        </section>

        <aside className="space-y-4">
          {s.status !== "cancelled" && (
            <Card>
              <h2 className="font-semibold">Přidat klienta</h2>
              <ActionForm action={adminAddBookingAction} className="mt-4 space-y-3" resetOnSuccess>
                <input type="hidden" name="sessionId" value={s.id} />
                {/* not a <Field>: a wrapping <label> would click the "remove" button right after picking */}
                <div>
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-les/70">Klient</span>
                  <ClientSelect name="client" clients={clientOpts} />
                </div>
                <Field label="Platba">
                  <Select name="mode">
                    <option value="auto">Strhnout automaticky (členství / permanentka / kredit)</option>
                    <option value="admin">Bez strhnutí (zaplaceno na místě / host)</option>
                  </Select>
                </Field>
                <SubmitButton className="w-full">Přidat na lekci</SubmitButton>
              </ActionForm>
              <p className="mt-2 text-xs text-les/50">Recepce může přidat i nad kapacitu.</p>
            </Card>
          )}
          {isAdmin && (
            <>
              <Panel title="Upravit termín">
                <ActionForm action={updateSessionAction} className="space-y-4">
                  <input type="hidden" name="id" value={s.id} />
                  <Field label="Začátek"><Input name="startsAt" type="datetime-local" defaultValue={toLocalInput(s.startsAt)} required /></Field>
                  <SessionFields types={types} instructorList={instructorList} s={s} />
                  {s.seriesId && (
                    <div className="space-y-1 text-sm">
                      <label className="flex items-center gap-2"><input type="radio" name="scope" value="one" defaultChecked /> Jen tuhle lekci</label>
                      <label className="flex items-center gap-2"><input type="radio" name="scope" value="series" /> Tuhle a všechny další v opakování</label>
                    </div>
                  )}
                  <SubmitButton>Uložit</SubmitButton>
                </ActionForm>
              </Panel>
              {s.status !== "cancelled" && (
                <Card className="border-chyba/30">
                  <h2 className="font-semibold text-chyba">Zrušit lekci</h2>
                  <p className="mt-1 text-sm text-les/60">Všem přihlášeným se vrátí vstup/kredit a přijde jim e-mail.</p>
                  <ActionForm action={cancelSessionAction} className="mt-4" confirm="Opravdu zrušit lekci a informovat klienty?">
                    <input type="hidden" name="id" value={s.id} />
                    <SubmitButton variant="danger">Zrušit lekci</SubmitButton>
                  </ActionForm>
                </Card>
              )}
              <Card className="border-chyba/30">
                <h2 className="font-semibold text-chyba">Smazat z rozvrhu</h2>
                <p className="mt-1 text-sm text-les/60">
                  Lekce zmizí úplně. Když na ni někdo je přihlášený, nejdřív se mu vrátí vstup/kredit a přijde mu e-mail.
                </p>
                <ActionForm action={deleteSessionAction} confirm="Opravdu smazat z rozvrhu?" className="mt-4 space-y-3">
                  <input type="hidden" name="id" value={s.id} />
                  {s.seriesId && (
                    <div className="space-y-1 text-sm">
                      <label className="flex items-center gap-2"><input type="radio" name="scope" value="one" defaultChecked /> Jen tuhle lekci</label>
                      <label className="flex items-center gap-2"><input type="radio" name="scope" value="series" /> Tuhle a všechny další v opakování</label>
                    </div>
                  )}
                  <SubmitButton variant="danger">Smazat lekci</SubmitButton>
                </ActionForm>
              </Card>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
