import type { Metadata } from "next";
import { Check } from "lucide-react";
import { getDb } from "@/db";
import { buyProductAction } from "@/app/actions/booking";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, Container, Eyebrow, PageHeader, cx } from "@/components/ui";
import type { Product } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { credits, entries, formatPrice } from "@/lib/money";
import { activeClassTypes, activeProducts } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { getContent, type Content } from "@/content";

export const metadata: Metadata = { title: "Ceník, členství a permanentky" };

function perks(p: Product): string[] {
  switch (p.kind) {
    case "membership":
      return [
        p.weeklyLimit ? `Až ${p.weeklyLimit} lekce týdně` : "Neomezeně lekcí",
        p.recurring ? "Obnovuje se každý měsíc, zrušíš kdykoliv" : `Platnost ${p.validityDays ?? 30} dní`,
        "Přednostní místo v pořadníku díky automatické platbě",
      ];
    case "pass":
      return [
        entries(p.entries ?? 0),
        `Platnost ${p.validityDays} dní`,
        `Cena za lekci ${formatPrice(Math.round(p.price / (p.entries || 1)))}`,
      ];
    case "credit_pack":
      return [
        credits(p.credits ?? 0),
        "Kredit nepropadá",
        `1 kredit = ${formatPrice(Math.round(p.price / (p.credits || 1)))}`,
      ];
  }
}

const groups = (c: Content): { kind: Product["kind"]; n: string; title: string; text: string }[] => [
  { kind: "membership", n: "01", title: c("pricing.membershipTitle"), text: c("pricing.membershipText") },
  { kind: "pass", n: "02", title: c("pricing.passTitle"), text: c("pricing.passText") },
  { kind: "credit_pack", n: "03", title: c("pricing.creditTitle"), text: c("pricing.creditText") },
];

export default async function PricingPage() {
  const db = await getDb();
  const [list, types, user, cfg, c] = await Promise.all([
    activeProducts(db),
    activeClassTypes(db),
    getCurrentUser(),
    getSettings(db),
    getContent(),
  ]);

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
              <p className="mt-2 text-2xl font-medium">{c("pricing.freeTitle")}</p>
              <p className="mt-1 text-papir/70">{c("pricing.freeText")}</p>
            </div>
            <ButtonLink href={user ? "/rozvrh" : "/registrace"} variant="gold">
              {user ? "Vybrat lekci" : "Zaregistrovat se"}
            </ButtonLink>
          </Container>
        </section>
      )}

      <Container className="space-y-20 py-16">
        {groups(c).map((g) => {
          const items = list.filter((p) => p.kind === g.kind);
          if (!items.length) return null;
          return (
            <section key={g.kind}>
              <Eyebrow n={g.n} className="text-zeme">{g.title}</Eyebrow>
              <p className="mt-3 max-w-xl text-les/70">{g.text}</p>
              <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => (
                  <article
                    key={p.id}
                    className={cx(
                      "flex flex-col rounded-2xl border p-6",
                      p.highlight ? "border-zlato bg-les text-papir" : "border-linka/60 bg-white/50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl font-semibold">{p.name}</h3>
                      {p.highlight && <Badge tone="solid">Oblíbené</Badge>}
                    </div>
                    <p className={cx("mt-2 text-sm", p.highlight ? "text-papir/70" : "text-les/60")}>{p.description}</p>
                    <p className={cx("mt-6 text-4xl font-light", p.highlight && "text-gold")}>
                      {formatPrice(p.price)}
                      {p.kind === "membership" && p.recurring && <span className="text-base"> / měsíc</span>}
                    </p>
                    <ul className="mt-5 flex-1 space-y-2 text-sm">
                      {perks(p).map((x) => (
                        <li key={x} className="flex gap-2">
                          <Check className={cx("mt-0.5 size-4 shrink-0", p.highlight ? "text-zlato" : "text-salvej")} /> {x}
                        </li>
                      ))}
                    </ul>
                    {user ? (
                      <ActionForm action={buyProductAction} className="mt-6">
                        <input type="hidden" name="productId" value={p.id} />
                        <SubmitButton variant={p.highlight ? "gold" : "dark"} className="w-full" pendingText="Přesměrovávám…">
                          Koupit online
                        </SubmitButton>
                      </ActionForm>
                    ) : (
                      <ButtonLink href="/prihlaseni?next=/cenik" variant={p.highlight ? "gold" : "outline"} className="mt-6 w-full">
                        Přihlásit a koupit
                      </ButtonLink>
                    )}
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        <section>
          <Eyebrow n="04" className="text-zeme">{c("pricing.dropInTitle")}</Eyebrow>
          <p className="mt-3 max-w-xl text-les/70">{c("pricing.dropInText")}</p>
          <div className="mt-8 divide-y divide-linka/60 border-y border-linka/60">
            {types.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-4">
                <span className="flex items-center gap-3 font-medium">
                  <span className="size-2.5 rounded-full" style={{ background: t.color }} /> {t.name}
                </span>
                <span className="text-sm tabular-nums text-les/70">
                  {t.dropInPrice !== null ? formatPrice(t.dropInPrice) : "jen s permanentkou"} · {credits(t.creditCost)}
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
