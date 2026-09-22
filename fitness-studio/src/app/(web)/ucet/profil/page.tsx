import { changePasswordAction, updateProfileAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function ProfilePage() {
  const user = await requireUser("/ucet/profil");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="text-xl font-medium">Osobní údaje</h2>
        <ActionForm action={updateProfileAction} className="mt-5 space-y-4">
          <Field label="E-mail" hint="E-mail změní recepce."><Input value={user.email} disabled /></Field>
          <Field label="Jméno a příjmení"><Input name="name" defaultValue={user.name} required /></Field>
          <Field label="Telefon"><Input name="phone" type="tel" defaultValue={user.phone ?? ""} /></Field>
          <label className="flex gap-3 text-sm"><input type="checkbox" name="marketing" defaultChecked={user.marketingConsent} className="accent-[#674329]" /> Chci dostávat novinky e-mailem</label>
          <SubmitButton>Uložit</SubmitButton>
        </ActionForm>
      </Card>
      <Card>
        <h2 className="text-xl font-medium">Změna hesla</h2>
        <ActionForm action={changePasswordAction} className="mt-5 space-y-4" resetOnSuccess>
          <Field label="Současné heslo"><Input name="current" type="password" autoComplete="current-password" required /></Field>
          <Field label="Nové heslo" hint="Alespoň 8 znaků."><Input name="password" type="password" autoComplete="new-password" minLength={8} required /></Field>
          <SubmitButton>Změnit heslo</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
