import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createSessionsAction } from "@/app/admin/actions";
import { AdminTitle, Panel, Table, Td } from "@/components/admin";
import { SessionFields } from "@/components/admin-forms";
import { ActionForm, SubmitButton } from "@/components/forms";
import { spotsLabel } from "@/components/session-card";
import { Badge, Field, Input } from "@/components/ui";
import { getDb } from "@/db";
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
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Datum (od)"><Input name="dateFrom" type="date" defaultValue={today} required /></Field>
                <Field label="Čas začátku"><Input name="time" type="time" defaultValue="18:00" required /></Field>
                <Field label="Opakovat do" hint="Prázdné = jen jeden termín"><Input name="dateUntil" type="date" /></Field>
              </div>
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-les/70">Dny v týdnu (při opakování)</legend>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d, i) => (
                    <label key={d} className="flex cursor-pointer items-center gap-2 rounded-full border border-linka px-3 py-1.5 text-sm has-[:checked]:border-les has-[:checked]:bg-les has-[:checked]:text-papir">
                      <input type="checkbox" name="weekdays" value={i} className="sr-only" /> {d}
                    </label>
                  ))}
                </div>
              </fieldset>
              <SubmitButton>Vytvořit</SubmitButton>
            </ActionForm>
          </Panel>
        </div>
      )}

      <Table head={["Den", "Čas", "Lekce", "Lektor", "Obsazenost", ""]}>
        {sessions.map((s) => {
          const spots = spotsLabel(s);
          return (
            <tr key={s.id} className={s.status === "cancelled" ? "opacity-50" : ""}>
              <Td className="whitespace-nowrap">{formatShortDay(s.startsAt)}</Td>
              <Td className="whitespace-nowrap tabular-nums">{formatRange(s.startsAt, s.durationMin)}</Td>
              <Td>
                <span className="mr-2 inline-block size-2 rounded-full" style={{ background: s.classType.color }} />
                <strong>{s.classType.name}</strong> {s.isFree && <Badge tone="gold">Zdarma</Badge>}
              </Td>
              <Td>{s.instructor?.name ?? "—"}</Td>
              <Td className="whitespace-nowrap">{s.occupied}/{s.capacity} <Badge tone={spots.tone}>{spots.text}</Badge></Td>
              <Td><Link href={`/admin/rozvrh/${s.id}`} className="font-semibold text-zeme underline underline-offset-4">Detail</Link></Td>
            </tr>
          );
        })}
        {sessions.length === 0 && (
          <tr><Td className="py-10 text-center text-les/50" >Tento týden nejsou žádné lekce.</Td></tr>
        )}
      </Table>
    </>
  );
}
