import { changePasswordAction, updateAvatarAction, updateProfileAction } from "@/app/actions/auth";
import { Avatar } from "@/components/avatar";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ImageInput } from "@/components/image-input";
import { Card, Field, Input, Select } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { AVATAR_EMOJI, MONTHS, parseAvatar } from "@/lib/profile";

export default async function ProfilePage() {
  const user = await requireUser("/ucet/profil");
  const current = parseAvatar(user.avatar);
  const [nameDayMonth, nameDayDay] = user.nameDay?.split("-").map(Number) ?? [];
  const pickClass =
    "flex size-12 cursor-pointer items-center justify-center rounded-full border-2 border-transparent bg-white/70 text-2xl transition has-[:checked]:border-zlato has-[:checked]:bg-zlato/15";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <h2 className="text-xl font-semibold">Profilovka</h2>
        <ActionForm action={updateAvatarAction} resetOnSuccess={false} className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar user={user} size={96} className="text-4xl" />
          <div className="flex-1 space-y-5">
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-les/70">Vyber si avatara</legend>
              <div className="flex flex-wrap gap-2">
                {current.kind === "photo" && (
                  <label className={pickClass} title="Ponechat fotku">
                    <input type="radio" name="avatar" value="keep" defaultChecked className="sr-only" />
                    <Avatar user={user} size={40} />
                  </label>
                )}
                {AVATAR_EMOJI.map((e) => (
                  <label key={e} className={pickClass}>
                    <input type="radio" name="avatar" value={e} defaultChecked={current.kind === "emoji" && current.emoji === e} className="sr-only" />
                    {e}
                  </label>
                ))}
                <label className={pickClass} title="Jen iniciály">
                  <input type="radio" name="avatar" value="none" defaultChecked={current.kind === "initials"} className="sr-only" />
                  <Avatar user={{ name: user.name }} size={40} />
                </label>
              </div>
            </fieldset>
            <Field label="…nebo nahraj svou fotku" hint="Ořízneme ji do kruhu. Když vybereš fotku, má přednost před avatarem.">
              <ImageInput name="photo" />
            </Field>
            <SubmitButton>Uložit profilovku</SubmitButton>
          </div>
        </ActionForm>
      </Card>
      <Card>
        <h2 className="text-xl font-semibold">Osobní údaje</h2>
        <ActionForm action={updateProfileAction} resetOnSuccess={false} className="mt-5 space-y-4">
          <Field label="E-mail" hint="E-mail změní recepce."><Input value={user.email} disabled /></Field>
          <Field label="Jméno a příjmení"><Input name="name" defaultValue={user.name} required /></Field>
          <Field label="Přezdívka" hint="Nepovinné. Uvidí ji ostatní na nástěnce místo tvého jména.">
            <Input name="nickname" maxLength={30} defaultValue={user.nickname ?? ""} />
          </Field>
          <Field label="Telefon"><Input name="phone" type="tel" defaultValue={user.phone ?? ""} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Narozeniny" hint="Nepovinné – ať ti můžeme popřát.">
              <Input name="birthDate" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={user.birthDate ?? ""} />
            </Field>
            <Field label="Svátek" hint="Nepovinné.">
              <div className="flex gap-2">
                <Select name="nameDayDay" defaultValue={nameDayDay ?? ""} aria-label="Den svátku">
                  <option value="">Den</option>
                  {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}.</option>)}
                </Select>
                <Select name="nameDayMonth" defaultValue={nameDayMonth ?? ""} aria-label="Měsíc svátku">
                  <option value="">Měsíc</option>
                  {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </Select>
              </div>
            </Field>
          </div>
          <label className="flex gap-3 text-sm">
            <input type="checkbox" name="reminders" defaultChecked={user.remindersOptIn} className="mt-0.5 accent-[#674329]" />
            <span>Připomeň mi e-mailem lekci nebo masáž den předem</span>
          </label>
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
