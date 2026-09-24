import type { Metadata } from "next";
import { LegalPage } from "@/components/prose";
import { getContent } from "@/content";

export const metadata: Metadata = { title: "Obchodní podmínky" };

export default async function TermsPage() {
  const c = await getContent();
  return <LegalPage title="Obchodní podmínky" text={c("terms.body")} />;
}
