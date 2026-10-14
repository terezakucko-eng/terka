import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink, Container, Eyebrow } from "@/components/ui";
import { getDb } from "@/db";
import { referrerByCode } from "@/domain/referrals";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export async function generateMetadata({ params }: PageProps<"/pozvanka/[code]">): Promise<Metadata> {
  const { code } = await params;
  const r = await referrerByCode(await getDb(), code);
  return {
    title: r ? `${r.name} tě zve do OCTOPUSH` : "Pozvánka do OCTOPUSH",
    description: "Pojď si zacvičit – první lekce je u nás zdarma.",
    robots: { index: false },
  };
}

/** Landing page of a client's invite link (Pozvi kamarádku). */
export default async function InvitePage({ params }: PageProps<"/pozvanka/[code]">) {
  const { code } = await params;
  const db = await getDb();
  const [referrer, user, cfg] = await Promise.all([referrerByCode(db, code), getCurrentUser(), getSettings(db)]);
  if (!referrer) redirect("/registrace");
  return (
    <section className="bg-forest text-papir">
      <Container className="max-w-2xl py-20 text-center">
        <Eyebrow className="text-zlato">Pozvánka 💛</Eyebrow>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
          <span className="text-gold">{referrer.name}</span> tě zve do OCTOPUSH
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-lg text-papir/80">
          {cfg.welcomeFreeEntries > 0
            ? "Pojď si zacvičit taky – první lekce je u nás zdarma. Stačí se zaregistrovat a vybrat si lekci v rozvrhu."
            : "Pojď si zacvičit taky. Stačí se zaregistrovat a vybrat si lekci v rozvrhu."}
        </p>
        {user ? (
          <div className="mt-10">
            <p className="text-papir/70">Účet u nás už máš 🙂</p>
            <ButtonLink href="/rozvrh" variant="gold" className="mt-4">Vybrat lekci</ButtonLink>
          </div>
        ) : (
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink href={`/registrace?pozvanka=${code}`} variant="gold">Zaregistrovat se</ButtonLink>
            <ButtonLink href="/lekce" variant="outline-light">Prohlédnout lekce</ButtonLink>
          </div>
        )}
      </Container>
    </section>
  );
}
