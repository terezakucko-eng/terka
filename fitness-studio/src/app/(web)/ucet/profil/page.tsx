import { changePasswordAction, updateProfileAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function ProfilePage() {
  const user = await requireUser("/ucet/profil");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="text-xl font-semibold">Osobní údaje</h2>
        <ActionForm action={updateProfileAction} className="mt-5 space-y-4">
          <Field label="E-mail" hint="E-mail změní recepce."><Input value={user.email} disabled /></Field>
          <Field label="Jméno a příjmení"><Input name="name" defaultValue={user.name} required /></Field>
          <Field label="Telefon"><Input name="phone" type="tel" defaultValue={user.phone ?? ""} /></Field>
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-les/70">Chci dostávat novinky a akce</legend>
            <label className="flex gap-3"><input type="checkbox" name="marketing" defaultChecked={user.marketingConsent} className="accent-[#674329]" /> E-mailem</label>
            <label className="flex gap-3"><input type="checkbox" name="sms" defaultChecked={user.smsConsent} className="accent-[#674329]" /> SMS</label>
            <label className="flex gap-3"><input type="checkbox" name="whatsapp" defaultChecked={user.whatsappConsent} className="accent-[#674329]" /> WhatsApp</label>
          </fieldset>
          <SubmitButton>Uložit</SubmitButton>
        </ActionForm>
      </Card>
      <Card>
        <h2 className="text-xl font-semibold">Změna hesla</h2>
        <ActionForm action={changePasswordAction} className="mt-5 space-y-4" resetOnSuccess>
          <Field label="Současné heslo"><Input name="current" type="password" autoComplete="current-password" required /></Field>
          <Field label="Nové heslo" hint="Alespoň 8 znaků."><Input name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
          <SubmitButton>Změnit heslo</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
