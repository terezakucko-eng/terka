import { changePasswordAction, deleteAccountAction, updateAvatarAction, updateProfileAction } from "@/app/actions/auth";
import { deletionCheck } from "@/domain/account-deletion";
import { credits } from "@/lib/money";
import { Avatar } from "@/components/avatar";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ImageInput } from "@/components/image-input";
import { Card, Field, Input, Select } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/db";
import { vapidKeys } from "@/lib/push";
import { PushToggle } from "@/components/push-toggle";
import { InstallButton } from "@/components/install-button";
import { MONTHS, OCTO_AVATARS, parseAvatar } from "@/lib/profile";
import { PasswordInput } from "@/components/password-input";

export default async function ProfilePage() {
  const user = await requireUser("/ucet/profil");
  const db = await getDb();
  const [{ publicKey }, deletion] = await Promise.all([vapidKeys(db), deletionCheck(db, user.id)]);
  const current = parseAvatar(user.avatar);
  const [nameDayMonth, nameDayDay] = user.nameDay?.split("-").map(Number) ?? [];
  const pickClass =
    "flex size-14 cursor-pointer items-center justify-center rounded-full border-2 border-transparent bg-white/70 text-2xl transition has-[:checked]:border-zlato has-[:checked]:bg-zlato/15";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <h2 className="text-xl font-semibold">Profilovka</h2>
        <ActionForm action={updateAvatarAction} resetOnSuccess={false} className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-start">
          <Avatar user={user} size={96} className="text-4xl" />
          <div className="flex-1 space-y-5">
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-les/70">Vyber si chobotničku</legend>
              <div className="flex flex-wrap gap-2">
                {current.kind === "photo" && !OCTO_AVATARS.includes(user.avatar ?? "") && (
                  <label className={pickClass} title="Ponechat fotku">
                    <input type="radio" name="avatar" value="keep" defaultChecked className="sr-only" />
                    <Avatar user={user} size={40} />
                  </label>
                )}
                {current.kind === "emoji" && (
                  <label className={pickClass} title="Ponechat">
                    <input type="radio" name="avatar" value={current.emoji} defaultChecked className="sr-only" />
                    {current.emoji}
                  </label>
                )}
                {OCTO_AVATARS.map((v, i) => (
                  <label key={v} className={pickClass} title={`Chobotnička ${i + 1}`}>
                    <input type="radio" name="avatar" value={v} defaultChecked={user.avatar === v} className="sr-only" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/avatars/octo-${i + 1}.svg`} alt="" width={44} height={44} className="rounded-full" />
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
            <span>Připomeň mi e-mailem lekci nebo masáž 3 hodiny předem</span>
          </label>
          <label className="flex gap-3 text-sm">
            <input type="checkbox" name="bookingEmails" defaultChecked={user.bookingEmails} className="mt-0.5 accent-[#674329]" />
            <span>
              Posílej mi e-mailem potvrzení mých rezervací a odhlášení
              <span className="block text-xs text-les/50">Zrušení lekce ze strany studia, uvolněné místo z pořadníku a platby ti přijdou vždy.</span>
            </span>
          </label>
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-les/70">Chci dostávat novinky a akce</legend>
            <label className="flex gap-3"><input type="checkbox" name="marketing" defaultChecked={user.marketingConsent} className="accent-[#674329]" /> E-mailem</label>
            <label className="flex gap-3"><input type="checkbox" name="sms" defaultChecked={user.smsConsent} className="accent-[#674329]" /> SMS</label>
            <label className="flex gap-3"><input type="checkbox" name="whatsapp" defaultChecked={user.whatsappConsent} className="accent-[#674329]" /> WhatsApp</label>
            <p className="text-xs text-les/60">
              Doporučujeme aspoň newsletter – o nových lekcích, workshopech a akcích se dozvíš jako první. Zrušení lekcí ze strany
              studia, platby a obnova hesla ti chodí vždy.
            </p>
          </fieldset>
          <SubmitButton>Uložit</SubmitButton>
        </ActionForm>
      </Card>
      <Card>
        <h2 className="text-xl font-semibold">OCTOPUSH v mobilu</h2>
        <p className="mt-2 text-sm text-les/70">Přidej si web na plochu – rozvrh, rezervace i členská karta budou jedním klepnutím jako aplikace.</p>
        <InstallButton className="mt-4" />
        <h2 className="mt-8 text-xl font-semibold">Upozornění v tomhle zařízení</h2>
        <p className="mt-2 text-sm text-les/70">
          Připomínka lekce, uvolněné místo z pořadníku nebo zrušená lekce ti přijde jako notifikace – rychleji než e-mail. Zapíná se zvlášť v každém zařízení – v mobilu i v počítači.
        </p>
        <PushToggle publicKey={publicKey} className="mt-4" installAbove />
      </Card>
      <Card>
        <h2 className="text-xl font-semibold">Změna hesla</h2>
        <ActionForm action={changePasswordAction} className="mt-5 space-y-4" resetOnSuccess>
          <Field label="Současné heslo"><PasswordInput name="current" autoComplete="current-password" required /></Field>
          <Field label="Nové heslo" hint="Alespoň 8 znaků."><PasswordInput name="password" autoComplete="new-password" minLength={8} required /></Field>
          <SubmitButton>Změnit heslo</SubmitButton>
        </ActionForm>
      </Card>
      {user.role === "client" && (
        <details className="rounded-2xl border border-linka/60 p-5 text-sm sm:p-6">
          <summary className="cursor-pointer font-semibold text-les/70">Smazat účet</summary>
          {deletion.blocker ? (
            <p className="mt-4 rounded-xl bg-zlato/15 p-4">{deletion.blocker}</p>
          ) : (
            <>
              <ul className="mt-4 list-disc space-y-1 pl-5 text-les/75">
                {deletion.upcomingBookings > 0 && <li>Zruší se tvoje nadcházející rezervace ({deletion.upcomingBookings}).</li>}
                {user.creditBalance > 0 && <li>Propadne ti {credits(user.creditBalance)} na účtu.</li>}
                <li>Propadnou nevyčerpané permanentky a vstupy.</li>
                <li>Smažeme tvoje jméno, e-mail, telefon, profil, příspěvky na nástěnce i recenzi.</li>
                <li>Záznamy o platbách musíme ze zákona uchovat – už ale bez tvého jména a kontaktu.</li>
                <li>Smazání nejde vrátit. Kdykoliv se ale můžeš zaregistrovat znovu.</li>
              </ul>
              <ActionForm action={deleteAccountAction} confirm="Opravdu nevratně smazat účet?" className="mt-5 space-y-4">
                <Field label="Pro potvrzení zadej heslo"><PasswordInput name="password" autoComplete="current-password" required /></Field>
                <label className="flex gap-3">
                  <input type="checkbox" name="confirm" required className="mt-1 accent-[#674329]" />
                  <span>Rozumím, že účet i výše uvedené se nevratně smaže.</span>
                </label>
                <SubmitButton variant="danger">Smazat účet</SubmitButton>
              </ActionForm>
            </>
          )}
        </details>
      )}
    </div>
  );
}
