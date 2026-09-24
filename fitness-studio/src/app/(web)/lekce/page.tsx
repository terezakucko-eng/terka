import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { Container, PageHeader } from "@/components/ui";
import { credits, formatPrice } from "@/lib/money";
import { activeClassTypes } from "@/lib/queries";
import { getContent } from "@/content";
import { ContentImage } from "@/components/content-image";

export const metadata: Metadata = { title: "Lekce" };

export default async function ClassesPage() {
  const [types, c] = await Promise.all([activeClassTypes(await getDb()), getContent()]);
  return (
    <>
      <PageHeader eyebrow={c("classes.eyebrow")} title={c("classes.title")}>
        {c("classes.intro")}
      </PageHeader>
      <Container className="py-12">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-linka/60 bg-linka/60 md:grid-cols-2">
          {types.map((t, i) => (
            <article key={t.id} className="flex flex-col bg-papir">
              {t.imageUrl && (
                <div className="relative aspect-[16/9] overflow-hidden">
                  <ContentImage src={t.imageUrl} alt={t.name} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-8">
              <p className="eyebrow text-les/50">{String(i + 1).padStart(2, "0")} / {t.level}</p>
              <h2 className="mt-4 flex items-center gap-3 text-3xl font-medium tracking-tight">
                <span className="size-3 rounded-full" style={{ background: t.color }} /> {t.name}
              </h2>
              <p className="mt-4 flex-1 text-les/70">{t.description}</p>
              <p className="mt-6 text-sm text-les/60">
                {t.durationMin} min · {credits(t.creditCost)}
                {t.dropInPrice !== null && ` · jednorázově ${formatPrice(t.dropInPrice)}`}
              </p>
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
