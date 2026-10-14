import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { buyProductAction } from "@/app/actions/booking";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, cx } from "@/components/ui";
import type { Product } from "@/db/schema";
import { credits, entries, formatPrice } from "@/lib/money";
import { cardPayments } from "@/lib/payments";
import { nbsp } from "@/lib/typography";

const weeks = (n: number) => (n === 1 ? "týden" : n < 5 ? `${n} týdny` : `${n} týdnů`);

function perks(p: Product, includedClass?: string, priorityWeeks = 0): string[] {
  switch (p.kind) {
    case "membership":
      return [
        ...(p.includedPerMonth > 0 ? [`${p.includedPerMonth}× ${includedClass ?? "lekce"} měsíčně v ceně – bez doplatku`] : []),
        ...(p.includedPerMonth > 0 && priorityWeeks > 0
          ? [`Přednostní rezervace na ${includedClass ?? "tyto lekce"} – o ${weeks(priorityWeeks)} dřív než ostatní členové`]
          : []),
        p.weeklyLimit ? `Až ${p.weeklyLimit} standardní skupinové lekce týdně` : "Neomezený vstup na standardní skupinové lekce",
        "Zvýhodněný vstup na lekce Reformer a individuální tréninky",
        "Přednostní rezervace – termíny si zamluvíš dřív než ostatní",
        "Přednost v pořadníku, když je lekce plná",
        "Slevy na služby studia",
        "Vstup zdarma do posilovací a cardio zóny",
        "Vstup do infrasauny zdarma",
        "…a další výhody",
      ];
    case "pass":
      return [
        entries(p.entries ?? 0),
        `Platnost ${p.validityDays} dní`,
        `Cena za vstup ${formatPrice(Math.round(p.price / (p.entries || 1)))}`,
      ];
    case "solarium":
      return [
        `${p.entries ?? 0} minut solária`,
        `Platnost ${p.validityDays} dní`,
        `Cena za minutu ${formatPrice(Math.round(p.price / (p.entries || 1)))}`,
        ...(p.membersOnly ? ["Jen pro členy"] : []),
      ];
    case "massage_pass":
      return [
        `${p.entries ?? 0}× masáž`,
        `Platnost ${p.validityDays} dní`,
        `Cena za masáž ${formatPrice(Math.round(p.price / (p.entries || 1)))}`,
        "Termín si rezervuješ online, vstup se strhne sám",
      ];
    case "credit_pack":
      return [
        credits(p.credits ?? 0),
        p.validityDays ? `Platí ${p.validityDays} dní od posledního dobití` : "Kredit nepropadá",
        `1 kredit = ${formatPrice(Math.round(p.price / (p.credits || 1)))}`,
      ];
  }
}

