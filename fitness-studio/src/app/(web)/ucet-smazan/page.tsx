import type { Metadata } from "next";
import { ButtonLink, Container } from "@/components/ui";

export const metadata: Metadata = { title: "Účet smazán", robots: { index: false } };

export default function AccountDeletedPage() {
  return (
    <Container className="max-w-xl py-20 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Účet je smazaný</h1>
      <p className="mt-4 text-les/70">
        Mrzí nás, že odcházíš. Potvrzení jsme ti poslali e-mailem. Kdyby ses chtěl/a vrátit, stačí se znovu zaregistrovat – budeme
        rádi. 🐙
      </p>
      <ButtonLink href="/" variant="outline" className="mt-8">Na úvodní stránku</ButtonLink>
    </Container>
  );
}
