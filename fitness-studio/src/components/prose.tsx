import { RichText } from "./rich-text";
import { Container, PageHeader } from "./ui";

export function LegalPage({ title, text }: { title: string; text: string }) {
  return (
    <>
      <PageHeader eyebrow="Dokumenty" title={title} />
      <Container className="max-w-3xl py-12">
        <RichText text={text} className="leading-relaxed text-les/80" />
      </Container>
    </>
  );
}
