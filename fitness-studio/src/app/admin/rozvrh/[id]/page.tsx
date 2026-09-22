import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import {
  adminAddBookingAction,
  adminCancelBookingAction,
  attendanceAction,
  cancelSessionAction,
  deleteSessionAction,
  updateSessionAction,
} from "@/app/admin/actions";
import { AdminTitle, Panel, Table, Td } from "@/components/admin";
import { SessionFields } from "@/components/admin-forms";
import { ActionForm, SubmitButton } from "@/components/forms";
import { bookingStatusLabel, methodLabel } from "@/components/labels";
import { Badge, Card, Field, Input, Select } from "@/components/ui";
import { getDb } from "@/db";
import { bookings, users } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { formatDay, formatRange, toLocalInput } from "@/lib/dates";
import { activeClassTypes, activeInstructors, sessionDetail } from "@/lib/queries";

export default async function AdminSessionPage({ params }: PageProps<"/admin/rozvrh/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const detail = await sessionDetail(db, id);
  if (!detail) notFound();
  const { s, ct, ins } = detail;
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

  return (
    <>
      <Link href="/admin/rozvrh" className="eyebrow text-les/60 hover:text-les">← Rozvrh</Link>
      <AdminTitle title={`${ct.name} · ${formatDay(s.startsAt)} ${formatRange(s.startsAt, s.durationMin)}`}>
        {s.status === "cancelled" ? <Badge tone="red">Zrušeno</Badge> : <Badge tone="green">{active.length}/{s.capacity} přihlášeno</Badge>}
      </AdminTitle>
      <p className="-mt-6 mb-8 text-les/60">{ins?.name ?? "Bez lektora"}{s.room && ` · ${s.room}`}{s.isFree && " · lekce zdarma"}</p>

      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <section className="space-y-6">
          <h2 className="text-lg font-semibold">Přihlášení klienti a docházka</h2>
          <Table head={["Klient", "Platba", "Stav", "Docházka", ""]}>
            {active.map(({ b, u }) => (
              <tr key={b.id}>
                <Td>
                  {isAdmin ? <Link href={`/admin/klienti/${u.id}`} className="font-semibold underline-offset-4 hover:underline">{u.name}</Link> : <strong>{u.name}</strong>}
                  <br /><span className="text-xs text-les/50">{u.phone ?? u.email}</span>
                </Td>
                <Td>{b.method ? methodLabel[b.method] : "—"}</Td>
                <Td><Badge tone={b.status === "attended" ? "green" : b.status === "no_show" ? "red" : "neutral"}>{bookingStatusLabel[b.status]}</Badge></Td>
                <Td>
                  {b.status !== "pending_payment" && (
                    <div className="flex gap-1">
                      {(["attended", "no_show", "confirmed"] as const).map((st) => (
                        <ActionForm key={st} action={attendanceAction}>
                          <input type="hidden" name="bookingId" value={b.id} />
                          <input type="hidden" name="status" value={st} />
                          <button disabled={b.status === st} className="rounded-full border border-linka px-2.5 py-1 text-xs font-semibold hover:border-les disabled:border-les disabled:bg-les disabled:text-papir">
                            {st === "attended" ? "✓ Přišel" : st === "no_show" ? "✗ Nepřišel" : "—"}
                          </button>
                        </ActionForm>
                      ))}
                    </div>
                  )}
                </Td>
                <Td>
                  <ActionForm action={adminCancelBookingAction} confirm="Odhlásit klienta z lekce?">
                    <input type="hidden" name="bookingId" value={b.id} />
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="refund" defaultChecked /> vrátit</label>
                    <button className="text-xs font-semibold text-chyba underline">Odhlásit</button>
                  </ActionForm>
                </Td>
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
                <Field label="E-mail klienta"><Input name="client" type="email" required /></Field>
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
              {list.length === 0 && (
                <ActionForm action={deleteSessionAction} confirm="Smazat termín?">
                  <input type="hidden" name="id" value={s.id} />
                  <SubmitButton variant="ghost">Smazat termín (bez rezervací)</SubmitButton>
                </ActionForm>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
