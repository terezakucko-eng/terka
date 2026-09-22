import { saveSettingsAction } from "@/app/admin/actions";
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
