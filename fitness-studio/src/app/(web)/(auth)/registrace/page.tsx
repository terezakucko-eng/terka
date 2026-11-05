import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/register-form";
import { Eyebrow } from "@/components/ui";
import { getDb } from "@/db";
import { getSettings } from "@/lib/settings";
import { getContent } from "@/content";
import { referrerByCode } from "@/domain/referrals";
import { passCardByCode } from "@/domain/pass-cards";

export const metadata: Metadata = { title: "Registrace" };

export default async function RegisterPage({ searchParams }: PageProps<"/registrace">) {
  const { next, pozvanka, karta } = await searchParams;
  const db = await getDb();
  const code = typeof pozvanka === "string" ? pozvanka : "";
  const cardCode = typeof karta === "string" ? karta : "";
  const [cfg, c, referrer, found] = await Promise.all([
    getSettings(db),
    getContent(),
    code ? referrerByCode(db, code) : null,
    cardCode ? passCardByCode(db, cardCode) : null,
  ]);
  // a Pošli to dál card in the game with a place left
  const card = found?.isActive && !found.expired && found.placesLeft > 0 ? found : null;
  return (
    <>
      <Eyebrow className="text-zeme">Nový účet</Eyebrow>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{c("auth.registerTitle")}</h1>
      {cfg.welcomeFreeEntries > 0 && !card && (
        <p className="mt-3 text-les/70">{c("auth.registerText")}</p>
      )}
      {referrer && (
        <p className="mt-4 rounded-2xl bg-zlato/15 p-4 text-sm">
          💛 Zve tě <strong>{referrer.name}</strong>. Vítej – {cfg.welcomeFreeEntries > 0 ? "první lekci máš u nás zdarma." : "těšíme se na tebe."}
        </p>
      )}
      {card && (
        <p className="mt-4 rounded-2xl bg-zlato/15 p-4 text-sm">
          💛 Přicházíš s kartičkou <strong>Pošli to dál</strong>. Po registraci máš u nás <strong>lekci zdarma</strong> na 14 dní – u rezervace
          ji zaplatíš Kartičkou Pošli to dál. Každý ji může využít jen jednou.
        </p>
      )}
      <div className="mt-8">
        <RegisterForm next={typeof next === "string" ? next : ""} referralCode={referrer ? code : undefined} cardCode={card?.code} />
      </div>
      <p className="mt-6 text-sm">Už máš účet? <Link href="/prihlaseni" className="font-semibold text-zeme underline underline-offset-4">Přihlas se</Link></p>
    </>
  );
}
