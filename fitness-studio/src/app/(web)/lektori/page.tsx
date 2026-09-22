import type { Metadata } from "next";
import { getDb } from "@/db";
import { Symbol } from "@/components/brand";
import { Container, PageHeader } from "@/components/ui";
import { activeInstructors } from "@/lib/queries";
import { getContent } from "@/content";
import { ContentImage } from "@/components/content-image";

export const metadata: Metadata = { title: "Lektoři" };

export default async function InstructorsPage() {
  const [list, c] = await Promise.all([activeInstructors(await getDb()), getContent()]);
  return (
    <>
      <PageHeader eyebrow={c("instructors.eyebrow")} title={c("instructors.title")}>
        {c("instructors.intro")}
      </PageHeader>
      <Container className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((i) => (
          <article key={i.id}>
            <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-forest">
              {i.photoUrl ? (
                <ContentImage src={i.photoUrl} alt={i.name} fill sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover" />
              ) : (
                <Symbol className="w-1/2 opacity-60" />
              )}
            </div>
            <p className="eyebrow mt-4 text-zeme">{i.specialties}</p>
            <h2 className="mt-1 text-2xl font-medium">{i.name}</h2>
            <p className="mt-2 text-les/70">{i.bio}</p>
          </article>
        ))}
      </Container>
    </>
  );
}
