import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { ContentImage } from "@/components/content-image";
import { SessionCard } from "@/components/session-card";
import { ButtonLink, Container, Empty, Eyebrow } from "@/components/ui";
import { VideoEmbed } from "@/components/video-embed";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { classTypes } from "@/db/schema";
import { opensFor, bookingWindowFor } from "@/domain/booking";
import { getCurrentUser } from "@/lib/auth";
import { credits, formatPrice } from "@/lib/money";
import { activeClassTypes, listSessions } from "@/lib/queries";
import { jsonLd } from "@/lib/seo";
import { splitKeywords } from "@/lib/keywords";
import { formatShortDay } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { nbsp } from "@/lib/typography";

const CITY = "Ostrava";
/** "Individuální trénink" is one-to-one – everything else is a group class. */
const kindOf = (name: string) => (/individu/i.test(name) ? "osobní trénink" : "skupinová lekce");

async function load(slug: string) {
  const [t] = await (await getDb())
    .select()
    .from(classTypes)
    .where(and(eq(classTypes.slug, slug), isNull(classTypes.archivedAt)));
  return t ?? null;
}

export async function generateMetadata({ params }: PageProps<"/lekce/[slug]">): Promise<Metadata> {
  const t = await load((await params).slug);
  if (!t) return {};
  const intro = `${t.name} v Ostravě – ${kindOf(t.name)} ve studiu ${site.name}.`;
  return {
    title: `${t.name} ${CITY}`,
    description: `${intro} ${t.description.replace(/\s+/g, " ")}`.slice(0, 160),
    keywords: splitKeywords(t.keywords),
    alternates: { canonical: `/lekce/${t.slug}` },
    // a prepared lesson stays out of search engines until it's switched on
    ...(t.isActive ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function LessonPage({ params }: PageProps<"/lekce/[slug]">) {
  const t = await load((await params).slug);
  const user = await getCurrentUser();
  if (!t || (!t.isActive && user?.role !== "admin")) notFound();

  const db = await getDb();
  const now = new Date();
  const [sessions, others, settings] = await Promise.all([
    listSessions(db, now, new Date(now.getTime() + 21 * 86_400_000), { classTypeId: t.id, includeCancelled: false }),
    activeClassTypes(db),
    getSettings(db),
  ]);
  const myWindow = await bookingWindowFor(db, settings, user?.id ?? null, now);
  const opens = (s: { startsAt: Date }) => opensFor(s, myWindow, settings, now);
  const tags = splitKeywords(t.keywords);
  const url = `${site.url}/lekce/${t.slug}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Service",
                "@id": `${url}#lekce`,
                name: `${t.name} ${CITY}`,
                serviceType: t.name,
                description: t.description,
                url,
                areaServed: { "@type": "City", name: CITY },
                provider: { "@id": `${site.url}/#studio` },
                ...(tags.length ? { keywords: tags.join(", ") } : {}),
                ...(t.dropInPrice !== null
                  ? { offers: { "@type": "Offer", price: (t.dropInPrice / 100).toFixed(0), priceCurrency: "CZK", url: `${site.url}/cenik` } }
                  : {}),
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Lekce", item: `${site.url}/lekce` },
                  { "@type": "ListItem", position: 2, name: t.name, item: url },
                ],
              },
            ],
          }),
        }}
      />
      {!t.isActive && (
        <p className="bg-zlato/20 px-4 py-3 text-center text-sm">
          Náhled pro administraci – lekce je <strong>neaktivní</strong>, návštěvníci ani Google tuhle stránku nevidí. Zveřejníš ji v
          Administrace → Lekce zaškrtnutím „Aktivní“.
        </p>
      )}
      <section className="border-b border-linka/60">
        <Container className="grid gap-10 py-12 sm:py-16 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <Link href="/lekce" className="eyebrow inline-flex items-center gap-2 text-les/50 hover:text-les">
              <ArrowLeft className="size-3.5" /> Všechny lekce
            </Link>
            <Eyebrow className="mt-6 text-zeme">{kindOf(t.name)} · {CITY}</Eyebrow>
            <h1 className="mt-3 flex items-center gap-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              <span className="size-4 shrink-0 rounded-full" style={{ background: t.color }} aria-hidden />
              {t.name}
            </h1>
            <p className="mt-6 max-w-xl text-lg text-les/75">{nbsp(t.description)}</p>
            <p className="mt-6 text-sm text-les/60">
              {t.level} · {t.durationMin} min · {credits(t.creditCost)}
              {t.dropInPrice !== null && ` · jednorázově ${formatPrice(t.dropInPrice)}`}
              {t.firstVisitPrice !== null && ` · první lekce${t.firstVisitNewOnly ? " pro nováčky" : ""} ${formatPrice(t.firstVisitPrice)}`}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={`/rozvrh?lekce=${t.slug}`} variant="gold">Termíny v rozvrhu</ButtonLink>
              {!user && (
                <ButtonLink href="/registrace" variant="outline">První lekce zdarma</ButtonLink>
              )}
              <ButtonLink href="/cenik" variant="ghost">Ceník</ButtonLink>
            </div>
          </div>
          {t.imageUrl && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
              <ContentImage src={t.imageUrl} alt={`${t.name} – ${site.name} ${CITY}`} fill priority sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
            </div>
          )}
        </Container>
      </section>

      <Container className="space-y-14 py-12">
        {t.videoUrl && <VideoEmbed url={t.videoUrl} title={t.name} className="max-w-3xl" />}

        <section>
          <h2 className="text-2xl font-semibold">Nejbližší termíny</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <div key={s.id}>
                <p className="eyebrow mb-2 text-les/50">{formatShortDay(s.startsAt)}</p>
                <SessionCard s={s} opens={opens(s)} />
              </div>
            ))}
          </div>
          {sessions.length === 0 && (
            <Empty>
              {kindOf(t.name) === "osobní trénink"
                ? "Termín domluvíme přímo s tebou – napiš nám nebo zavolej (kontakty najdeš dole na stránce)."
                : "Termíny právě chystáme – mrkni do rozvrhu nebo nás sleduj na Nástěnce."}
            </Empty>
          )}
        </section>

        {tags.length > 0 && (
          <section aria-label="Štítky">
            <ul className="flex flex-wrap gap-2">
              {tags.map((k) => (
                <li key={k} className="rounded-full border border-linka px-3 py-1 text-xs text-les/70">{k}</li>
              ))}
            </ul>
          </section>
        )}

        {others.length > 1 && (
          <section>
            <h2 className="text-2xl font-semibold">Další lekce v {site.name}</h2>
            <ul className="mt-5 flex flex-wrap gap-3">
              {others
                .filter((o) => o.id !== t.id)
                .map((o) => (
                  <li key={o.id}>
                    <Link href={`/lekce/${o.slug}`} className="inline-flex items-center gap-2 rounded-full border border-linka px-4 py-2 text-sm hover:border-les">
                      <span className="size-2.5 rounded-full" style={{ background: o.color }} aria-hidden /> {o.name}
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </Container>
    </>
  );
}
