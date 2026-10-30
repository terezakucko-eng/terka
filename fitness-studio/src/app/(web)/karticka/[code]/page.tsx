import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Container, Eyebrow } from "@/components/ui";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { CARD_PLACES, myPassCard, passCardByCode, startPassCardClock } from "@/domain/pass-cards";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { pluralCs } from "@/lib/money";
import { AutoplayVideo } from "@/components/autoplay-video";
import { PassCardSteps } from "@/components/pass-card-steps";
import { RegisterForm } from "@/components/register-form";
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
  if (!card?.isActive || card.placesLeft === 0 || card.expired) {
    return (
      <section className="bg-forest text-papir">
        <Container className="max-w-2xl py-20 text-center">
          <Eyebrow className="text-zlato">Pošli to dál</Eyebrow>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            {card?.isActive && card.expired ? "Tahle kartička propadla" : "Tahle kartička už je mimo hru"}
          </h1>
          {card?.isActive && card.expired && (
            <p className="mx-auto mt-6 max-w-lg text-lg text-papir/80">Měsíc ji nikdo nevyužil, tak se jí vybila baterka ⌛</p>
          )}
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

  // a new card's month starts with its first scan
  const validUntil = card.validUntil ?? (await startPassCardClock(db, card.id));

  if (ne !== undefined) {
    // scanned it, not for her – nothing taken, the card just goes on (and a thank-you for keeping the chain going)
    return (
      <section className="bg-forest text-papir">
        <Container className="max-w-2xl py-20 text-center">
          <p className="text-6xl">💛</p>
          <Eyebrow className="mt-6 text-zlato">Pošli to dál</Eyebrow>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Díky, že ji pošleš dál!</h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-papir/80">
            Jsme rádi, že řetězec bude pokračovat 🐙 Předej kartičku někomu, koho by pohyb potěšil. Místa na ní zůstávají
            {validUntil && <> – jen ať ji někdo využije do {formatDate(validUntil)}, pak propadne</>}.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink href={`/karticka/${card.code}`} variant="outline-light">Vlastně mě to zajímá</ButtonLink>
          </div>
        </Container>
      </section>
    );
  }

  // someone with an account: either she signed up with this very card (her lesson and the friend's place), or it's for new people
  const mine = user ? await myPassCard(db, user.id) : null;
  const hers = mine?.id === card.id && mine.open ? mine : null;

  if (user) {
    return (
      <section className="bg-forest text-papir">
        <Container className="max-w-lg py-14 text-center sm:py-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/symbol-gold.svg" alt="" className="mx-auto h-16 w-16" />
          <Eyebrow className="mt-4 text-zlato">Pošli to dál 💛</Eyebrow>
          {hers ? (
            <>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Lekci zdarma máš na účtu</h1>
              <div className="mt-8">
                <PassCardSteps code={card.code} friendPlace={hers.canComeAlone} center />
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Tahle kartička je pro nové 🙂</h1>
              <p className="mt-4 text-lg text-papir/80">Účet u nás už máš. Pošli ji dál někomu, kdo u nás ještě nebyl.</p>
              <ButtonLink href="/rozvrh" variant="outline-light" className="mt-8">Do rozvrhu</ButtonLink>
            </>
          )}
        </Container>
      </section>
    );
  }

  // people don't read: the free lesson, one line, and the sign-up form right here (texts in Obsah webu → Pošli to dál)
  const full = card.placesLeft === CARD_PLACES;
  const video = c.raw("passCard.video").trim();
  return (
    <section className="bg-forest text-papir">
      <Container className="max-w-lg py-10 sm:py-14">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/symbol-gold.svg" alt="" className="mx-auto h-16 w-16" />
          <Eyebrow className="mt-4 text-zlato">Pošli to dál 💛</Eyebrow>
          {/* a full card: one entry for her, one for a friend; the friend coming second gets her own */}
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{full ? c("passCard.title") : c("passCard.titleOne")}</h1>
          <p className="mt-3 text-lg text-papir/80">{full ? c("passCard.intro") : c("passCard.introOne")}</p>
          {/* the octopus explains it all – starts by itself, muted, captions in the picture */}
          {video && (
            <div className="mt-6">
              <AutoplayVideo src={video} poster={video.endsWith(".mp4") ? video.replace(/\.mp4$/, ".jpg") : undefined} label="Chobotnice Octopush vysvětluje, jak kartička Pošli to dál funguje" />
            </div>
          )}
          <p className="mt-5 text-sm text-papir/70">
            {c("passCard.about")} {c.raw("site.street")}, {c.raw("site.city")} · <Link href="/lekce" className="underline">Podívat se na lekce</Link>
          </p>
        </div>

        <div className="mt-8 rounded-3xl bg-papir p-6 text-les sm:p-8">
          <RegisterForm cardCode={card.code} submitLabel="Chci lekci zdarma" compact />
          {/* the other way out, right under the first – nothing taken, the card goes on */}
          <ButtonLink href={`/karticka/${card.code}?ne`} variant="danger" className="mt-3 w-full bg-chyba text-center text-papir hover:bg-chyba/90">
            Nezajímá mě – pošlu kartičku dál
          </ButtonLink>
          <p className="mt-5 text-center text-sm">
            Už máš účet? <Link href="/prihlaseni" className="font-semibold text-zeme underline underline-offset-4">Přihlas se</Link>
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-papir/60">
          Lekci si vyber do 14 dní. Kartička je jen pro nové klienty.
          {validUntil && <> Platí do {formatDate(validUntil)}.</>}
          {card.people > 0 && <> Už rozhýbala {pluralCs(card.people, "chobotničku", "chobotničky", "chobotniček")} 🐙</>}
        </p>
      </Container>
    </section>
  );
}
