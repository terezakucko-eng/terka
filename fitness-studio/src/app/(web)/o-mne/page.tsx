import type { Metadata } from "next";
import { ContentImage } from "@/components/content-image";
import { RichText } from "@/components/rich-text";
import { ButtonLink, Container, PageHeader } from "@/components/ui";
import { getContent } from "@/content";

export const metadata: Metadata = { title: "O mně" };

export default async function AboutPage() {
  const c = await getContent();
  return (
    <>
      <PageHeader eyebrow={c("about.eyebrow")} title={c("about.title")}>
        {c("about.intro")}
      </PageHeader>
      <Container className="grid gap-12 py-14 md:grid-cols-[1fr_1.2fr] md:items-start">
        <figure className="md:sticky md:top-24">
          <div className="relative aspect-[4/5] overflow-hidden">
            <ContentImage src={c("about.image")} alt={c("about.imageAlt")} fill priority sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
          </div>
          <figcaption className="eyebrow mt-4 text-les/70">{c("about.caption")}</figcaption>
        </figure>
        <div>
          <div className="space-y-4 text-lg leading-relaxed text-les/80 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-les [&_h2:first-child]:mt-0 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
            <RichText text={c("about.body")} />
          </div>
          <ButtonLink href="/rozvrh" variant="gold" className="mt-10">{c("about.cta")}</ButtonLink>
        </div>
      </Container>
    </>
  );
}
