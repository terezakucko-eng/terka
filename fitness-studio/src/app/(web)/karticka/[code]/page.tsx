import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Container, Eyebrow } from "@/components/ui";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { passCardByCode } from "@/domain/pass-cards";
import { getCurrentUser } from "@/lib/auth";
import { pluralCs } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Pošli to dál",
  description: "Někdo na tebe myslí 💛 S kartičkou Pošli to dál si v OCTOPUSH dobiješ baterky na lekci zdarma – klidně i s kamarádkou.",
  robots: { index: false },
};

/** Where the QR code of a printed Pošli to dál card leads. */
export default async function PassCardPage({ params, searchParams }: PageProps<"/karticka/[code]">) {
  const [{ code }, { ne }] = await Promise.all([params, searchParams]);
  const db = await getDb();
  const [card, user, cfg, c] = await Promise.all([passCardByCode(db, code), getCurrentUser(), getSettings(db), getContent()]);
  if (!card?.isActive || card.placesLeft === 0) {
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

  if (ne !== undefined) {
    // scanned it, not for her – nothing taken, the card just goes on
    return (
      <section className="bg-forest text-papir">
        <Container className="max-w-2xl py-20 text-center">
          <p className="text-6xl">💛</p>
          <Eyebrow className="mt-6 text-zlato">Pošli to dál</Eyebrow>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Nevadí, díky!</h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-papir/80">
            Kartičku pošli dál někomu, koho by pohyb potěšil – nebo ji vrať tomu, od koho ji máš. Na kartičce se nic nezměnilo, místa na ní zůstávají.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink href={`/karticka/${card.code}`} variant="outline-light">Vlastně mě to zajímá</ButtonLink>
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
          {card.placesLeft === 1 ? "Máš štěstí – poslední místo je tvoje" : "Máš štěstí – dobij si baterky zdarma"}
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-lg text-papir/80">
          {card.placesLeft === 1 ? (
            <>
              Někdo na tebe myslel a nechal ti místo 💛 A my v OCTOPUSH myslíme na tvoje zdraví a pohodu, takže tě u nás čeká{" "}
              <strong className="text-zlato-light">lekce zdarma</strong>. Domluv se s tím, kdo ti kartičku dal, a přijďte spolu.
            </>
          ) : (
            <>
              Tuhle kartičku ti dal někdo, kdo na tebe myslí 💛 A my v OCTOPUSH myslíme na tvoje zdraví a pohodu, takže tě u nás čeká{" "}
              <strong className="text-zlato-light">lekce zdarma</strong>.
            </>
          )}
        </p>
        {card.placesLeft !== 1 && (
          <p className="mx-auto mt-4 max-w-lg text-papir/70">
            🔋 Kartička má 2 místa – vezmi s sebou někoho, komu chceš udělat radost. Zaregistruje se taky: naskenuje kartičku, nebo mu pošleš odkaz
            z účtu.
          </p>
        )}
        <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-zlato/30 bg-papir/5 p-5 text-left text-sm text-papir/80">
          <p className="font-semibold text-zlato-light">Co je OCTOPUSH?</p>
          <p className="mt-1">
            Studio pohybu – tanec, pilates, silový trénink a další lekce v malých skupinách, kde se ti lektoři opravdu věnují. Najdeš nás na adrese{" "}
            {c.raw("site.street")}, {c.raw("site.city")}.
          </p>
          <p className="mt-3 font-semibold text-zlato-light">Co získáš?</p>
          <p className="mt-1">
            Jednu lekci zdarma podle sebe – vybereš si v rozvrhu a rezervuješ online. Bez závazku, nic neplatíš.
          </p>
        </div>
        {card.people > 0 && (
          <p className="mt-4 text-sm text-papir/60">
            Kartička už k nám přivedla {pluralCs(card.people, "člověka", "lidi", "lidí")} 🐙
          </p>
        )}

        <ol className="mx-auto mt-10 grid max-w-xl gap-3 text-left sm:grid-cols-3">
          {["Zaregistruj se – lekci zdarma máš hned na účtu", "Do 14 dní si rezervuj lekci a zaplať Kartičkou Pošli to dál", "Po rezervaci můžeš kartičku hned poslat dál"].map((s, i) => (
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
          <div className="mt-10">
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink href={`/registrace?karta=${card.code}`} variant="gold">Zajímá mě – chci lekci zdarma</ButtonLink>
              <ButtonLink href={`/karticka/${card.code}?ne`} variant="outline-light">Nezajímá mě</ButtonLink>
            </div>
            <Link href="/lekce" className="mt-5 inline-block text-sm text-papir/70 underline">Nejdřív se podívám na lekce</Link>
          </div>
        )}
      </Container>
    </section>
  );
}
