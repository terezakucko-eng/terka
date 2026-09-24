import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getDb } from "@/db";
import { SessionCard } from "@/components/session-card";
import { Container, Empty, PageHeader, cx } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import {
  WEEKDAYS,
  addDays,
  dateKey,
  isDateKey,
  mondayOf,
  pragueLocalToDate,
} from "@/lib/dates";
import { activeClassTypes, listSessions } from "@/lib/queries";
import { getContent } from "@/content";

export const metadata: Metadata = { title: "Rozvrh a rezervace" };

const short = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", timeZone: "UTC" });
const keyToUtc = (k: string) => new Date(`${k}T12:00:00Z`);

export default async function SchedulePage({ searchParams }: PageProps<"/rozvrh">) {
  const sp = await searchParams;
  const today = dateKey(new Date());
  const monday = mondayOf(isDateKey(sp.tyden) ? sp.tyden : today);
  const lekce = typeof sp.lekce === "string" ? sp.lekce : undefined;

  const db = await getDb();
  const [user, c] = await Promise.all([getCurrentUser(), getContent()]);
  const types = await activeClassTypes(db);
  const filter = types.find((t) => t.slug === lekce);
  const sessions = await listSessions(
    db,
    pragueLocalToDate(monday),
    pragueLocalToDate(addDays(monday, 7)),
    { classTypeId: filter?.id, userId: user?.id },
  );

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const byDay = new Map(days.map((d) => [d, sessions.filter((s) => dateKey(s.startsAt) === d)]));
  const q = (week: string, slug?: string) =>
    `/rozvrh?${new URLSearchParams({ tyden: week, ...(slug ? { lekce: slug } : {}) })}`;

  return (
    <>
      <PageHeader eyebrow={c("schedule.eyebrow")} title={c("schedule.title")}>
        {c("schedule.intro")}
      </PageHeader>
      <Container className="py-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Link aria-label="Předchozí týden" href={q(addDays(monday, -7), lekce)} className="flex size-10 items-center justify-center rounded-full border border-linka hover:border-les">
              <ChevronLeft className="size-5" />
            </Link>
            <p className="min-w-44 text-center font-semibold tabular-nums">
              {short.format(keyToUtc(monday))} – {short.format(keyToUtc(addDays(monday, 6)))}
            </p>
            <Link aria-label="Další týden" href={q(addDays(monday, 7), lekce)} className="flex size-10 items-center justify-center rounded-full border border-linka hover:border-les">
              <ChevronRight className="size-5" />
            </Link>
            {monday !== mondayOf(today) && (
              <Link href={q(today, lekce)} className="eyebrow ml-2 text-zeme underline underline-offset-4">
                Dnes
              </Link>
            )}
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Filtr lekcí">
            <Link href={q(monday)} className={chip(!filter)}>Vše</Link>
            {types.map((t) => (
              <Link key={t.id} href={q(monday, t.slug)} className={chip(filter?.id === t.id)}>
                <span className="size-2 rounded-full" style={{ background: t.color }} />
                {t.name}
              </Link>
            ))}
          </nav>
        </div>

        {sessions.length === 0 ? (
          <div className="mt-10">
            <Empty>{c("schedule.empty")}</Empty>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-7 lg:gap-3">
            {days.map((d, i) => {
              const list = byDay.get(d) ?? [];
              const isToday = d === today;
              return (
                <section key={d} className={cx(list.length === 0 && "hidden lg:block")}>
                  <h2 className={cx("mb-3 border-b pb-2", isToday ? "border-zlato" : "border-linka/60")}>
                    <span className="eyebrow block">{WEEKDAYS[i]}</span>
                    <span className={cx("text-sm tabular-nums", isToday ? "font-bold text-zeme" : "text-les/50")}>
                      {short.format(keyToUtc(d))}
                      {isToday && " · dnes"}
                    </span>
                  </h2>
                  <div className="space-y-2">
                    {list.map((s) => (
                      <SessionCard key={s.id} s={s} compact />
                    ))}
                    {list.length === 0 && <p className="text-xs text-les/40">—</p>}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </Container>
    </>
  );
}

function chip(active: boolean) {
  return cx(
    "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
    active ? "border-les bg-les text-papir" : "border-linka text-les/70 hover:border-les",
  );
}
