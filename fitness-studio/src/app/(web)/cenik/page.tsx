import type { Metadata } from "next";
import { getDb } from "@/db";
import { ProductCard } from "@/components/product-card";
import { ButtonLink, Container, Eyebrow, PageHeader } from "@/components/ui";
import type { Product } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { credits, entriesLabel, formatPrice } from "@/lib/money";
import { activeClassTypes, activeProducts } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { getContent, type Content } from "@/content";
import { nbsp } from "@/lib/typography";

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

export default async function PricingPage() {
  const db = await getDb();
  const [list, types, user, cfg, c] = await Promise.all([
    activeProducts(db),
    activeClassTypes(db),
    getCurrentUser(),
    getSettings(db),
    getContent(),
  ]);

  const hasPass = list.some((p) => p.kind === "pass");
  const multi = types.filter((t) => t.passEntries > 1 && !t.noPass);
  const noPass = types.filter((t) => t.noPass);
  const passNotes = [
    ...(multi.length
      ? ["Běžná lekce = 1 vstup", ...multi.map((t) => `${t.name} = ${entriesLabel(t.passEntries)}`)]
      : ["1 lekce = 1 vstup"]),
    ...(noPass.length ? [`Neplatí na: ${noPass.map((t) => t.name).join(", ")}`] : []),
  ];
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
  // number only the sections that actually have something in them
  const shown = groups(c).filter((g) => list.some((p) => p.kind === g.kind));

  return (
    <>
      <PageHeader eyebrow={c("pricing.eyebrow")} title={c("pricing.title")}>
        {c("pricing.intro")}
      </PageHeader>

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
          const items = list.filter((p) => p.kind === g.kind);
          return (
            <section key={g.kind}>
              <Eyebrow n={nth(i)} className="text-zeme">{g.title}</Eyebrow>
              <p className="mt-3 max-w-xl text-les/70">{g.text}</p>
              <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => (
                  <ProductCard key={p.id} p={p} loggedIn={!!user} next="/cenik" passNotes={passNotes} creditNotes={creditNotes} />
                ))}
              </div>
            </section>
          );
        })}

        <section>
          <Eyebrow n={nth(shown.length)} className="text-zeme">{c("pricing.dropInTitle")}</Eyebrow>
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
                          permanentka: {entriesLabel(t.passEntries)}
                        </span>
                      )}
                  {t.firstVisitPrice !== null && (
                    <span className="block text-xs">první lekce {formatPrice(t.firstVisitPrice)}</span>
                  )}
                  {t.duoPrice !== null && t.capacity > 2 && (
                    <span className="block text-xs">s kamarádkou {formatPrice(t.duoPrice)} za obě</span>
                  )}
                  {!!t.memberSurcharge && (
                    <span className="block text-xs">
                      členové doplácí {formatPrice(t.memberSurcharge)}
                      {t.memberSurchargeFrom && ` od ${t.memberSurchargeFrom.split("-").reverse().map(Number).join(". ")}`}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
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
