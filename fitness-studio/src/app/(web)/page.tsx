import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getContent } from "@/content";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { Symbol, Wordmark } from "@/components/brand";
import { ContentImage } from "@/components/content-image";
import { SessionCard } from "@/components/session-card";
import { ButtonLink, Container, Eyebrow } from "@/components/ui";
import { Values } from "@/components/values";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatShortDay } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { activeProducts, listSessions, publishedAnnouncements } from "@/lib/queries";

export default async function Home() {
  const db = await getDb();
  const now = new Date();
  const [user, c, upcoming, news, productList] = await Promise.all([
    getCurrentUser(),
    getContent(),
    listSessions(db, now, new Date(now.getTime() + 14 * 86_400_000), { includeCancelled: false }),
    publishedAnnouncements(db),
    activeProducts(db),
  ]);
  const cheapest = productList.find((p) => p.kind === "membership");
  const values = Array.from({ length: 8 }, (_, i) => ({
    title: c(`homeCharacter.v${i + 1}Title`),
    sub: c(`homeCharacter.v${i + 1}Sub`),
  })).filter((v) => v.title);
  const steps = [1, 2, 3].map((n) => ({
    title: c(`homeSteps.s${n}Title` as const),
    text: c(`homeSteps.s${n}Text` as const),
  }));

  return (
    <>
      {/* HERO */}
      <section className="bg-forest text-papir">
        <Container className="grid items-center gap-10 py-14 md:grid-cols-[1fr_1.1fr] md:py-8">
          <figure className="order-2 md:order-1">
            <div className="relative aspect-[4/5] overflow-hidden md:aspect-auto md:h-[calc(100svh-9rem)] md:max-h-[720px] md:min-h-[420px]">
              <ContentImage src={c("homeHero.image")} alt={c("homeHero.imageAlt")} fill priority sizes="(min-width: 768px) 45vw, 100vw" className="object-cover" />
            </div>
            <figcaption className="eyebrow empty:hidden mt-4 text-papir/60">{c("homeHero.caption")}</figcaption>
          </figure>
          <div className="order-1 text-center md:order-2">
            <p className="eyebrow empty:hidden text-papir/60">{c("homeHero.eyebrow")}</p>
            <Symbol className="mx-auto mt-10 w-48 sm:w-64 md:mt-6 md:w-40 lg:w-52" />
            <h1 className="mt-8 md:mt-5">
              <Wordmark className="mx-auto w-full max-w-md md:max-w-sm" />
              <span className="sr-only">{site.name}</span>
            </h1>
            <div className="mx-auto mt-6 h-px max-w-md bg-zlato/40" />
            <p className="eyebrow mt-5 text-papir/85">{c("site.tagline")}</p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row md:mt-7">
              <ButtonLink href="/rozvrh" variant="gold">{c("homeHero.ctaPrimary")}</ButtonLink>
              <ButtonLink href={user ? "/ucet" : "/registrace"} variant="outline-light">
                {user ? "Můj účet" : c("homeHero.ctaSecondary")}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      {/* CHARAKTER */}
      <section>
        <Container className="py-16 sm:py-20">
          <Eyebrow className="text-zeme">{c("homeCharacter.eyebrow")}</Eyebrow>
          <div className="mt-6 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <h2 className="text-5xl font-semibold tracking-tight sm:text-7xl">{c("homeCharacter.headline")}</h2>
            <p className="eyebrow empty:hidden max-w-xs whitespace-pre-line leading-7 text-les/70">{c("homeCharacter.side")}</p>
          </div>
          <hr className="my-12 border-linka/60" />
          <Values values={values} />
        </Container>
      </section>

      {/* ROZVRH */}
      <section className="border-y border-linka/60 bg-krem/40">
        <Container className="py-16 sm:py-20">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <Eyebrow className="text-zeme">{c("homeSchedule.eyebrow")}</Eyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{c("homeSchedule.title")}</h2>
            </div>
            <Link href="/rozvrh" className="eyebrow inline-flex items-center gap-2 text-zeme hover:text-les">
              {c("homeSchedule.link")} <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {upcoming.slice(0, 8).map((s) => (
              <div key={s.id}>
                <p className="eyebrow mb-2 text-les/50">{formatShortDay(s.startsAt)}</p>
                <SessionCard s={s} />
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* GALERIE – čtyři fotky jako čtyři pilíře */}
      <section>
        <Container className="py-16 sm:py-20">
          <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
            {([1, 2, 3, 4] as const).map((n) => (
              <figure key={n}>
                <div className="relative aspect-[3/4] overflow-hidden">
                  <ContentImage
                    src={c(`homeGallery.image${n}`)}
                    alt={c(`homeGallery.alt${n}`)}
                    fill
                    sizes="(min-width: 768px) 25vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <figcaption className="eyebrow empty:hidden mt-4 text-center text-les/70">{c(`homeGallery.caption${n}`)}</figcaption>
              </figure>
            ))}
          </div>
          <p className="mx-auto mt-14 max-w-3xl text-center font-script text-4xl leading-snug text-zeme empty:hidden sm:text-5xl">
            {c("site.claim")}
          </p>
        </Container>
      </section>

      {/* JAK TO FUNGUJE */}
      <section className="bg-forest text-papir">
        <Container className="py-16 sm:py-20">
          <Eyebrow className="text-zlato">{c("homeSteps.eyebrow")}</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{c("homeSteps.title")}</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={i} className="border-t border-zlato/30 pt-6">
                <span className="text-gold text-5xl font-light">0{i + 1}</span>
                <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-papir/70">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/cenik" variant="gold">
              {c("homeSteps.ctaPricing")} {cheapest ? `· členství od ${formatPrice(cheapest.price)}` : ""}
            </ButtonLink>
            <ButtonLink href="/lekce" variant="outline-light">{c("homeSteps.ctaClasses")}</ButtonLink>
          </div>
        </Container>
      </section>

      {/* AKTUALITY */}
      {news.length > 0 && (
        <section>
          <Container className="py-16 sm:py-20">
            <Eyebrow className="text-zeme">{c("homeNews.eyebrow")}</Eyebrow>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {news.map((a) => (
                <article key={a.id} className="border-t border-les/80 pt-5">
                  <p className="eyebrow text-les/50">{formatDate(a.createdAt)}</p>
                  <h3 className="mt-2 text-xl font-semibold">{a.title}</h3>
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
