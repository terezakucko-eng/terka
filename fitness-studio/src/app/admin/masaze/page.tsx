import { and, asc, eq, gt, isNull } from "drizzle-orm";
import Link from "next/link";
import {
  addAvailabilityAction,
  adminBookMassageAction,
  adminCancelMassageAction,
  deleteMassageServiceAction,
  removeAvailabilityAction,
  saveMassageServiceAction,
  setMassagePaidAction,
} from "@/app/admin/massage-actions";
import { AdminTitle, Panel, Table, Td } from "@/components/admin";
import { kc } from "@/components/admin-forms";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ImageInput } from "@/components/image-input";
import { Badge, Card, Empty, Field, Input, Select, Textarea } from "@/components/ui";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { massageAvailability, massageBookings, massageServices, users, type MassageService } from "@/db/schema";
import { requireStaff } from "@/lib/auth";
import { dateKey, formatDay, formatShortDay, formatTime } from "@/lib/dates";
import { formatPrice } from "@/lib/money";

function ServiceForm({ m }: { m?: MassageService }) {
  return (
    <ActionForm action={saveMassageServiceAction} className="space-y-4">
      {m && <input type="hidden" name="id" value={m.id} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Název"><Input name="name" defaultValue={m?.name} required placeholder="Relaxační masáž" /></Field>
        <Field label="Délka (min)"><Input name="durationMin" type="number" min={10} step={5} defaultValue={m?.durationMin ?? 60} /></Field>
        <Field label="Jednorázová cena (Kč)"><Input name="price" inputMode="decimal" defaultValue={kc(m?.price)} required /></Field>
        <Field label="Cena pro členy (Kč)" hint="Prázdné = stejná pro všechny">
          <Input name="memberPrice" inputMode="decimal" defaultValue={kc(m?.memberPrice)} />
        </Field>
      </div>
      <Field label="Pořadí"><Input name="sortOrder" type="number" defaultValue={m?.sortOrder ?? 0} className="max-w-32" /></Field>
      <Field label="URL (slug)" hint="Prázdné = z názvu"><Input name="slug" defaultValue={m?.slug} /></Field>
      <Field label="Popis"><Textarea name="description" rows={3} defaultValue={m?.description} /></Field>
      <div className="flex flex-wrap items-center gap-4">
        {m?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.imageUrl} alt="" className="h-20 w-32 rounded-lg object-cover" />
        )}
        <Field label="Fotka"><ImageInput name="image" /></Field>
        {m?.imageUrl && <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="removeImage" /> Odebrat fotku</label>}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={m?.isActive ?? true} /> Nabízet na webu</label>
      <SubmitButton>Uložit</SubmitButton>
    </ActionForm>
  );
}

