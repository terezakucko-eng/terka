import type { Metadata } from "next";
import Link from "next/link";
import { buyVoucherAction } from "@/app/actions/vouchers";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ButtonLink, Card, Container, PageHeader } from "@/components/ui";
import { VoucherFields } from "@/components/voucher-fields";
import { getDb } from "@/db";
import { VOUCHER_AMOUNTS, giftableProducts } from "@/domain/vouchers";
import { getCurrentUser } from "@/lib/auth";
import { cardPayments } from "@/lib/payments";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Dárkové poukazy",
  description: "Daruj pohyb – dárkový poukaz do studia OCTOPUSH na permanentku, kredit, masáže nebo libovolnou částku.",
};

const validity = (days: number) => (days % 365 === 0 ? `${days / 365 === 1 ? "rok" : `${days / 365} roky`}` : `${days} dní`);

/** Dárkové poukazy: what can be given and the purchase form. */
export default async function VouchersPage() {
  const db = await getDb();
  const [user, products, cfg] = await Promise.all([getCurrentUser(), giftableProducts(db), getSettings(db)]);
  return (
    <>
      <PageHeader eyebrow="Dárkové poukazy" title="Daruj pohyb 🎁">
        Permanentka, kredit, masáž nebo libovolná částka – poukaz si stáhneš jako PDF, vytiskneš nebo pošleš. Platí{" "}
        {validity(cfg.voucherValidityDays)} od zaplacení.
      </PageHeader>
      <Container className="grid gap-8 py-12 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <Card>
            <h2 className="text-xl font-semibold">Jak to funguje</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-les/80">
              <li>Vyber dárek a připiš jméno nebo věnování.</li>
              <li>Zaplať kartou nebo převodem.</li>
              <li>Poukaz si stáhni v Můj účet (PDF) – vytiskni ho, nebo ho rovnou pošli.</li>
              <li>Obdarovaná osoba si ho uplatní kódem ve svém účtu na webu – a může rezervovat.</li>
            </ol>
          </Card>
          <Card className="bg-krem/40">
            <p className="font-semibold">Máš poukaz a chceš ho uplatnit?</p>
            <ButtonLink href="/poukaz" variant="outline" className="mt-3">Uplatnit poukaz</ButtonLink>
          </Card>
        </div>
        <Card>
          {user ? (
            <ActionForm action={buyVoucherAction} className="space-y-6" resetOnSuccess={false}>
              <VoucherFields
                products={products.map((p) => ({ id: p.id, name: p.name, price: p.price, description: p.description }))}
                amounts={VOUCHER_AMOUNTS}
              />
              <div className="flex flex-wrap gap-2">
                {cardPayments() && <SubmitButton name="pay" value="card" variant="gold">Zaplatit kartou</SubmitButton>}
                <SubmitButton name="pay" value="transfer" variant={cardPayments() ? "outline" : "dark"}>Zaplatit převodem (QR)</SubmitButton>
              </div>
              {cfg.voucherCreditsPer100Kc > 0 && (
                <p className="text-xs text-les/60">
                  Poukaz na částku se po uplatnění promění v kredit: za každých 100 Kč {cfg.voucherCreditsPer100Kc}{" "}
                  {cfg.voucherCreditsPer100Kc === 1 ? "kredit" : cfg.voucherCreditsPer100Kc < 5 ? "kredity" : "kreditů"}.
                </p>
              )}
            </ActionForm>
          ) : (
            <div>
              <h2 className="text-xl font-semibold">Nákup poukazu</h2>
              <p className="mt-2 text-les/70">
                Poukaz kupuješ přes svůj účet – najdeš ho tam pak ke stažení. Přihlas se, nebo si účet založ (zabere to minutku).
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <ButtonLink href="/prihlaseni?next=/poukazy">Přihlásit se</ButtonLink>
                <ButtonLink href="/registrace?next=/poukazy" variant="outline">Založit účet</ButtonLink>
              </div>
              <p className="mt-4 text-xs text-les/60">
                Nebo se zastav na recepci – poukaz ti vystavíme na místě. <Link href="/cenik" className="underline">Ceník</Link>
              </p>
            </div>
          )}
        </Card>
      </Container>
    </>
  );
}
