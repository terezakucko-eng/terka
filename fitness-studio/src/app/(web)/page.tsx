import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { Symbol, Wordmark } from "@/components/brand";
import { SessionCard } from "@/components/session-card";
import { ButtonLink, Container, Eyebrow } from "@/components/ui";
import { Values } from "@/components/values";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { activeProducts, listSessions, publishedAnnouncements } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export default async function Home() {
  const db = await getDb();
  const user = await getCurrentUser();
  const now = new Date();
  const [upcoming, news, productList, cfg] = await Promise.all([
    listSessions(db, now, new Date(now.getTime() + 14 * 86_400_000), {
      userId: user?.id,
      includeCancelled: false,
    }),
    publishedAnnouncements(db),
    activeProducts(db),
    getSettings(db),
  ]);
  const cheapest = productList.find((p) => p.kind === "membership");

  return (
    <>
      {/* 01 — HERO */}
      <section className="bg-forest text-papir">
        <Container className="grid items-center gap-10 py-14 md:grid-cols-[1fr_1.1fr] md:py-20">
          <figure className="order-2 md:order-1">
            <div className="relative aspect-[4/5] overflow-hidden">
              <Image
                src="/img/priroda.webp"
                alt="List s kapkami rosy"
                fill
                priority
                sizes="(min-width: 768px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="eyebrow mt-4 text-papir/60">01 / Příroda</figcaption>
          </figure>
          <div className="order-1 text-center md:order-2">
            <p className="eyebrow text-papir/60">{site.name} / Studio pohybu</p>
            <Symbol className="mx-auto mt-10 w-48 sm:w-64" />
            <h1 className="mt-8">
              <Wordmark className="mx-auto w-full max-w-md" />
              <span className="sr-only">{site.name}</span>
            </h1>
            <div className="mx-auto mt-6 h-px max-w-md bg-zlato/40" />
            <p className="eyebrow mt-5 text-papir/85">{site.tagline}</p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href="/rozvrh" variant="gold">
                Rezervovat lekci
              </ButtonLink>
              <ButtonLink href={user ? "/ucet" : "/registrace"} variant="outline-light">
                {user ? "Můj účet" : "První lekce zdarma"}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      {/* 02 — CHARAKTER */}
      <section>
        <Container className="py-16 sm:py-20">
          <Eyebrow n="02" className="text-zeme">Charakter značky</Eyebrow>
          <div className="mt-6 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <h2 className="text-5xl font-medium tracking-tight sm:text-7xl">Síla v rovnováze.</h2>
            <p className="eyebrow max-w-xs leading-7 text-les/70">
              Pohyb · Lidé
              <br />
              Příroda · Harmonie
            </p>
          </div>
          <hr className="my-12 border-linka/60" />
          <Values />
        </Container>
      </section>

      {/* ROZVRH */}
      <section className="border-y border-linka/60 bg-krem/40">
        <Container className="py-16 sm:py-20">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <Eyebrow className="text-zeme">Nejbližší lekce</Eyebrow>
              <h2 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Vyber si svou lekci</h2>
            </div>
            <Link href="/rozvrh" className="eyebrow inline-flex items-center gap-2 text-zeme hover:text-les">
              Celý rozvrh <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {upcoming.slice(0, 8).map((s) => (
              <div key={s.id}>
                <p className="eyebrow mb-2 text-les/50">
                  {new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", weekday: "long", day: "numeric", month: "numeric" }).format(s.startsAt)}
                </p>
                <SessionCard s={s} />
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* 03-05 — EDITORIAL */}
      <section>
        <Container className="grid gap-6 py-16 sm:py-20 md:grid-cols-[1.1fr_1fr]">
          <figure>
            <div className="relative aspect-[5/4] overflow-hidden md:aspect-auto md:h-full md:min-h-[520px]">
              <Image src="/img/pohyb.webp" alt="Pilates reformer ve studiu" fill sizes="(min-width: 768px) 55vw, 100vw" className="object-cover" />
            </div>
            <figcaption className="eyebrow mt-4 text-les/70">03 / Pohyb</figcaption>
          </figure>
          <div className="grid gap-6">
            <figure>
              <div className="relative aspect-[16/8] overflow-hidden">
                <Image src="/img/jidlo.webp" alt="Salát s avokádem" fill sizes="(min-width: 768px) 45vw, 100vw" className="object-cover" />
              </div>
              <figcaption className="eyebrow mt-4 text-les/70">04 / Jídlo</figcaption>
            </figure>
            <figure>
              <div className="relative aspect-[16/8] overflow-hidden">
                <Image src="/img/prostor.webp" alt="Pobřeží při západu slunce" fill sizes="(min-width: 768px) 45vw, 100vw" className="object-cover" />
                <p className="absolute inset-0 flex items-center justify-center font-script text-5xl text-zlato-light drop-shadow sm:text-6xl">
                  {site.claim}
                </p>
              </div>
              <figcaption className="eyebrow mt-4 text-les/70">05 / Prostor</figcaption>
            </figure>
          </div>
        </Container>
      </section>

      {/* JAK TO FUNGUJE */}
      <section className="bg-forest text-papir">
        <Container className="py-16 sm:py-20">
          <Eyebrow className="text-zlato">Jak to funguje</Eyebrow>
          <h2 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Tři kroky na podložku</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              ["Zaregistruj se", `Účet máš za minutu – a ${cfg.welcomeFreeEntries > 0 ? "první lekci od nás dostaneš zdarma" : "hned můžeš rezervovat"}.`],
              ["Vyber lekci", "V rozvrhu vidíš volná místa v reálném čase. Plno? Zapiš se do pořadníku – uvolněné místo ti automaticky přidělíme."],
              ["Plať, jak ti to sedí", "Kredit, permanentka, měsíční členství nebo jednorázový vstup kartou. Storno zdarma do " + cfg.cancellationHours + " h před lekcí."],
            ].map(([t, d], i) => (
              <li key={t} className="border-t border-zlato/30 pt-6">
                <span className="text-gold text-5xl font-light">0{i + 1}</span>
                <h3 className="mt-4 text-xl font-medium">{t}</h3>
                <p className="mt-2 text-papir/70">{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/cenik" variant="gold">
              Ceník {cheapest ? `· členství od ${formatPrice(cheapest.price)}` : ""}
            </ButtonLink>
            <ButtonLink href="/lekce" variant="outline-light">Typy lekcí</ButtonLink>
          </div>
        </Container>
      </section>

      {/* AKTUALITY */}
      {news.length > 0 && (
        <section>
          <Container className="py-16 sm:py-20">
            <Eyebrow className="text-zeme">Aktuality</Eyebrow>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {news.map((a) => (
                <article key={a.id} className="border-t border-les/80 pt-5">
                  <p className="eyebrow text-les/50">{formatDate(a.createdAt)}</p>
                  <h3 className="mt-2 text-xl font-medium">{a.title}</h3>
                  <p className="mt-2 whitespace-pre-line text-les/70">{a.body}</p>
                </article>
              ))}
            </div>
          </Container>
        </section>
      )}
    </>
  );
}
