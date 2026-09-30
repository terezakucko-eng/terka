import Link from "next/link";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createSessionsAction, deleteSessionsAction, deleteSessionsRangeAction } from "@/app/admin/actions";
import { AdminTitle, Panel, Table, Td } from "@/components/admin";
import { SessionFields } from "@/components/admin-forms";
import { TypeDefaults } from "@/components/type-defaults";
import { ActionForm, SubmitButton } from "@/components/forms";
import { spotsLabel } from "@/components/session-card";
import { Badge, Field, Input, Select, cx } from "@/components/ui";
import { getDb } from "@/db";
import { bookings, users } from "@/db/schema";
import { splitName } from "@/lib/client-list";
import { requireStaff } from "@/lib/auth";
import { WEEKDAYS, addDays, dateKey, formatRange, formatShortDay, isDateKey, mondayOf, pragueLocalToDate } from "@/lib/dates";
import { activeClassTypes, activeInstructors, listSessions } from "@/lib/queries";

export default async function AdminSchedule({ searchParams }: PageProps<"/admin/rozvrh">) {
  const user = await requireStaff();
  const sp = await searchParams;
  const today = dateKey(new Date());
  const monday = mondayOf(isDateKey(sp.tyden) ? sp.tyden : today);
  const db = await getDb();
  const [sessions, types, instructorList] = await Promise.all([
    listSessions(db, pragueLocalToDate(monday), pragueLocalToDate(addDays(monday, 7))),
    activeClassTypes(db),
    activeInstructors(db),
  ]);

  // who's signed up, so the list can be read without opening each class
  const signups = sessions.length
    ? await db
        .select({ sessionId: bookings.sessionId, status: bookings.status, guestName: bookings.guestName, userId: users.id, name: users.name })
        .from(bookings)
        .innerJoin(users, eq(bookings.userId, users.id))
        .where(and(inArray(bookings.sessionId, sessions.map((x) => x.id)), ne(bookings.status, "cancelled")))
        .orderBy(asc(bookings.createdAt))
    : [];
  const collator = new Intl.Collator("cs");
  const peopleOf = (id: string) => {
    const list = signups.filter((x) => x.sessionId === id);
    const sortName = (n: string) => { const { first, last } = splitName(n); return last ? `${last} ${first}` : first; };
    const going = list.filter((x) => x.status !== "waitlist").sort((a, b) => collator.compare(sortName(a.name), sortName(b.name)));
    return { going, waiting: list.filter((x) => x.status === "waitlist"), sortName };
  };

  const isAdmin = user.role === "admin";
  type Item = (typeof sessions)[number];
  const occupancy = (s: Item) => {
    const spots = spotsLabel(s);
    const { going, waiting, sortName } = peopleOf(s.id);
    const head = <span className="whitespace-nowrap">{s.occupied}/{s.capacity} <Badge tone={spots.tone}>{spots.text}</Badge></span>;
    if (!going.length && !waiting.length) return head;
    return (
      <details className="group">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          {head} <span className="ml-1 text-xs text-les/50 underline group-open:hidden">kdo</span>
        </summary>
        <ul className="mt-2 space-y-0.5 text-xs">
          {going.map((x) => (
            <li key={x.userId + x.status}>
              <Link href={`/admin/klienti/${x.userId}`} className="hover:underline">{sortName(x.name)}</Link>
              {x.guestName && <span className="text-les/60"> +1 {x.guestName}</span>}
              {x.status === "pending_payment" && <span className="text-zeme"> · čeká na platbu</span>}
              {x.status === "no_show" && <span className="text-chyba"> · nepřišel/a</span>}
            </li>
          ))}
          {waiting.map((x, i) => (
            <li key={x.userId + "w"} className="text-les/60">
              {i + 1}. náhradník: <Link href={`/admin/klienti/${x.userId}`} className="hover:underline">{sortName(x.name)}</Link>
            </li>
          ))}
        </ul>
      </details>
    );
  };
  // phones: a compact list grouped by day instead of the wide table
  const byDay = [...new Set(sessions.map((x) => dateKey(x.startsAt)))];
  const mobileList = (
    <div className="space-y-5 md:hidden">
      {byDay.map((d) => (
        <section key={d}>
          <h2 className="eyebrow mb-2 text-les/60">{formatShortDay(sessions.find((x) => dateKey(x.startsAt) === d)!.startsAt)}</h2>
          <ul className="divide-y divide-linka/50 overflow-hidden rounded-2xl border border-linka/60 bg-white/60">
            {sessions.filter((x) => dateKey(x.startsAt) === d).map((s) => (
              <li key={s.id} className={cx("flex gap-3 p-3", s.status === "cancelled" && "opacity-50")}>
                {isAdmin && (
                  <input type="checkbox" name="ids" value={s.id} aria-label={`Vybrat ${s.classType.name}`} className="mt-1 size-4 shrink-0" />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <Link href={`/admin/rozvrh/${s.id}`} className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ background: s.classType.color }} />
                      {s.classType.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-les/60">{formatRange(s.startsAt, s.durationMin)}</span>
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-les/70">
                    {s.isFree && <Badge tone="gold">Zdarma</Badge>}
                    {s.status === "cancelled" && <Badge tone="red">Zrušeno</Badge>}
                    <span>{s.instructor?.name ?? "Bez lektora"}</span>
                  </div>
                  <div className="mt-1.5">{occupancy(s)}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {sessions.length === 0 && <p className="py-10 text-center text-les/50">Tento týden nejsou žádné lekce.</p>}
    </div>
  );
  const table = (
    <Table head={[...(isAdmin ? [""] : []), "Den", "Čas", "Lekce", "Lektor", "Obsazenost", ""]} className="max-md:hidden">
      {sessions.map((s) => {
        return (
          <tr key={s.id} className={s.status === "cancelled" ? "opacity-50" : ""}>
            {isAdmin && (
              <Td>
                <input type="checkbox" name="ids" value={s.id} aria-label={`Vybrat ${s.classType.name}`} className="size-4" />
              </Td>
            )}
            <Td className="whitespace-nowrap">{formatShortDay(s.startsAt)}</Td>
            <Td className="whitespace-nowrap tabular-nums">{formatRange(s.startsAt, s.durationMin)}</Td>
            <Td>
              <span className="mr-2 inline-block size-2 rounded-full" style={{ background: s.classType.color }} />
              <strong>{s.classType.name}</strong> {s.isFree && <Badge tone="gold">Zdarma</Badge>}
            </Td>
            <Td>{s.instructor?.name ?? "—"}</Td>
            <Td>
              {occupancy(s)}
            </Td>
            <Td><Link href={`/admin/rozvrh/${s.id}`} className="font-semibold text-zeme underline underline-offset-4">Detail</Link></Td>
          </tr>
        );
      })}
      {sessions.length === 0 && (
        <tr><Td className="py-10 text-center text-les/50" >Tento týden nejsou žádné lekce.</Td></tr>
      )}
    </Table>
  );

  return (
    <>
      <AdminTitle title="Rozvrh">
        <Link href={`/admin/rozvrh?tyden=${addDays(monday, -7)}`} className="flex size-10 items-center justify-center rounded-full border border-linka"><ChevronLeft className="size-5" /></Link>
        <span className="self-center px-2 text-sm font-semibold">{monday.split("-").reverse().join(". ")} +7</span>
        <Link href={`/admin/rozvrh?tyden=${addDays(monday, 7)}`} className="flex size-10 items-center justify-center rounded-full border border-linka"><ChevronRight className="size-5" /></Link>
      </AdminTitle>

      {user.role === "admin" && (
        <div className="mb-8">
          <Panel title="+ Přidat lekce (jednorázově nebo opakovaně)">
            <ActionForm action={createSessionsAction} className="space-y-5">
              <SessionFields types={types} instructorList={instructorList} />
              <TypeDefaults types={types.map((t) => ({ id: t.id, capacity: t.capacity, durationMin: t.durationMin, creditCost: t.creditCost, dropInPrice: t.dropInPrice }))} />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Datum (od)"><Input name="dateFrom" type="date" defaultValue={today} required /></Field>
                <Field label="Čas začátku"><Input name="time" type="time" defaultValue="18:00" required /></Field>
                <Field label="Opakovat do" hint="Nutné při zaškrtnutých dnech · prázdné = jedna lekce v den „od“"><Input name="dateUntil" type="date" /></Field>
              </div>
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-les/70">Dny v týdnu (při opakování)</legend>
                <p className="mb-3 text-xs text-les/60">Zaškrtni dny. Čas u dne vyplň jen tehdy, když se liší od „Čas začátku“.</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {WEEKDAYS.map((d, i) => (
                    <div key={d} className="flex items-center gap-2 rounded-xl border border-linka px-3 py-2 has-[:checked]:border-les has-[:checked]:bg-krem/60">
                      <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" name="weekdays" value={i} className="size-4" /> {d}
                      </label>
                      <input type="time" name={`time_${i}`} aria-label={`Čas – ${d}`} className="rounded-lg border border-linka bg-white/70 px-2 py-1 text-sm tabular-nums" />
                    </div>
                  ))}
                </div>
              </fieldset>
              <SubmitButton>Vytvořit</SubmitButton>
            </ActionForm>
          </Panel>
        </div>
      )}

      {isAdmin && (
        <div className="mb-8">
          <Panel title="Hromadně smazat lekce (od–do)">
            <ActionForm
              action={deleteSessionsRangeAction}
              confirm="Opravdu smazat všechny lekce v tomhle rozmezí? Přihlášeným klientům se vrátí vstup/kredit a přijde jim e-mail."
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Od"><Input name="from" type="date" defaultValue={today} required /></Field>
                <Field label="Do (včetně)"><Input name="to" type="date" required /></Field>
                <Field label="Typ lekce">
                  <Select name="classTypeId" defaultValue="">
                    <option value="">Všechny lekce</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <SubmitButton variant="danger">Smazat lekce v rozmezí</SubmitButton>
            </ActionForm>
          </Panel>
        </div>
      )}

      {isAdmin && sessions.length > 0 ? (
        <ActionForm
          action={deleteSessionsAction}
          confirm="Smazat zaškrtnuté lekce z rozvrhu? Přihlášeným klientům se vrátí vstup/kredit a přijde jim e-mail."
          className="space-y-3"
        >
          {mobileList}
          {table}
          <SubmitButton variant="ghost" className="text-chyba">Smazat zaškrtnuté lekce</SubmitButton>
        </ActionForm>
      ) : (
        <>
          {mobileList}
          {table}
        </>
      )}
    </>
  );
}
