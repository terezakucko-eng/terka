import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  adjustCreditsAction,
  cancelEntitlementAction,
  grantEntitlementAction,
  sellProductAction,
  updateClientAction,
} from "@/app/admin/actions";
import { AdminTitle, Stat, Table, Td } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { bookingStatusLabel, creditReasonLabel, entitlementKindLabel, methodLabel, orderStatusLabel } from "@/components/labels";
import { Badge, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { userBookings, userEntitlements, userLedger, userOrders } from "@/lib/account";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { activeProducts } from "@/lib/queries";

export default async function ClientDetail({ params }: PageProps<"/admin/klienti/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) notFound();
  const [upcoming, past, ents, orderList, ledger, productList] = await Promise.all([
    userBookings(db, u.id, "upcoming"),
    userBookings(db, u.id, "past", new Date(), 30),
    userEntitlements(db, u.id, false),
    userOrders(db, u.id),
    userLedger(db, u.id),
    activeProducts(db),
  ]);
  const now = new Date();
  const attended = past.filter(({ b }) => b.status === "attended").length;

  return (
    <>
      <Link href="/admin/klienti" className="eyebrow text-les/60 hover:text-les">← Klienti</Link>
      <AdminTitle title={u.name}>
        <span className="text-sm text-les/60">{u.email} · {u.phone ?? "bez telefonu"}</span>
      </AdminTitle>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Kredit" value={u.creditBalance} />
        <Stat label="Nadcházející rezervace" value={upcoming.length} />
        <Stat label="Účast (posl. 30 lekcí)" value={attended} sub={`registrace ${formatDate(u.createdAt)}`} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <Card>
          <h2 className="font-semibold">Prodej na recepci</h2>
          <p className="mt-1 text-xs text-les/60">Hotově nebo kartou na terminálu – připíše se okamžitě.</p>
          <ActionForm action={sellProductAction} className="mt-4 space-y-3">
            <input type="hidden" name="userId" value={u.id} />
            <Select name="productId" required defaultValue="">
              <option value="" disabled>Vyber produkt…</option>
              {productList.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatPrice(p.price)}</option>)}
            </Select>
            <SubmitButton className="w-full">Prodat</SubmitButton>
          </ActionForm>
        </Card>
        <Card>
          <h2 className="font-semibold">Upravit kredit</h2>
          <ActionForm action={adjustCreditsAction} className="mt-4 space-y-3" resetOnSuccess>
            <input type="hidden" name="userId" value={u.id} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Počet (+/−)"><Input name="delta" type="number" required placeholder="5" /></Field>
              <Field label="Důvod">
                <Select name="reason"><option value="admin">Úprava</option><option value="bonus">Bonus</option></Select>
              </Field>
            </div>
            <Field label="Poznámka"><Input name="note" placeholder="např. kompenzace" /></Field>
            <SubmitButton className="w-full">Uložit</SubmitButton>
          </ActionForm>
        </Card>
        <Card>
          <h2 className="font-semibold">Přidělit vstupy / permanentku</h2>
          <ActionForm action={grantEntitlementAction} className="mt-4 space-y-3" resetOnSuccess>
            <input type="hidden" name="userId" value={u.id} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Typ">
                <Select name="kind">
                  <option value="free">Vstup zdarma</option>
                  <option value="pass">Permanentka</option>
                  <option value="membership">Členství</option>
                </Select>
              </Field>
              <Field label="Počet vstupů" hint="Prázdné = neomezeně"><Input name="entries" type="number" min={1} defaultValue={1} /></Field>
              <Field label="Platnost (dny)"><Input name="validityDays" type="number" min={1} defaultValue={30} /></Field>
              <Field label="Limit / týden"><Input name="weeklyLimit" type="number" min={1} /></Field>
            </div>
            <Field label="Název"><Input name="name" placeholder="např. Dárek k narozeninám" /></Field>
            <SubmitButton className="w-full">Přidělit</SubmitButton>
          </ActionForm>
        </Card>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Permanentky, členství a vstupy zdarma</h2>
        <Table head={["Název", "Typ", "Čerpání", "Platnost", ""]}>
          {ents.map((e) => {
            const valid = e.status === "active" && e.validUntil > now;
            return (
              <tr key={e.id} className={valid ? "" : "opacity-50"}>
                <Td><strong>{e.name}</strong>{e.note && <><br /><span className="text-xs text-les/50">{e.note}</span></>}</Td>
                <Td>{entitlementKindLabel[e.kind]}{e.subscriptionId && <Badge tone={e.renewalCancelled ? "red" : "green"}>{e.renewalCancelled ? "Obnova zrušena" : "Předplatné"}</Badge>}</Td>
                <Td>{e.entriesTotal === null ? "neomezeně" : `${e.entriesUsed}/${e.entriesTotal}`}{e.weeklyLimit ? ` · ${e.weeklyLimit}×/týden` : ""}</Td>
                <Td className="whitespace-nowrap">{formatDate(e.validFrom)} – {formatDate(e.validUntil)}</Td>
                <Td>
                  {valid && (
                    <ActionForm action={cancelEntitlementAction} confirm="Zneplatnit?">
                      <input type="hidden" name="id" value={e.id} />
                      <button className="text-xs font-semibold text-chyba underline">Zneplatnit</button>
                    </ActionForm>
                  )}
                </Td>
              </tr>
            );
          })}
          {ents.length === 0 && <tr><Td className="text-les/50">Žádné.</Td></tr>}
        </Table>
      </section>

      <div className="mt-10 grid gap-8 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Rezervace</h2>
          <Table head={["Lekce", "Kdy", "Platba", "Stav"]}>
            {[...upcoming, ...past].map(({ b, s, ct }) => (
              <tr key={b.id}>
                <Td><Link href={`/admin/rozvrh/${s.id}`} className="underline-offset-4 hover:underline">{ct.name}</Link></Td>
                <Td className="whitespace-nowrap">{formatDateTime(s.startsAt)}</Td>
                <Td>{b.method ? methodLabel[b.method] : "—"}</Td>
                <Td>{bookingStatusLabel[b.status]}{b.lateCancel && " (pozdě)"}</Td>
              </tr>
            ))}
          </Table>
        </section>
        <section className="space-y-8">
          <div>
            <h2 className="mb-3 text-lg font-semibold">Platby</h2>
            <Table head={["Č.", "Položka", "Částka", "Stav"]}>
              {orderList.map((o) => (
                <tr key={o.id}>
                  <Td>{o.number}</Td>
                  <Td>{o.description}<br /><span className="text-xs text-les/50">{formatDateTime(o.createdAt)} · {o.provider}</span></Td>
                  <Td className="whitespace-nowrap">{formatPrice(o.amount)}</Td>
                  <Td>{orderStatusLabel[o.status]}</Td>
                </tr>
              ))}
            </Table>
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold">Pohyby kreditu</h2>
            <Table head={["Kdy", "Důvod", "Změna", "Zůstatek"]}>
              {ledger.map((t) => (
                <tr key={t.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(t.createdAt)}</Td>
                  <Td>{creditReasonLabel[t.reason]}{t.note && ` · ${t.note}`}</Td>
                  <Td className={t.delta > 0 ? "text-ok" : ""}>{t.delta > 0 ? "+" : ""}{t.delta}</Td>
                  <Td>{t.balanceAfter}</Td>
                </tr>
              ))}
            </Table>
          </div>
        </section>
      </div>

      <Card className="mt-10 max-w-2xl">
        <h2 className="font-semibold">Údaje klienta</h2>
        <ActionForm action={updateClientAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="userId" value={u.id} />
          <Field label="Jméno"><Input name="name" defaultValue={u.name} required /></Field>
          <Field label="E-mail"><Input name="email" type="email" defaultValue={u.email} required /></Field>
          <Field label="Telefon"><Input name="phone" defaultValue={u.phone ?? ""} /></Field>
          <Field label="Role">
            <Select name="role" defaultValue={u.role}>
              <option value="client">Klient</option>
              <option value="instructor">Lektor (docházka)</option>
              <option value="admin">Administrátor</option>
            </Select>
          </Field>
          <div className="sm:col-span-2"><Field label="Interní poznámka"><Textarea name="adminNote" rows={2} defaultValue={u.adminNote ?? ""} /></Field></div>
          <div className="sm:col-span-2"><SubmitButton>Uložit</SubmitButton></div>
        </ActionForm>
      </Card>
    </>
  );
}
