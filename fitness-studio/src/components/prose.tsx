import type { ReactNode } from "react";
import { Container, PageHeader } from "./ui";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <PageHeader eyebrow="Dokumenty" title={title} />
      <Container className="max-w-3xl py-12">
        <p className="mb-8 rounded-xl bg-zlato/20 p-4 text-sm text-zeme">
          Vzorový text – před spuštěním webu jej prosím nechte zkontrolovat a doplnit (právník / účetní).
        </p>
        <div className="space-y-4 leading-relaxed text-les/80 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-les [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </div>
      </Container>
    </>
  );
}
