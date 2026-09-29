import { pushAllAction, pushTestAction } from "@/app/admin/push-actions";
import { ActionForm, SubmitButton } from "./forms";
import { PushToggle } from "./push-toggle";
import { Field, Input, Textarea } from "./ui";

/** Admin → Zprávy: turn push on for this device, send a test to yourself, then to everyone. */
export function PushPanel({ publicKey, subscribers }: { publicKey: string; subscribers: number }) {
  return (
    <div className="space-y-6 text-sm">
      <div>
        <p className="font-semibold">1. Zapni si upozornění ve svém telefonu</p>
        <p className="mt-1 text-les/60">Otevři tuhle stránku v mobilu (na iPhonu z ikony na ploše) a klepni na tlačítko.</p>
        <PushToggle publicKey={publicKey} className="mt-3" />
      </div>
      <ActionForm action={pushTestAction} className="space-y-4">
        <p className="font-semibold">2. Pošli si zkušební notifikaci</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nadpis"><Input name="title" defaultValue="OCTOPUSH" maxLength={80} required /></Field>
          <Field label="Odkaz po klepnutí" hint="Např. /rozvrh nebo /nastenka"><Input name="url" defaultValue="/rozvrh" /></Field>
        </div>
        <Field label="Text"><Textarea name="body" rows={2} maxLength={240} defaultValue="Zkušební upozornění – funguje to! 🐙" required /></Field>
        <SubmitButton>Poslat jen mně</SubmitButton>
      </ActionForm>
      <ActionForm action={pushAllAction} confirm={`Poslat notifikaci všem, kdo mají upozornění zapnutá (${subscribers})?`} className="space-y-4 border-t border-linka/60 pt-5">
        <p className="font-semibold">3. Pošli všem ({subscribers} {subscribers === 1 ? "člověk" : subscribers >= 2 && subscribers <= 4 ? "lidé" : "lidí"} s upozorněním)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nadpis"><Input name="title" defaultValue="OCTOPUSH" maxLength={80} required /></Field>
          <Field label="Odkaz po klepnutí"><Input name="url" defaultValue="/rozvrh" /></Field>
        </div>
        <Field label="Text"><Textarea name="body" rows={2} maxLength={240} required /></Field>
        <SubmitButton variant="outline" disabled={!subscribers}>Poslat všem</SubmitButton>
      </ActionForm>
      <p className="text-xs text-les/50">
        Automaticky chodí: připomínka lekce/masáže (kdo si připomínky zapnul), „uvolnilo se místo“ náhradníkům a zrušení lekce.
      </p>
    </div>
  );
}
