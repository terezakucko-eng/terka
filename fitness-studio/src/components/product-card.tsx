import { Check } from "lucide-react";
import { buyProductAction } from "@/app/actions/booking";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, cx } from "@/components/ui";
import type { Product } from "@/db/schema";
import { credits, entries, formatPrice } from "@/lib/money";
import { cardPayments } from "@/lib/payments";
import { nbsp } from "@/lib/typography";

function perks(p: Product): string[] {
  switch (p.kind) {
    case "membership":
      return [
        p.weeklyLimit ? `Až ${p.weeklyLimit} lekce týdně` : "Neomezeně lekcí",
        "Přednostní rezervace – termíny si zamluvíš dřív než ostatní",
        "Přednost v pořadníku, když je lekce plná",
        "Slevy na služby studia",
        "Vstup do infrasauny zdarma",
        "Platí se měsíčně, závazek na 12 měsíců",
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
  creditNotes = [],
}: {
  p: Product;
  loggedIn: boolean;
  next: string;
  /** e.g. "Reformer fusion = 2 vstupy" – shown on pass cards */
  passNotes?: string[];
  /** e.g. "Většina lekcí: 220 kreditů" – shown on credit pack cards */
  creditNotes?: string[];
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
                    <ul className="mt-5 flex-1 space-y-2 text-sm">
                      {[...perks(p), ...(p.kind === "pass" ? passNotes : p.kind === "credit_pack" ? creditNotes : [])].map((x) => (
                        <li key={x} className="flex gap-2">
                          <Check className={cx("mt-0.5 size-4 shrink-0", p.highlight ? "text-zlato" : "text-salvej")} /> {x}
                        </li>
                      ))}
                    </ul>
                    {loggedIn ? (
                      <ActionForm action={buyProductAction} className="mt-6 space-y-2">
                        <input type="hidden" name="productId" value={p.id} />
                        {card && (
                          <SubmitButton name="pay" value="card" variant={p.highlight ? "gold" : "dark"} className="w-full" pendingText="Moment…">
                            {p.kind === "membership" && p.recurring ? "Platit kartou měsíčně" : "Koupit – kartou"}
                          </SubmitButton>
                        )}
                        <SubmitButton name="pay" value="transfer" variant={card ? "outline" : p.highlight ? "gold" : "dark"} className="w-full" pendingText="Moment…">
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
