import type { Metadata } from "next";
import Link from "next/link";
import { ContentImage } from "@/components/content-image";
import { Container, PageHeader } from "@/components/ui";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { activeMassageServices } from "@/domain/massages";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = { title: "Masáže" };

export default async function MassagesPage() {
  const [services, c] = await Promise.all([activeMassageServices(await getDb()), getContent()]);
  return (
    <>
      <PageHeader eyebrow={c("massages.eyebrow")} title={c("massages.title")}>
        {c("massages.intro")}
      </PageHeader>
      <Container className="py-12">
        {services.length === 0 ? (
          <p className="max-w-xl text-les/70">{c("massages.noSlots")}</p>
        ) : (
          <div className="grid gap-px overflow-hidden rounded-2xl border border-linka/60 bg-linka/60 md:grid-cols-2">
            {services.map((m) => (
              <article key={m.id} className="flex flex-col bg-papir">
                {m.imageUrl && (
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <ContentImage src={m.imageUrl} alt={m.name} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-8">
                  <p className="eyebrow text-les/50">{m.durationMin} min</p>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight">{m.name}</h2>
                  <p className="mt-4 flex-1 whitespace-pre-line text-les/70">{m.description}</p>
                  <p className="mt-6 text-2xl font-semibold">{formatPrice(m.price)}</p>
                  <Link href={`/masaze/${m.slug}`} className="eyebrow mt-6 text-zeme underline underline-offset-4 hover:text-les">
                    Vybrat termín →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="mt-10 max-w-2xl text-les/70">{c("massages.paymentInfo")}</p>
      </Container>
    </>
  );
}
