import type { Metadata } from "next";
import { getDb } from "@/db";
import { ProductCard } from "@/components/product-card";
import { ButtonLink, Container, Eyebrow, PageHeader, cx } from "@/components/ui";
import type { Product } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { credits, entriesLabel, formatPrice } from "@/lib/money";
import { activeClassTypes, priceListProducts } from "@/lib/queries";
import Link from "next/link";
import { membershipPlacesTaken, switchableTo } from "@/domain/membership-fees";
import { dateKey } from "@/lib/dates";
import { dayLabel, inPresale, onSale, priceListStart, priceListYears, priceNoteOn, productsForYear, saleStartsLater, surchargeSteps, yearStart } from "@/lib/price-list";
import { getSettings } from "@/lib/settings";
import { getContent, type Content } from "@/content";
import { nbsp } from "@/lib/typography";
import { isStudent } from "@/lib/student";

export const metadata: Metadata = {
  title: "Ceník, členství a permanentky",
  description: "Ceník studia OCTOPUSH v Ostravě: členství, permanentky, kredity, jednorázové vstupy a masáže. Platba kartou nebo převodem.",
  alternates: { canonical: "/cenik" },
};

const groups = (c: Content): { kind: Product["kind"]; title: string; text: string }[] => [
  { kind: "membership", title: c("pricing.membershipTitle"), text: c("pricing.membershipText") },
  { kind: "pass", title: c("pricing.passTitle"), text: c("pricing.passText") },
  { kind: "credit_pack", title: c("pricing.creditTitle"), text: c("pricing.creditText") },
  { kind: "solarium", title: c("pricing.solariumTitle"), text: c("pricing.solariumText") },
  { kind: "massage_pass", title: c("pricing.massagePassTitle"), text: c("pricing.massagePassText") },
];
const nth = (i: number) => String(i + 1).padStart(2, "0");

