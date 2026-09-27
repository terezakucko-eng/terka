import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { Container, PageHeader } from "@/components/ui";
import { creditPackPrice, credits, formatPrice } from "@/lib/money";
import { formatDate, pragueLocalToDate } from "@/lib/dates";
import { activeClassTypes, activeProducts } from "@/lib/queries";
import { getContent } from "@/content";
import { ContentImage } from "@/components/content-image";

export const metadata: Metadata = { title: "Lekce" };

export default async function ClassesPage() {
  const db = await getDb();
  const [types, packs, c] = await Promise.all([activeClassTypes(db), activeProducts(db), getContent()]);
  return (
    <>
      <PageHeader eyebrow={c("classes.eyebrow")} title={c("classes.title")}>
        {c("classes.intro")}
      </PageHeader>
      <Container className="py-12">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-linka/60 bg-linka/60 md:grid-cols-2 md:[&>*:last-child:nth-child(odd)]:col-span-2">
          {types.map((t, i) => (
            <article key={t.id} className="flex flex-col bg-papir">
              {t.imageUrl && (
                <div className="relative aspect-[16/9] overflow-hidden">
                  <ContentImage src={t.imageUrl} alt={t.name} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-8">
              <p className="eyebrow text-les/50">{String(i + 1).padStart(2, "0")} / {t.level}</p>
              <h2 className="mt-4 flex items-center gap-3 text-3xl font-semibold tracking-tight">
                <span className="size-3 rounded-full" style={{ background: t.color }} /> {t.name}
              </h2>
              <p className="mt-4 flex-1 text-les/70">{t.description}</p>
              <p className="mt-6 text-sm text-les/60">
                {t.durationMin} min · {credits(t.creditCost)}
                {creditPackPrice(t.creditCost, packs, t.dropInPrice) !== null &&
                  ` (z bodové permanentky ${formatPrice(creditPackPrice(t.creditCost, packs, t.dropInPrice)!)})`}
                {t.dropInPrice !== null && ` · jednorázově ${formatPrice(t.dropInPrice)}`}
                {t.firstVisitPrice !== null && ` · první lekce ${formatPrice(t.firstVisitPrice)}`}
                {t.passEntries > 1 && ` · z permanentky se strhnou ${t.passEntries} vstupy`}
              </p>
              {t.memberSurcharge !== null && t.memberSurcharge > 0 && (
                <p className="mt-1 text-sm text-les/60">
                  Členové doplácí {formatPrice(t.memberSurcharge)} za lekci
                  {t.memberSurchargeFrom && ` od ${formatDate(pragueLocalToDate(t.memberSurchargeFrom))}`}.
                </p>
              )}
              <Link href={`/rozvrh?lekce=${t.slug}`} className="eyebrow mt-6 text-zeme underline underline-offset-4 hover:text-les">
                Termíny v rozvrhu →
              </Link>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </>
  );
}
