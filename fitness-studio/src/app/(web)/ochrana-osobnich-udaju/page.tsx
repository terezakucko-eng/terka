import type { Metadata } from "next";
import { LegalPage } from "@/components/prose";
import { getContent } from "@/content";

export const metadata: Metadata = { title: "Ochrana osobních údajů" };

export default async function PrivacyPage() {
  const c = await getContent();
  return <LegalPage title="Ochrana osobních údajů" text={c("privacy.body")} />;
}