/** Price list card with the buy button (shared by /cenik and link-only /cenik/[id]). */
export function ProductCard({
  p,
  loggedIn,
  next,
  passNotes = [],
  passExclusions = [],
  creditNotes = [],
  includedClass,
  priorityWeeks = 0,
  saleNote,
  placesLeft = null,
}: {
  p: Product;
  loggedIn: boolean;
  next: string;
  /** e.g. "Reformer fusion = 2 vstupy" – shown on pass cards */
  passNotes?: string[];
  /** e.g. "Neplatí na: Individuální trénink" – shown on pass cards with a red minus */
  passExclusions?: string[];
  /** e.g. "Většina lekcí: 220 kreditů" – shown on credit pack cards */
  creditNotes?: string[];
  /** membership with lessons included: the class name (e.g. "Reformer fusion") */
  includedClass?: string;
  /** Settings → priority booking of the included class (weeks before other members) */
  priorityWeeks?: number;
  /** Not sold yet (next year's price list): "V prodeji od 1. 1. 2027" instead of the buy buttons */
  saleNote?: string;
  /** Limited membership: places left (null = no limit) */
  placesLeft?: number | null;
}) {
  const card = cardPayments();
  return (
    <article
                    className={cx(
                      "flex flex-col rounded-2xl border p-6",
                      p.highlight ? "border-zlato bg-les text-papir" : "border-linka/60 bg-white/50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl font-semibold">{p.name}</h3>
                      {p.highlight && <Badge tone="solid">Oblíbené</Badge>}
                    </div>
                    <p className={cx("mt-2 text-sm", p.highlight ? "text-papir/70" : "text-les/60")}>{nbsp(p.description)}</p>
                    <p className={cx("mt-6 text-4xl font-light", p.highlight && "text-gold")}>
                      {formatPrice(p.price)}
                      {p.kind === "membership" && p.recurring && <span className="text-base"> / měsíc</span>}
                    </p>
                    {p.maxActive !== null && placesLeft !== null && (
                      <p className={cx("mt-3 text-sm font-semibold", p.highlight ? "text-zlato-light" : "text-zeme")}>
                        {placesLeft > 0
                          ? `Omezený počet členství: ${p.maxActive} · volná: ${placesLeft}`
                          : "Teď obsazeno"}
                      </p>
                    )}
                    <ul className="mt-5 flex-1 space-y-2 text-sm">
                      {[...perks(p, includedClass, priorityWeeks), ...(p.kind === "pass" ? passNotes : p.kind === "credit_pack" ? creditNotes : [])].map((x) => (
                        <li key={x} className="flex gap-2">
                          <Check className={cx("mt-0.5 size-4 shrink-0", p.highlight ? "text-zlato" : "text-salvej")} /> {x}
                        </li>
                      ))}
                      {p.kind === "pass" &&
                        passExclusions.map((x) => (
                          <li key={x} className="flex gap-2">
                            <Minus className={cx("mt-0.5 size-4 shrink-0", p.highlight ? "text-[#e8836b]" : "text-chyba")} /> {x}
                          </li>
                        ))}
                    </ul>
                    {p.kind === "membership" && (
                      // a condition, not a perk – no check mark
                      <p className={cx("mt-5 border-t pt-4 text-xs", p.highlight ? "border-papir/15 text-papir/60" : "border-linka/60 text-les/60")}>
                        {p.commitmentMonths > 0
                          ? `Členství je závazné na ${p.commitmentMonths} měsíců – ${p.commitmentMonths} měsíčních plateb po ${formatPrice(p.price)}.`
                          : `Bez závazku – platíš ${formatPrice(p.price)} měsíčně a zrušit můžeš kdykoli ke konci zaplaceného měsíce v Můj účet.`}
                      </p>
                    )}
                    {saleNote ? (
                      <p className={cx("mt-6 rounded-xl px-4 py-3 text-center text-sm font-semibold", p.highlight ? "bg-papir/10" : "bg-krem/60")}>
                        {saleNote}
                        {p.kind === "membership" && p.includedPerMonth > 0 && (
                          <span className="mt-1 block text-xs font-normal">Máš členství se závazkem? Přechod si můžeš zamluvit už teď v Můj účet.</span>
                        )}
                      </p>
                    ) : placesLeft === 0 ? (
                      <p className={cx("mt-6 rounded-xl px-4 py-3 text-center text-sm", p.highlight ? "bg-papir/10" : "bg-krem/60")}>
                        Všechna členství jsou obsazená – napiš nám a dáme ti vědět, až se nějaké uvolní.
                      </p>
                    ) : loggedIn ? (
                      <ActionForm action={buyProductAction} className="mt-6 space-y-2">
                        <input type="hidden" name="productId" value={p.id} />
                        {p.kind === "membership" && (
                          <label className={cx("mb-3 flex gap-3 text-xs", p.highlight ? "text-papir/80" : "text-les/70")}>
                            <input type="checkbox" name="commitment" required className="mt-0.5 size-4 shrink-0 accent-[#c9a26b]" />
                            <span>
                              {p.commitmentMonths > 0 ? `Beru na vědomí, že členství je závazné na ${p.commitmentMonths} měsíců, a souhlasím s` : "Souhlasím s"}{"\u00a0"}
                              <Link href="/obchodni-podminky" target="_blank" className="underline">obchodními podmínkami</Link>.
                            </span>
                          </label>
                        )}
                        {card && (
                          <SubmitButton name="pay" value="card" variant={p.highlight ? "gold" : "dark"} className="w-full" pendingText="Moment…">
                            {p.kind === "membership" && p.recurring ? "Platit kartou měsíčně" : "Koupit – kartou"}
                          </SubmitButton>
                        )}
                        {/* on the dark (highlighted) card the plain outline would vanish – the light one stays visible */}
                        <SubmitButton name="pay" value="transfer" variant={card ? (p.highlight ? "outline-light" : "outline") : p.highlight ? "gold" : "dark"} className="w-full" pendingText="Moment…">
                          {card ? "Převodem (QR)" : "Koupit – platba převodem"}
                        </SubmitButton>
                      </ActionForm>
                    ) : (
                      <ButtonLink href={`/prihlaseni?next=${encodeURIComponent(next)}`} variant={p.highlight ? "gold" : "outline"} className="mt-6 w-full">
                        Přihlásit a koupit
                      </ButtonLink>
                    )}
                  </article>
  );
}
