import Link from "next/link";
import { registerAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { HealthCheckbox } from "@/components/health-checkbox";
import { PasswordInput } from "@/components/password-input";
import { TurnstileWidget } from "@/components/turnstile";
import { Field, Input } from "@/components/ui";
import { HONEYPOT, STAMP, formStamp } from "@/lib/bot-guard";
import { turnstileSiteKey } from "@/lib/turnstile";

/**
 * The sign-up form – on /registrace, and right on the page a Pošli to dál card's QR code leads to.
 * `compact` (the card): just what's needed – no phone, newsletter as one tick.
 */
export function RegisterForm({
  next = "",
  referralCode,
  cardCode,
  submitLabel = "Vytvořit účet",
  compact = false,
}: {
  next?: string;
  referralCode?: string;
  cardCode?: string;
  submitLabel?: string;
  compact?: boolean;
}) {
  const turnstileKey = turnstileSiteKey();
  return (
    <ActionForm action={registerAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {referralCode && <input type="hidden" name="pozvanka" value={referralCode} />}
      {cardCode && <input type="hidden" name="karta" value={cardCode} />}
      <input type="hidden" name={STAMP} value={formStamp()} />
      {/* bots fill every field; people never see this one */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Web <input name={HONEYPOT} tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      </div>
      <Field label="Jméno a příjmení" hint={compact ? undefined : "Celé jméno – bude i na potvrzení pro pojišťovnu. Později ho změní jen recepce."}>
        <Input name="name" autoComplete="name" required />
      </Field>
      <Field label="E-mail"><Input name="email" type="email" autoComplete="email" required /></Field>
      {!compact && <Field label="Telefon" hint="Nepovinné – pro rychlé info o změnách lekcí."><Input name="phone" type="tel" autoComplete="tel" /></Field>}
      <Field label="Heslo" hint="Alespoň 8 znaků."><PasswordInput name="password" autoComplete="new-password" minLength={8} required /></Field>
      <label className="flex gap-3 text-sm text-les/80">
        <input type="checkbox" name="terms" required className="mt-1 accent-[#674329]" />
        <span>Souhlasím s <Link href="/obchodni-podminky" className="underline" target="_blank">obchodními podmínkami</Link> a beru na vědomí <Link href="/ochrana-osobnich-udaju" className="underline" target="_blank">zpracování osobních údajů</Link>.</span>
      </label>
      <HealthCheckbox />
      {compact ? (
        <label className="flex gap-3 text-sm text-les/80">
          <input type="checkbox" name="marketing" className="mt-1 accent-[#674329]" />
          <span>Chci e-mailem novinky a akce (nepovinné)</span>
        </label>
      ) : (
        <>
          <label className="flex gap-3 text-sm text-les/80">
            <input type="checkbox" name="reminders" className="mt-1 accent-[#674329]" />
            <span>Připomeň mi e-mailem lekci nebo masáž 3 hodiny předem (nepovinné)</span>
          </label>
          <fieldset className="space-y-2 rounded-xl border border-linka/60 p-4 text-sm text-les/80">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-les/60">Novinky a akce (nepovinné)</legend>
            <p className="text-xs text-les/70">
              Doporučujeme zaškrtnout aspoň newsletter – dozvíš se o nových lekcích, workshopech a akcích jako první.
            </p>
            <label className="flex gap-3"><input type="checkbox" name="marketing" className="mt-1 accent-[#674329]" /> E-mailem (newsletter)</label>
            <label className="flex gap-3"><input type="checkbox" name="sms" className="mt-1 accent-[#674329]" /> SMS</label>
            <label className="flex gap-3"><input type="checkbox" name="whatsapp" className="mt-1 accent-[#674329]" /> WhatsApp</label>
            <p className="text-xs text-les/50">Odhlásit se můžeš kdykoliv v profilu nebo odkazem ve zprávě.</p>
            <p className="text-xs text-les/50">
              Provozní e-maily a upozornění (potvrzení rezervace, zrušení nebo změna lekce, platby, obnova hesla) ti chodí vždy.
              Potvrzení vlastních rezervací si můžeš později vypnout v profilu.
            </p>
          </fieldset>
        </>
      )}
      {turnstileKey && <TurnstileWidget siteKey={turnstileKey} />}
      <SubmitButton variant="gold" className="w-full">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