export default async function PricingPage({ searchParams }: PageProps<"/cenik">) {
  const { rok } = await searchParams;
  const db = await getDb();
  const now = new Date();
  const [all, types, user, cfg, c] = await Promise.all([
    priceListProducts(db),
    activeClassTypes(db),
    getCurrentUser(),
    getSettings(db),
    getContent(),
  ]);
  // this year's price list, and next year's once it's set (a tab; it applies from 1 January)
  const years = priceListYears(all, types, now);
  const year = years.find((y) => String(y) === rok) ?? years[0];
  const later = year !== years[0];
  const list = productsForYear(all, year, now);
  const from = priceListStart(year, now);
  const day = dateKey(from);
  // next year's list: what can be bought already (presale) and from when the rest
  const presale = list.filter((p) => inPresale(p, now)).map((p) => p.name);
  const onSaleFrom = presale.length
    ? `${presale.join(" a ")} ${presale.length > 1 ? "jsou" : "je"} v předprodeji – koupíš ${presale.length > 1 ? "je" : "ho"} už teď. Ostatní položky jsou v prodeji od ${dayLabel(day)}.`
    : `Položky z tohoto ceníku jsou v prodeji od ${dayLabel(day)}.`;
  const limited = list.filter((p) => p.maxActive !== null);
  const taken = await membershipPlacesTaken(db, limited.map((p) => p.id), now);
  const placesLeft = (p: (typeof list)[number]) => (p.maxActive === null ? null : Math.max(0, p.maxActive - (taken.get(p.id) ?? 0)));
  // a member moves up to a membership with lessons included in Můj účet instead of buying it
  const switchable = user ? await switchableTo(db, user.id, now) : new Set<string>();

  const hasPass = list.some((p) => p.kind === "pass");
  const multi = types.filter((t) => !t.noPass && (t.passEntries > 1 || !!t.passSurcharge));
  const passCost = (t: (typeof types)[number]) =>
    entriesLabel(t.passEntries) + (t.passSurcharge ? ` + doplatek ${formatPrice(t.passSurcharge)}` : "");
  const noPass = types.filter((t) => t.noPass);
  const passNotes = [
    ...(multi.length
      ? ["Běžná lekce = 1 vstup", ...multi.map((t) => `${t.name} = ${passCost(t)}`)]
      : ["1 lekce = 1 vstup"]),
  ];
  const passExclusions = noPass.length ? [`Neplatí na: ${noPass.map((t) => t.name).join(", ")}`] : [];
  // How many credits a class takes: the usual price once, the exceptions by name.
  const costs = types.filter((t) => t.creditCost > 0).map((t) => t.creditCost);
  const usual = costs.sort((a, b) => costs.filter((c) => c === b).length - costs.filter((c) => c === a).length)[0];
  const creditNotes =
    usual === undefined
      ? []
      : [
          `${types.some((t) => t.creditCost !== usual) ? "Běžná lekce" : "Lekce"}: ${credits(usual)}`,
          ...types.filter((t) => t.creditCost !== usual && t.creditCost > 0).map((t) => `${t.name}: ${credits(t.creditCost)}`),
        ];
  // Which classes the welcome free entry can be used for – the exceptions with their intro price.
  const noFree = types.filter((t) => t.noFreeEntry);
  const yesFree = types.filter((t) => !t.noFreeEntry);
  const names = (ts: typeof types) => ts.map((t) => t.name).join(", ").replace(/, ([^,]*)$/, " a $1");
  const intro = noFree.filter((t) => t.firstVisitPrice !== null);
  const noIntro = noFree.filter((t) => t.firstVisitPrice === null);
  const samePrice = intro.length > 0 && intro.every((t) => t.firstVisitPrice === intro[0].firstVisitPrice);
  const introText = !intro.length
    ? ""
    : samePrice
      ? `Na ${names(intro)} je první lekce za ${formatPrice(intro[0].firstVisitPrice!)}, na ostatní lekce zdarma.`
      : `${intro.map((t) => `Na ${t.name} je první lekce za ${formatPrice(t.firstVisitPrice!)}.`).join(" ")} Na ostatní lekce zdarma.`;
  const freeWhere = !noFree.length || !yesFree.length
    ? ""
    : [
        introText,
        noIntro.length ? `Neplatí na: ${names(noIntro)}.` : "",
      ].filter(Boolean).join(" ");
  // student prices have a section of their own
  const studentItems = list.filter((p) => p.studentsOnly);
  const regular = list.filter((p) => !p.studentsOnly);
  const studentUnverified = !!user && !isStudent(user, now);
  // number only the sections that actually have something in them
  const shown = groups(c).filter((g) => regular.some((p) => p.kind === g.kind));
  const dropInIdx = shown.length + (studentItems.length ? 1 : 0);

  return (
    <>
      <PageHeader eyebrow={c("pricing.eyebrow")} title={c("pricing.title")}>
        {c("pricing.intro")}
      </PageHeader>

      {years.length > 1 && (
        <Container className="pb-16 pt-10">
          <nav className="flex flex-wrap gap-2" aria-label="Ceník podle roku">
            {years.map((y) => (
              <Link
                key={y}
                href={y === years[0] ? "/cenik" : `/cenik?rok=${y}`}
                aria-current={y === year ? "page" : undefined}
                className={cx(
                  "rounded-full border px-5 py-2 text-sm font-semibold transition",
                  y === year ? "border-les bg-les text-papir" : "border-linka hover:border-les",
                )}
              >
                Ceník {y}
              </Link>
            ))}
          </nav>
          <p className="mt-3 max-w-2xl text-sm text-les/70">
            {later
              ? `Platí od ${dayLabel(day)} – i pro členství a permanentky koupené dřív (doplatky k lekcím se řídí ceníkem platným v den lekce). ${onSaleFrom}`
              : `Ceny platí do 31. 12. ${year}. Od 1. 1. ${year + 1} platí ceník ${year + 1}.`}
          </p>
        </Container>
      )}

      {cfg.welcomeFreeEntries > 0 && (
        <section className="bg-forest text-papir">
          <Container className="flex flex-col items-start justify-between gap-6 py-10 md:flex-row md:items-center">
            <div>
              <Eyebrow className="text-zlato">{c("pricing.freeEyebrow")}</Eyebrow>
              <p className="mt-2 text-2xl font-semibold">{c("pricing.freeTitle")}</p>
              <p className="mt-1 text-papir/70">{c("pricing.freeText")}</p>
              {freeWhere && <p className="mt-2 text-sm text-zlato-light">{nbsp(freeWhere)}</p>}
            </div>
            <ButtonLink href={user ? "/rozvrh" : "/registrace"} variant="gold">
              {user ? "Vybrat lekci" : "Zaregistrovat se"}
            </ButtonLink>
          </Container>
        </section>
      )}

      <Container className="space-y-20 py-16">
        {shown.map((g, i) => {
          const items = regular.filter((p) => p.kind === g.kind);
          return (
            <section key={g.kind}>
              <Eyebrow n={nth(i)} className="text-zeme">{g.title}</Eyebrow>
              <p className="mt-3 max-w-xl text-les/70">{g.text}</p>
              {/* four cards (e.g. memberships with / without commitment) read best as a 2 × 2 grid */}
              <div className={`mt-8 grid gap-5 md:grid-cols-2 ${items.length === 4 ? "" : "lg:grid-cols-3"}`}>
                {items.map((p) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    loggedIn={!!user}
                    next={later ? `/cenik?rok=${year}` : "/cenik"}
                    passNotes={passNotes}
                    passExclusions={passExclusions}
                    creditNotes={creditNotes}
                    includedClass={types.find((t) => t.id === p.includedClassTypeId)?.name}
                    priorityWeeks={cfg.includedPriorityWeeks}
                    placesLeft={placesLeft(p)}
                    switchInAccount={switchable.has(p.id)}
                    saleNote={!onSale(p, now) && saleStartsLater(p, now) ? `V prodeji od ${dayLabel(dateKey(p.saleFrom!))}` : undefined}
                    startsOn={inPresale(p, now) ? dayLabel(dateKey(p.saleFrom!)) : undefined}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {studentItems.length > 0 && (
          <section>
            <Eyebrow n={nth(shown.length)} className="text-zeme">{c("pricing.studentTitle")}</Eyebrow>
            <p className="mt-3 max-w-xl text-les/70">{c("pricing.studentText")}</p>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {studentItems.map((p) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  loggedIn={!!user}
                  next={later ? `/cenik?rok=${year}` : "/cenik"}
                  passNotes={passNotes}
                  passExclusions={passExclusions}
                  priorityWeeks={cfg.includedPriorityWeeks}
                  studentUnverified={studentUnverified}
                  saleNote={!onSale(p, now) && saleStartsLater(p, now) ? `V prodeji od ${dayLabel(dateKey(p.saleFrom!))}` : undefined}
                  startsOn={inPresale(p, now) ? dayLabel(dateKey(p.saleFrom!)) : undefined}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <Eyebrow n={nth(dropInIdx)} className="text-zeme">{c("pricing.dropInTitle")}</Eyebrow>
          <p className="mt-3 max-w-xl text-les/70">{c("pricing.dropInText")}</p>
          <div className="mt-8 divide-y divide-linka/60 border-y border-linka/60">
            {types.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-4">
                <span className="flex items-center gap-3 font-medium">
                  <span className="size-2.5 rounded-full" style={{ background: t.color }} /> {t.name}
                </span>
                <span className="text-right text-sm tabular-nums text-les/70">
                  {t.dropInPrice !== null ? formatPrice(t.dropInPrice) : "jen s permanentkou"} · {credits(t.creditCost)}
                  {t.noPass
                    ? hasPass && <span className="block text-xs">permanentka neplatí</span>
                    : (hasPass || t.passEntries > 1) && (
                        <span className="block text-xs">
                          permanentka: {passCost(t)}
                        </span>
                      )}
                  {t.firstVisitPrice !== null && (
                    <span className="block text-xs">první lekce{t.firstVisitNewOnly && " pro nováčky"} {formatPrice(t.firstVisitPrice)}</span>
                  )}
                  {t.studentDropInPrice !== null && <span className="block text-xs">studenti {formatPrice(t.studentDropInPrice)}</span>}
                  {t.duoPrice !== null && t.capacity > 2 && (
                    <span className="block text-xs">s kamarádkou {formatPrice(t.duoPrice)} za obě</span>
                  )}
                  {surchargeSteps(t, from, yearStart(year + 1)).map((step) => (
                    <span key={step.from ?? "now"} className="block text-xs">
                      členové doplácí {formatPrice(step.amount)}
                      {step.from && ` od ${dayLabel(step.from)}`}
                    </span>
                  ))}
                  {priceNoteOn(t, day) && <span className="block text-xs font-semibold text-zeme">{priceNoteOn(t, day)}</span>}
                  {list
                    .filter((p) => p.kind === "membership" && p.includedClassTypeId === t.id && p.includedPerMonth > 0 && p.commitmentMonths > 0)
                    .slice(0, 1)
                    .map((p) => (
                      <span key={p.id} className="block text-xs">
                        {p.name}: {p.includedPerMonth}× měsíčně v ceně
                      </span>
                    ))}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-start justify-between gap-5 rounded-2xl border border-zlato/50 bg-zlato/10 p-8 md:flex-row md:items-center">
          <div>
            <p className="text-2xl font-semibold">🎁 Hledáš dárek?</p>
            <p className="mt-1 text-les/70">Daruj pohyb – dárkový poukaz na permanentku, kredit, masáž nebo libovolnou částku. PDF k vytištění hned po zaplacení.</p>
          </div>
          <ButtonLink href="/poukazy" variant="gold" className="shrink-0 whitespace-nowrap text-center">Dárkové poukazy</ButtonLink>
        </section>

        <section className="grid gap-6 rounded-2xl bg-krem/50 p-8 text-sm text-les/80 md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n}>
              <p className="eyebrow mb-2 text-zeme">{c(`pricing.info${n}Title`)}</p>
              {c(`pricing.info${n}Text`)}
            </div>
          ))}
        </section>
      </Container>
    </>
  );
}
