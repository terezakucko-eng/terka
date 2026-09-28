import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  adjustCreditsAction,
  cancelEntitlementAction,
  clearPauseAction,
  deductSolariumAction,
  deleteClientAction,
  grantEntitlementAction,
  sellProductAction,
  updateClientAction,
} from "@/app/admin/actions";
import { AdminTitle, Stat, Table, Td } from "@/components/admin";
import { Avatar } from "@/components/avatar";
import { MONTHS, formatDayMonth } from "@/lib/profile";
import { ActionForm, SubmitButton } from "@/components/forms";
import { bookingStatusLabel, creditReasonLabel, entitlementKindLabel, methodLabel, orderStatusLabel } from "@/components/labels";
import { Badge, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { userBookings, userEntitlements, userLedger, userOrders } from "@/lib/account";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { sellableProducts } from "@/lib/queries";
import { normalizePhone } from "@/lib/phone";
import { recentSolariumUses, solariumPasses } from "@/domain/solarium";
import { greetName } from "@/lib/vocative";
import { memberStrikes } from "@/domain/strikes";

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
    sellableProducts(db),
  ]);
  const [sunPasses, sunUses] = await Promise.all([solariumPasses(db, u.id), recentSolariumUses(db, u.id, 5)]);
  const sunLeft = sunPasses.reduce((s, p) => s + p.left, 0);
  const now = new Date();
  const attended = past.filter(({ b }) => b.status === "attended").length;
  const strikes = await memberStrikes(db, u.id, now);
  const paused = u.bookingPausedUntil && u.bookingPausedUntil > now ? u.bookingPausedUntil : null;

  return (
    <>
      <Link href="/admin/klienti" className="eyebrow text-les/60 hover:text-les">← Klienti</Link>
      <div className="mb-2 flex items-center gap-4">
        <Avatar user={u} size={64} className="text-2xl" />
        <div className="text-sm text-les/70">
          {u.nickname && <p>Přezdívka: <strong>{u.nickname}</strong></p>}
          {u.birthDate && <p>Narozeniny: <strong>{formatDate(new Date(`${u.birthDate}T12:00:00Z`))}</strong></p>}
          {u.nameDay && <p>Svátek: <strong>{formatDayMonth(u.nameDay)}</strong></p>}
          <p>{u.healthConfirmedAt ? `Zdravotní způsobilost potvrzena ${formatDate(u.healthConfirmedAt)}` : "Zdravotní způsobilost zatím nepotvrzena (potvrdí při další rezervaci)"}</p>
        </div>
      </div>
      <AdminTitle title={u.name}>
        <span className="text-sm text-les/60">{u.email} · {u.phone ?? "bez telefonu"}{u.passwordHash.startsWith("!") && " · převedený účet, heslo zatím nenastaveno"}</span>
      </AdminTitle>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Kredit" value={u.creditBalance} sub={u.creditBalance > 0 && u.creditExpiresAt ? `platí do ${formatDate(u.creditExpiresAt)}` : undefined} />
        <Stat label="Nadcházející rezervace" value={upcoming.length} />
        <Stat label="Účast (posl. 30 lekcí)" value={attended} sub={`registrace ${formatDate(u.createdAt)}`} />
      </div>

      {(paused || strikes.strikes > 0) && (
        <Card className={`mt-6 flex flex-wrap items-center justify-between gap-4 ${paused ? "border-chyba/40" : ""}`}>
          <div className="text-sm">
            <h2 className="font-semibold">Pozdní odhlášení a nepříchody (členství)</h2>
            <p className="mt-1 text-les/70">
              {paused ? <>Přihlašování pozastaveno do <strong>{formatDate(paused)}</strong>. </> : null}
              Prohřešků za posledních {strikes.windowDays} dní: <strong>{strikes.strikes}</strong>
              {strikes.limit ? ` (pauza při ${strikes.limit})` : " (pauzy vypnuté v Nastavení)"}
            </p>
          </div>
          <ActionForm action={clearPauseAction} confirm={paused ? "Zrušit pauzu a vynulovat prohřešky?" : "Vynulovat prohřešky?"}>
            <input type="hidden" name="userId" value={u.id} />
            <SubmitButton variant="outline">{paused ? "Zrušit pauzu" : "Vynulovat"}</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <WhatsAppCard phone={u.phone} name={u.name} consent={u.whatsappConsent} />

      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Solárium</h2>
          <p className="mt-1 text-sm text-les/70">
            {sunLeft ? <>Zbývá <strong>{sunLeft} min</strong>{sunPasses.length > 1 ? ` (${sunPasses.length} permanentky)` : ""}, platí do {formatDate(sunPasses[0].validUntil)}</> : "Žádná platná permanentka na solárium."}
          </p>
          {sunUses.length > 0 && (
            <p className="mt-1 text-xs text-les/50">
              Naposledy: {sunUses.map((x) => `${formatDate(x.createdAt)} ${x.minutes} min`).join(" · ")}
            </p>
          )}
        </div>
        {sunLeft > 0 && (
          <ActionForm action={deductSolariumAction} resetOnSuccess className="flex items-end gap-3">
            <input type="hidden" name="userId" value={u.id} />
            <Field label="Minut na soláriu"><Input name="minutes" type="number" min={1} max={sunLeft} required className="w-28" /></Field>
            <SubmitButton>Odečíst</SubmitButton>
          </ActionForm>
        )}
      </Card>

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
                  <option value="solarium">Solárium (minuty)</option>
                  <option value="massage_pass">Masáže (na kteroukoli)</option>
                </Select>
              </Field>
              <Field label="Počet vstupů / minut" hint="U solária minuty · prázdné = neomezeně"><Input name="entries" type="number" min={1} defaultValue={1} /></Field>
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
          <Field label="Přezdívka"><Input name="nickname" maxLength={30} defaultValue={u.nickname ?? ""} /></Field>
          <Field label="Narozeniny"><Input name="birthDate" type="date" defaultValue={u.birthDate ?? ""} /></Field>
          <Field label="Svátek">
            <div className="flex gap-2">
              <Select name="nameDayDay" defaultValue={u.nameDay ? Number(u.nameDay.slice(3)) : ""} aria-label="Den svátku">
                <option value="">Den</option>
                {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}.</option>)}
              </Select>
              <Select name="nameDayMonth" defaultValue={u.nameDay ? Number(u.nameDay.slice(0, 2)) : ""} aria-label="Měsíc svátku">
                <option value="">Měsíc</option>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </Select>
            </div>
          </Field>
          <Field label="Role">
            <Select name="role" defaultValue={u.role}>
              <option value="client">Klient</option>
              <option value="instructor">Lektor (docházka)</option>
              <option value="admin">Administrátor</option>
            </Select>
          </Field>
          <fieldset className="flex flex-wrap gap-5 text-sm sm:col-span-2">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-les/70">Souhlas s novinkami</legend>
            <label className="flex items-center gap-2"><input type="checkbox" name="marketingConsent" defaultChecked={u.marketingConsent} /> E-mail</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="smsConsent" defaultChecked={u.smsConsent} /> SMS</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="whatsappConsent" defaultChecked={u.whatsappConsent} /> WhatsApp</label>
          </fieldset>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="remindersOptIn" defaultChecked={u.remindersOptIn} /> Posílat připomínku lekce/masáže 3 hodiny předem
          </label>
          <div className="sm:col-span-2"><Field label="Interní poznámka"><Textarea name="adminNote" rows={2} defaultValue={u.adminNote ?? ""} /></Field></div>
          <div className="sm:col-span-2"><SubmitButton>Uložit</SubmitButton></div>
        </ActionForm>
      </Card>

      {u.role === "client" && (
        <Card className="mt-6 border-chyba/30">
          <h2 className="font-semibold">Smazat klienta</h2>
          <p className="mt-1 text-sm text-les/60">
            Smaže účet i se vším: rezervace, permanentky, kredit, platby, masáže. Nejde to vrátit.
          </p>
          <ActionForm
            action={deleteClientAction}
            confirm={`Opravdu natrvalo smazat klienta ${u.name}?`}
            className="mt-4"
          >
            <input type="hidden" name="userId" value={u.id} />
            <SubmitButton variant="outline" className="border-chyba text-chyba">Smazat klienta</SubmitButton>
          </ActionForm>
        </Card>
      )}
    </>
  );
}

/**
 * Plain GET form to wa.me – opens WhatsApp (app or web.whatsapp.com) with the
 * client's chat and the text prefilled; you just press Send there.
 */
function WhatsAppCard({ phone, name, consent }: { phone: string | null; name: string; consent: boolean }) {
  const e164 = normalizePhone(phone);
  return (
    <Card className="mt-6">
      <h2 className="font-semibold">Napsat na WhatsApp</h2>
      {e164 ? (
        <form action={`https://wa.me/${e164.slice(1)}`} method="get" target="_blank" className="mt-3 space-y-3">
          <Textarea name="text" rows={3} defaultValue={`Ahoj ${greetName(name)}, `} aria-label="Text zprávy" />
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" variant="outline">Otevřít WhatsApp</Button>
            <span className="text-xs text-les/60">
              Otevře se chat s klientem a text předvyplněný – odešleš ho ve WhatsAppu.
              {!consent && " Klient nemá souhlas s novinkami přes WhatsApp – piš jen provozní věci."}
            </span>
          </div>
        </form>
      ) : (
        <p className="mt-2 text-sm text-les/60">Klient nemá vyplněný platný telefon.</p>
      )}
    </Card>
  );
}
