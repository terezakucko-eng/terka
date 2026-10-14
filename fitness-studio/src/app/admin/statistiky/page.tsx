import Link from "next/link";
import { AdminTitle, Stat, Table, Td } from "@/components/admin";
import { BarList, Columns, Heatmap, SERIES, StackedColumns } from "@/components/stats-charts";
import { Card } from "@/components/ui";
import { getDb } from "@/db";
import { periodLabel } from "@/domain/membership-fees";
import { studioStats } from "@/domain/stats";
import { requireAdmin } from "@/lib/auth";
import { WEEKDAYS } from "@/lib/dates";
import { formatPrice } from "@/lib/money";

const RANGES = [3, 6, 12];
const SHORT = ["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"];
const short = (p: string) => SHORT[+p.slice(5, 7) - 1];
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);
const kc = (h: number) => formatPrice(h);
/** Axis and cap labels: 14,6 tis. / 120 tis. / 800 */
const compactKc = (h: number) =>
  h >= 100_000_00 ? `${Math.round(h / 100_000)} tis.` : h >= 1_000_00 ? `${(Math.round(h / 100_00) / 10).toLocaleString("cs-CZ")} tis.` : `${Math.round(h / 100)}`;

export default async function StatsPage({ searchParams }: PageProps<"/admin/statistiky">) {
  await requireAdmin();
  const { mesicu } = await searchParams;
  const months = RANGES.includes(Number(mesicu)) ? Number(mesicu) : 12;
  const s = await studioStats(await getDb(), months);
  const hours = [...new Set(s.cells.map((c) => c.hour))].sort((a, b) => a - b);
  const days = [...new Set(s.cells.map((c) => c.weekday))].sort((a, b) => a - b);
  const cell = new Map(s.cells.map((c) => [`${c.weekday}-${c.hour}`, c]));
  const range = `${periodLabel(s.periods[0])} – ${periodLabel(s.periods.at(-1)!)}`;

  return (
    <>
      <AdminTitle title="Statistiky">
        <span className="text-sm text-les/60">{range} · proběhlé lekce a zaplacené platby</span>
      </AdminTitle>
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-les/60">Období:</span>
        {RANGES.map((r) => (
          <Link
            key={r}
            href={`/admin/statistiky?mesicu=${r}`}
            className={`rounded-full border px-4 py-1.5 ${r === months ? "border-les bg-les text-papir" : "border-linka hover:border-les"}`}
          >
            {r} měsíců
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Tržby" value={kc(s.totals.revenue)} sub={`průměrně ${kc(Math.round(s.totals.revenue / months))} měsíčně`} />
        <Stat label="Návštěvy" value={s.totals.visits} sub={`${s.totals.sessions} lekcí`} />
        <Stat label="Průměrná obsazenost" value={pct(s.totals.occupancy)} sub="rezervovaná místa / kapacita" />
        <Stat label="Cvičící klienti" value={s.totals.clients} sub={`z toho ${s.totals.newcomers} poprvé · ${s.totals.registrations} nových registrací`} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Tržby po měsících</h2>
          <p className="mb-5 text-xs text-les/60">Zaplacené objednávky podle data platby.</p>
          <Columns
            format={compactKc}
            data={s.months.map((m) => ({ label: short(m.period), value: m.revenue, tip: `${kc(m.revenue)}\n${periodLabel(m.period)}` }))}
          />
          {s.groups.length > 0 && (
            <ul className="mt-10 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {s.groups.map((g) => (
                <li key={g.group} className="flex justify-between gap-3 border-b border-linka/40 py-1">
                  <span className="text-les/70">{g.group}</span>
                  <span className="whitespace-nowrap font-semibold">
                    {kc(g.amount)} <span className="font-normal text-les/50">{`${Math.round((g.amount / s.totals.revenue) * 100)} %`}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold">Klienti na lekcích: noví a vracející se</h2>
          <p className="mb-4 text-xs text-les/60">Kolik různých klientů v měsíci cvičilo – „noví“ byli na lekci úplně poprvé.</p>
          <StackedColumns
            series={[
              { name: "Vracející se", color: SERIES.primary },
              { name: "Noví", color: SERIES.second },
            ]}
            data={s.months.map((m) => ({
              label: short(m.period),
              parts: [m.returning, m.newcomers],
              tip: `${m.clients} klientů\n${periodLabel(m.period)}: ${m.returning} vracejících se, ${m.newcomers} nových`,
            }))}
          />
          <div className="h-6" />
        </Card>

        <Card>
          <h2 className="font-semibold">Obsazenost podle typu lekce</h2>
          <p className="mb-5 text-xs text-les/60">Rezervovaná místa z kapacity, od nejplnějších.</p>
          {s.types.length === 0 ? (
            <p className="text-sm text-les/50">Za tohle období žádné proběhlé lekce.</p>
          ) : (
            <BarList
              rows={s.types.map((t) => ({
                name: t.name,
                value: t.occupancy,
                label: pct(t.occupancy),
                note: `${t.sessions} ${t.sessions === 1 ? "lekce" : t.sessions < 5 ? "lekce" : "lekcí"} · ${t.visits} návštěv`,
                tip: `${pct(t.occupancy)} obsazeno\n${t.name}: ${t.booked} z ${t.seats} míst`,
              }))}
            />
          )}
        </Card>

        <Card>
          <h2 className="font-semibold">Kdy je nejplněji</h2>
          <p className="mb-5 text-xs text-les/60">Průměrná obsazenost podle dne a hodiny začátku lekce.</p>
          {s.cells.length === 0 ? (
            <p className="text-sm text-les/50">Za tohle období žádné proběhlé lekce.</p>
          ) : (
            <Heatmap
              rows={days.map((d) => ({ key: d, label: WEEKDAYS[d].slice(0, 2) }))}
              cols={hours.map((h) => ({ key: h, label: `${h}:00` }))}
              cell={(d, h) => {
                const c = cell.get(`${d}-${h}`);
                return c
                  ? { value: c.occupancy, label: pct(c.occupancy).replace(" ", ""), tip: `${pct(c.occupancy)} obsazeno\n${WEEKDAYS[d]} ${h}:00 · ${c.sessions} lekcí, ${c.booked} z ${c.seats} míst` }
                  : null;
              }}
            />
          )}
        </Card>
      </div>

      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-semibold text-zeme">Čísla po měsících (tabulka)</summary>
        <div className="mt-4">
          <Table head={["Měsíc", "Tržby", "Návštěvy", "Klienti", "Noví", "Vracející se"]}>
            {s.months.map((m) => (
              <tr key={m.period}>
                <Td>{periodLabel(m.period)}</Td>
                <Td>{kc(m.revenue)}</Td>
                <Td>{m.visits}</Td>
                <Td>{m.clients}</Td>
                <Td>{m.newcomers}</Td>
                <Td>{m.returning}</Td>
              </tr>
            ))}
          </Table>
        </div>
      </details>
      <p className="mt-6 max-w-3xl text-xs text-les/50">
        Návštěvy = rezervace na proběhlé lekce kromě nepříchodů (místa držená studiem se počítají, do klientů ne). Obsazenost počítá i
        nepříchody – místo bylo zabrané. Platby z doby před spuštěním webu tu nejsou.
      </p>
    </>
  );
}
