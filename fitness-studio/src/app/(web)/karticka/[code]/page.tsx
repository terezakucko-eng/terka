import type { Metadata } from "next";
import { ButtonLink, Container, Eyebrow } from "@/components/ui";
import { getDb } from "@/db";
import { passCardByCode } from "@/domain/pass-cards";
import { getCurrentUser } from "@/lib/auth";
import { pluralCs } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Pošli to dál",
  description: "Kartička, která putuje od člověka k člověku – s ní máš v OCTOPUSH lekci zdarma ty i kamarádka.",
  robots: { index: false },
};

/** Where the QR code of a printed Pošli to dál card leads. */
export default async function PassCardPage({ params }: PageProps<"/karticka/[code]">) {
  const { code } = await params;
  const db = await getDb();
  const [card, user, cfg] = await Promise.all([passCardByCode(db, code), getCurrentUser(), getSettings(db)]);
  if (card?.isActive && card.placesLeft === 0) {
    // both places taken until their lessons are over – a shared photo of the QR gets nobody anything
    return (
      <section className="bg-forest text-papir">
        <Container className="max-w-2xl py-20 text-center">
          <p className="text-6xl">⚡</p>
          <Eyebrow className="mt-6 text-zlato">Pošli to dál</Eyebrow>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Kartička se právě nabíjí</h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-papir/80">
            Obě místa na ní právě využívají dva noví lidé. Kartička se sama nabije, až budou po lekci – pak ji můžeš dostat ty 💛
          </p>
          <p className="mx-auto mt-4 max-w-lg text-papir/70">
            {cfg.welcomeFreeEntries > 0 ? "Nechceš čekat? První lekce je u nás pro nové zdarma i bez kartičky." : "Nechceš čekat? Stačí se zaregistrovat a vybrat si lekci."}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink href={user ? "/rozvrh" : "/registrace"} variant="gold">{user ? "Vybrat lekci" : "Zaregistrovat se"}</ButtonLink>
          </div>
        </Container>
      </section>
    );
  }

  if (!card?.isActive) {
    return (
      <section className="bg-forest text-papir">
        <Container className="max-w-2xl py-20 text-center">
          <Eyebrow className="text-zlato">Pošli to dál</Eyebrow>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Tahle kartička už je mimo hru</h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-papir/80">
            {cfg.welcomeFreeEntries > 0
              ? "Nevadí – první lekce je u nás pro nové stejně zdarma. Stačí se zaregistrovat a vybrat si lekci v rozvrhu."
              : "Nevadí – stačí se zaregistrovat a vybrat si lekci v rozvrhu."}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink href={user ? "/rozvrh" : "/registrace"} variant="gold">{user ? "Vybrat lekci" : "Zaregistrovat se"}</ButtonLink>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className="bg-forest text-papir">
      <Container className="max-w-2xl py-16 text-center sm:py-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/symbol-gold.svg" alt="" className="mx-auto h-24 w-24" />
        <Eyebrow className="mt-6 text-zlato">Pošli to dál 💛</Eyebrow>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
          {card.placesLeft === 1 ? "Zbývá jedno místo – je tvoje" : "Tahle kartička doputovala k tobě"}
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-lg text-papir/80">
          {card.placesLeft === 1 ? (
            <>
              Zaregistruj se a máš v OCTOPUSH <strong className="text-zlato-light">lekci zdarma</strong>. Domluv se s tím, kdo ti kartičku dal, a přijďte spolu.
            </>
          ) : (
            <>
              🔋 Kartička je nabitá a má <strong className="text-zlato-light">2 místa – lekci zdarma pro tebe i kamarádku</strong>. Zaregistruj se a ať
              se kamarádka zaregistruje taky: naskenuje kartičku, nebo jí pošleš odkaz z účtu.
            </>
          )}
        </p>
        {card.people > 0 && (
          <p className="mt-4 text-sm text-papir/60">
            Kartička už k nám přivedla {pluralCs(card.people, "člověka", "lidi", "lidí")} 🐙
          </p>
        )}

        <ol className="mx-auto mt-10 grid max-w-xl gap-3 text-left sm:grid-cols-3">
          {["Zaregistruj se – lekci zdarma máš hned na účtu", "Rezervuj si lekci a zaplať Kartičkou Pošli to dál", "Po lekci se kartička nabije – předej ji dál"].map((s, i) => (
            <li key={s} className="rounded-2xl border border-zlato/30 p-4 text-sm text-papir/80">
              <span className="block font-serif text-2xl text-zlato">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-papir/60">Kartička platí jen pro nové klienty – každý ji může využít jen jednou.</p>

        {user ? (
          <div className="mt-10">
            <p className="text-papir/70">Účet u nás už máš 🙂 Kartička je pro nové – pošli ji dál někomu, kdo u nás ještě nebyl.</p>
            <ButtonLink href="/rozvrh" variant="gold" className="mt-4">Vybrat lekci</ButtonLink>
          </div>
        ) : (
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink href={`/registrace?karta=${card.code}`} variant="gold">Zaregistrovat se</ButtonLink>
            <ButtonLink href="/lekce" variant="outline-light">Prohlédnout lekce</ButtonLink>
          </div>
        )}
      </Container>
    </section>
  );
}
