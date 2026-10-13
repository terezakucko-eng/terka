import type { Metadata } from "next";
import { ButtonLink, Card, Container, Empty, Eyebrow } from "@/components/ui";
import { getDb } from "@/db";
import { WISH_KINDS, publicWishes } from "@/domain/wishes";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Schránka přání a nápadů",
  description: "Vaše nápady, přání a pochvaly – a co jsme díky nim ve studiu OCTOPUSH zlepšili.",
};

/** Public part of the Schránka: messages clients allowed and the studio published, with replies. */
export default async function PublicWishesPage() {
  const list = await publicWishes(await getDb());
  return (
    <Container className="max-w-3xl py-16">
      <Eyebrow className="text-zeme">💌 Schránka přání a nápadů</Eyebrow>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Co jsme díky vám zlepšili</h1>
      <p className="mt-4 text-les/70">
        Vaše nápady, přání i pochvaly čteme všechny. Tady jsou ty, které nám jejich autoři dovolili zveřejnit – i s naší odpovědí.
      </p>
      <ButtonLink href="/ucet/schranka" className="mt-6">Napsat vzkaz</ButtonLink>

      <div className="mt-10 space-y-4">
        {list.length === 0 && <Empty>Zatím tu nic není – napiš nám jako první.</Empty>}
        {list.map((w) => (
          <Card key={w.id}>
            <p className="text-sm font-semibold">{WISH_KINDS[w.kind].emoji} {WISH_KINDS[w.kind].label}</p>
            <blockquote className="mt-2 whitespace-pre-line text-lg leading-relaxed">„{w.body}“</blockquote>
            <p className="mt-2 text-sm text-les/60">— {w.signature ?? "anonymně"} · {formatDate(w.createdAt)}</p>
            {w.reply && (
              <div className="mt-4 rounded-xl bg-zlato/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-zeme">Odpověď studia</p>
                <p className="mt-1 whitespace-pre-line">{w.reply}</p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </Container>
  );
}
