import { RichText } from "./rich-text";
import { Container, PageHeader } from "./ui";

export function LegalPage({ title, text }: { title: string; text: string }) {
  return (
    <>
      <PageHeader eyebrow="Dokumenty" title={title} />
      <Container className="max-w-3xl py-12">
        <div className="space-y-4 leading-relaxed text-les/80 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-les [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          <RichText text={text} />
        </div>
      </Container>
    </>
  );
}
