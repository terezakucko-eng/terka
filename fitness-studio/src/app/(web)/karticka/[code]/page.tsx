import type { Metadata } from "next";
import { ButtonLink, Container, Eyebrow } from "@/components/ui";
import { getDb } from "@/db";
import { passCardByCode } from "@/domain/pass-cards";
import { getCurrentUser } from "@/lib/auth";
import { pluralCs } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Pošli to dál",
  description: "Kartička, která putuje od člověka k člověku – s ní máš v OCTOPUSH lekci zdarma pro sebe a kamarádku.",
  robots: { index: false },
};

/** Where the QR code of a printed Pošli to dál card leads. */
export default async function PassCardPage({ params }: PageProps<"/karticka/[code]">) {
  const { code } = await params;
  const db = await getDb();
  const [card, user, cfg] = await Promise.all([passCardByCode(db, code), getCurrentUser(), getSettings(db)]);
  if (card?.isActive && !card.charged) {
    // somebody signed up with it and hasn't been to the lesson yet – a shared photo of the QR gets nobody anything
    return (
      <section className="bg-forest text-papir">
        <Container className="max-w-2xl py-20 text-center">
          <p className="text-6xl">⚡</p>
          <Eyebrow className="mt-6 text-zlato">Pošli to dál</Eyebrow>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Kartička se právě nabíjí</h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-papir/80">
            {card.holder ? `Teď ji má ${card.holder} a` : "Někdo ji právě využil a"} nabije se, až bude po lekci. Pak ji můžeš dostat ty 💛
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
          {card.holder ? (
            <>
              Kartičku ti posílá <span className="text-gold">{card.holder}</span>
            </>
          ) : (
            "Tahle kartička doputovala k tobě"
          )}
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-lg text-papir/80">
          🔋 Kartička je nabitá: máš s ní v OCTOPUSH <strong className="text-zlato-light">lekci zdarma pro sebe a kamarádku</strong>. Zaregistruj
          se, vyber si lekci v rozvrhu a přidej kamarádku (+1).
        </p>
        {card.people > 0 && (
          <p className="mt-4 text-sm text-papir/60">
            Kartička už k nám přivedla {pluralCs(card.people, "člověka", "lidi", "lidí")} 🐙
          </p>
        )}

        <ol className="mx-auto mt-10 grid max-w-xl gap-3 text-left sm:grid-cols-3">
          {["Zaregistruj se – lekci pro dva máš hned na účtu", "Vyber si lekci a vezmi kamarádku (+1)", "Po lekci se kartička nabije – předej ji dál"].map((s, i) => (
            <li key={s} className="rounded-2xl border border-zlato/30 p-4 text-sm text-papir/80">
              <span className="block font-serif text-2xl text-zlato">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ol>

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
