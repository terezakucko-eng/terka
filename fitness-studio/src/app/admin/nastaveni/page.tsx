import { resetOrdersAction, saveSettingsAction } from "@/app/admin/actions";
import { dateKey } from "@/lib/dates";
import { AdminTitle } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input } from "@/components/ui";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { paymentProvider } from "@/lib/payments";
import { getSettings, type Settings } from "@/lib/settings";

const fields: { key: keyof Settings; label: string; hint: string }[] = [
  { key: "cancellationHours", label: "Storno zdarma (hodin před lekcí)", hint: "Později vstup propadá." },
  { key: "bookingWindowDays", label: "Rezervace dopředu (dní)", hint: "Jak daleko do budoucna lze rezervovat." },
  { key: "bookingCutoffMinutes", label: "Uzávěrka rezervací (min před začátkem)", hint: "0 = do začátku lekce." },
  { key: "welcomeFreeEntries", label: "Vstupy zdarma pro nové klienty", hint: "0 = vypnuto." },
  { key: "welcomeFreeValidityDays", label: "Platnost úvodního vstupu (dní)", hint: "" },
  { key: "pendingPaymentMinutes", label: "Držení místa při platbě kartou (min)", hint: "Minimálně 30 (Stripe)." },
  { key: "massageBufferMinutes", label: "Masáže – pauza mezi masážemi (min)", hint: "Čas na úklid a převlečení." },
  { key: "massageStepMinutes", label: "Masáže – začátky po (min)", hint: "30 = 9:00, 9:30, 10:00…" },
];

export default async function AdminSettings() {
  await requireAdmin();
  const cfg = await getSettings(await getDb());
  const provider = paymentProvider();
  return (
    <>
      <AdminTitle title="Nastavení" />
      <Card className="max-w-3xl">
        <h2 className="font-semibold">Pravidla rezervací</h2>
        <ActionForm action={saveSettingsAction} className="mt-5 grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint || undefined}>
              <Input name={f.key} type="number" min={0} defaultValue={cfg[f.key]} required />
            </Field>
          ))}
          <div className="sm:col-span-2"><SubmitButton>Uložit</SubmitButton></div>
        </ActionForm>
      </Card>
      <Card className="mt-6 max-w-3xl text-sm">
        <h2 className="font-semibold">Start studia – vynulovat testovací platby</h2>
        <p className="mt-2 text-les/70">
          Smaže objednávky vybraného druhu vytvořené do zvoleného dne včetně. Klientům se odebere, co z nich dostali
          (permanentky, členství, kredit), a tržby na přehledu se vynulují. Rezervace lekcí zůstanou. Jednotlivé platby
          jde smazat i v Platbách.
        </p>
        <ActionForm
          action={resetOrdersAction}
          confirm="Opravdu smazat vybrané objednávky? Tohle nejde vrátit."
          className="mt-4 space-y-4"
        >
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2"><input type="checkbox" name="reception" defaultChecked /> Recepce</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="manual" defaultChecked /> Ručně označené</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="test" defaultChecked /> Testovací brána</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="stripe" /> Karta online (Stripe)</label>
          </div>
          <Field label="Vytvořené do dne (včetně)">
            <Input name="before" type="date" defaultValue={dateKey(new Date())} required className="max-w-xs" />
          </Field>
          <SubmitButton variant="outline">Smazat vybrané platby</SubmitButton>
        </ActionForm>
      </Card>
      <Card className="mt-6 max-w-3xl text-sm">
        <h2 className="font-semibold">Integrace</h2>
        <ul className="mt-3 space-y-1 text-les/70">
          <li>Platby: <strong>{provider === "stripe" ? "Stripe (ostrý provoz)" : provider === "test" ? "Testovací brána" : "Vypnuto"}</strong></li>
          <li>E-maily: <strong>{process.env.RESEND_API_KEY ? "Resend" : "jen do logu serveru (nenastaveno)"}</strong></li>
        </ul>
        <p className="mt-3 text-les/50">Klíče se nastavují v proměnných prostředí hostingu – viz README.</p>
      </Card>
    </>
  );
}