export default async function AdminMassages() {
  const staff = await requireStaff();
  const isAdmin = staff.role === "admin";
  const db = await getDb();
  const now = new Date();
  const [services, bookings, windows, c] = await Promise.all([
    db.select().from(massageServices).where(isNull(massageServices.archivedAt)).orderBy(asc(massageServices.sortOrder), asc(massageServices.name)),
    db
      .select({ b: massageBookings, u: users })
      .from(massageBookings)
      .leftJoin(users, eq(massageBookings.userId, users.id))
      .where(and(eq(massageBookings.status, "confirmed"), gt(massageBookings.endsAt, now)))
      .orderBy(asc(massageBookings.startsAt)),
    db.select().from(massageAvailability).where(gt(massageAvailability.endsAt, now)).orderBy(asc(massageAvailability.startsAt)),
    getContent(),
  ]);
  const bankAccount = c("massages.bankAccount").trim();
  const active = services.filter((s) => s.isActive);

  return (
    <>
      <AdminTitle title="Masáže">
        <Link href="/masaze" className="eyebrow text-zeme underline underline-offset-4">Zobrazit na webu</Link>
      </AdminTitle>

      {!bankAccount && isAdmin && (
        <p className="mb-6 rounded-2xl bg-zlato/20 p-4 text-sm text-zeme">
          Platba převodem se zatím nenabízí – chybí číslo účtu. Doplň ho v{" "}
          <Link href="/admin/obsah/massages" className="font-semibold underline">Obsah webu → Masáže</Link>.
        </p>
      )}

      <section>
        <h2 className="mb-4 text-xl font-semibold">Nadcházející masáže</h2>
        {bookings.length === 0 ? (
          <Empty>Zatím žádná rezervace.</Empty>
        ) : (
          <Table head={["Kdy", "Masáž", "Klient", "Platba", ""]}>
            {bookings.map(({ b, u }) => (
              <tr key={b.id}>
                <Td className="whitespace-nowrap">
                  <span className="font-semibold">{formatShortDay(b.startsAt)}</span>
                  <br />
                  {formatTime(b.startsAt)} – {formatTime(b.endsAt)}
                </Td>
                <Td>
                  {b.serviceName}
                  {b.note && <p className="mt-1 max-w-xs text-xs text-les/60">„{b.note}“</p>}
                </Td>
                <Td>
                  {u ? (
                    <Link href={`/admin/klienti/${u.id}`} className="font-semibold underline">{u.name}</Link>
                  ) : (
                    <span className="font-semibold">{b.guestName}</span>
                  )}
                  <p className="text-xs text-les/60">{u?.phone ?? b.guestPhone ?? ""} {u?.email ?? b.guestEmail ?? ""}</p>
                </Td>
                <Td className="whitespace-nowrap">
                  {formatPrice(b.price)}
                  {b.memberRate && <span className="ml-1 text-xs text-les/60">(člen)</span>}
                  <br />
                  {b.payment === "pass" ? (
                    <Badge tone="green">Permanentka</Badge>
                  ) : b.paidAt ? (
                    <Badge tone="green">Zaplaceno</Badge>
                  ) : b.payment === "transfer" ? (
                    <Badge tone="gold">Převod · VS {b.variableSymbol}</Badge>
                  ) : (
                    <Badge>Na místě</Badge>
                  )}
                </Td>
                <Td className="space-y-2 text-right">
                  {b.payment !== "pass" && (
                  <ActionForm action={setMassagePaidAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="paid" value={b.paidAt ? "false" : "true"} />
                    <button className="text-xs font-semibold underline">{b.paidAt ? "Zrušit platbu" : "Zaplaceno"}</button>
                  </ActionForm>
                  )}
                  <ActionForm action={adminCancelMassageAction} confirm="Zrušit masáž? Klientovi pošleme e-mail.">
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="notify" value="true" />
                    <button className="text-xs font-semibold text-chyba underline">Zrušit</button>
                  </ActionForm>
                </Td>
              </tr>
            ))}
          </Table>
        )}
        <div className="mt-4">
          <Panel title="+ Zapsat masáž ručně (telefon, recepce)">
            {active.length === 0 ? (
              <p className="text-sm text-les/60">Nejdřív přidej masáž do nabídky.</p>
            ) : (
              <ActionForm action={adminBookMassageAction} resetOnSuccess className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Masáž">
                    <Select name="serviceId" required>
                      {active.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.durationMin} min</option>)}
                    </Select>
                  </Field>
                  <Field label="Začátek"><Input name="startsAt" type="datetime-local" required /></Field>
                  <Field label="Platba">
                    <Select name="payment" defaultValue="on_site">
                      <option value="on_site">Na místě</option>
                      <option value="pass">Permanentkou (klient s účtem)</option>
                      <option value="transfer">Převodem</option>
                    </Select>
                  </Field>
                  <Field label="Jméno klienta"><Input name="name" /></Field>
                  <Field label="Telefon"><Input name="phone" type="tel" /></Field>
                  <Field label="E-mail" hint="Pokud má účet, přiřadí se k němu"><Input name="email" type="email" /></Field>
                </div>
                <Field label="Poznámka"><Input name="note" /></Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="memberRate" /> Účtovat cenu pro členy (u klienta s aktivním členstvím se použije sama)</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify" defaultChecked /> Poslat klientovi potvrzení e-mailem</label>
                <SubmitButton>Zapsat</SubmitButton>
              </ActionForm>
            )}
          </Panel>
        </div>
      </section>

      {isAdmin && (
        <section className="mt-12">
          <h2 className="mb-1 text-xl font-semibold">Kdy masíruju</h2>
          <p className="mb-4 text-sm text-les/60">Z těchto oken web sám nabízí volné časy podle délky masáže.</p>
          <Card>
            <ActionForm action={addAvailabilityAction} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Den"><Input name="date" type="date" defaultValue={dateKey(now)} required /></Field>
              <Field label="Od"><Input name="from" type="time" defaultValue="14:00" step={900} required /></Field>
              <Field label="Do"><Input name="to" type="time" defaultValue="19:00" step={900} required /></Field>
              <Field label="Opakovat">
                <Select name="weeks" defaultValue="1">
                  <option value="1">Jen tento den</option>
                  {[2, 4, 8, 12].map((n) => <option key={n} value={n}>{n} týdnů</option>)}
                </Select>
              </Field>
              <SubmitButton>Přidat</SubmitButton>
            </ActionForm>
          </Card>
          <div className="mt-4 flex flex-wrap gap-2">
            {windows.length === 0 && <Empty>Zatím nemáš vypsané žádné časy – klienti nemají co rezervovat.</Empty>}
            {windows.map((w) => (
              <div key={w.id} className="flex items-center gap-3 rounded-full border border-linka/60 bg-white/60 py-1.5 pl-4 pr-2 text-sm">
                <span><strong>{formatDay(w.startsAt)}</strong> {formatTime(w.startsAt)}–{formatTime(w.endsAt)}</span>
                <ActionForm action={removeAvailabilityAction}>
                  <input type="hidden" name="id" value={w.id} />
                  <button aria-label="Odebrat" className="rounded-full px-2 text-les/50 hover:bg-chyba/10 hover:text-chyba">×</button>
                </ActionForm>
              </div>
            ))}
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">Nabídka masáží</h2>
          <div className="space-y-3">
            <Panel title="+ Nová masáž"><ServiceForm /></Panel>
            {services.map((m) => (
              <Panel key={m.id} title={`${m.name} · ${m.durationMin} min · ${formatPrice(m.price)}${m.memberPrice !== null ? ` / členové ${formatPrice(m.memberPrice)}` : ""}${m.isActive ? "" : " · skryto"}`}>
                <ServiceForm m={m} />
                <ActionForm
                  action={deleteMassageServiceAction}
                  confirm={`Opravdu smazat masáž „${m.name}“?`}
                  className="mt-4 border-t border-linka/60 pt-4"
                >
                  <input type="hidden" name="id" value={m.id} />
                  <button className="text-xs font-semibold text-chyba underline">Smazat masáž</button>
                </ActionForm>
              </Panel>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
