import type { Metadata } from "next";
import Link from "next/link";
import { registerAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Eyebrow, Field, Input } from "@/components/ui";
import { getDb } from "@/db";
import { getSettings } from "@/lib/settings";
import { getContent } from "@/content";

export const metadata: Metadata = { title: "Registrace" };

export default async function RegisterPage({ searchParams }: PageProps<"/registrace">) {
  const { next } = await searchParams;
  const [cfg, c] = await Promise.all([getSettings(await getDb()), getContent()]);
  return (
    <>
      <Eyebrow className="text-zeme">Nový účet</Eyebrow>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{c("auth.registerTitle")}</h1>
      {cfg.welcomeFreeEntries > 0 && (
        <p className="mt-3 text-les/70">{c("auth.registerText")}</p>
      )}
      <ActionForm action={registerAction} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
        <Field label="Jméno a příjmení"><Input name="name" autoComplete="name" required /></Field>
        <Field label="E-mail"><Input name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Telefon" hint="Nepovinné – pro rychlé info o změnách lekcí."><Input name="phone" type="tel" autoComplete="tel" /></Field>
        <Field label="Heslo" hint="Alespoň 8 znaků."><Input name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
        <label className="flex gap-3 text-sm text-les/80">
          <input type="checkbox" name="terms" required className="mt-1 accent-[#674329]" />
          <span>Souhlasím s <Link href="/obchodni-podminky" className="underline" target="_blank">obchodními podmínkami</Link> a beru na vědomí <Link href="/ochrana-osobnich-udaju" className="underline" target="_blank">zpracování osobních údajů</Link>.</span>
        </label>
        <fieldset className="space-y-2 rounded-xl border border-linka/60 p-4 text-sm text-les/80">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-les/60">Novinky a akce (nepovinné)</legend>
          <label className="flex gap-3"><input type="checkbox" name="marketing" className="mt-1 accent-[#674329]" /> E-mailem (newsletter)</label>
          <label className="flex gap-3"><input type="checkbox" name="sms" className="mt-1 accent-[#674329]" /> SMS</label>
          <label className="flex gap-3"><input type="checkbox" name="whatsapp" className="mt-1 accent-[#674329]" /> WhatsApp</label>
          <p className="text-xs text-les/50">Odhlásit se můžeš kdykoliv v profilu nebo odkazem ve zprávě.</p>
        </fieldset>
        <SubmitButton variant="gold" className="w-full">Vytvořit účet</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm">Už máš účet? <Link href="/prihlaseni" className="font-semibold text-zeme underline underline-offset-4">Přihlas se</Link></p>
    </>
  );
}
