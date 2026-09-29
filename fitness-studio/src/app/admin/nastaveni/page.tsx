import { resetOrdersAction, saveSettingsAction } from "@/app/admin/actions";
import { dateKey } from "@/lib/dates";
import { AdminTitle } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input } from "@/components/ui";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { backupNowAction, deleteBackupAction } from "@/app/admin/backup-actions";
import { KEEP_AUTO, listBackups } from "@/domain/backup";
import { formatDateTime } from "@/lib/dates";
import { paymentProvider } from "@/lib/payments";
import { getSettings, type Settings } from "@/lib/settings";

const fields: { key: keyof Settings; label: string; hint: string }[] = [
  { key: "cancellationHours", label: "Storno zdarma (hodin před lekcí)", hint: "Později vstup propadá." },
  { key: "bookingWindowWeeks", label: "Rezervace – kolik dalších týdnů (klienti)", hint: "1 = tento týden + příští. Nový týden se otevírá v pondělí o půlnoci. 0 = řídit se dny níže." },
  { key: "memberBookingWindowWeeks", label: "Rezervace – kolik dalších týdnů (členové)", hint: "2 = tento týden + další dva. Klienti s aktivním členstvím." },
  { key: "bookingWindowDays", label: "Rezervace dopředu (dní)", hint: "Platí jen když je počet týdnů 0. Používá se i pro masáže." },
  { key: "memberBookingWindowDays", label: "Rezervace dopředu pro členy (dní)", hint: "Platí jen když je počet týdnů 0." },
  { key: "bookingCutoffMinutes", label: "Uzávěrka rezervací (min před začátkem)", hint: "0 = do začátku lekce." },
  { key: "welcomeFreeEntries", label: "Vstupy zdarma pro nové klienty", hint: "0 = vypnuto." },
  { key: "welcomeFreeValidityDays", label: "Platnost úvodního vstupu (dní)", hint: "" },
  { key: "pendingPaymentMinutes", label: "Držení místa při platbě kartou (min)", hint: "Minimálně 30 (Stripe)." },
  { key: "massageBufferMinutes", label: "Masáže – pauza mezi masážemi (min)", hint: "Čas na úklid a převlečení." },
  { key: "massageStepMinutes", label: "Masáže – začátky po (min)", hint: "30 = 9:00, 9:30, 10:00…" },
  { key: "memberStrikeLimit", label: "Členové – prohřešků do pauzy", hint: "Pozdní odhlášení nebo nepříchod. Varování přijde o jeden dřív. 0 = vypnuto." },
  { key: "memberStrikeWindowDays", label: "Členové – prohřešky za posledních (dní)", hint: "" },
  { key: "memberPauseDays", label: "Členové – délka pauzy v přihlašování (dní)", hint: "" },
  { key: "membershipMonthlyFee", label: "Členský příspěvek měsíčně (Kč)", hint: "Individuální částku nastavíš u člena. 0 = automatické výzvy vypnuté." },
  { key: "membershipFeeNoticeDay", label: "Výzva k platbě za další měsíc – den v měsíci", hint: "20 = výzva za listopad odejde 20. října. 1–28." },
];

export default async function AdminSettings() {
  await requireAdmin();
  const db = await getDb();
  const [cfg, backupList] = await Promise.all([getSettings(db), listBackups(db)]);
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
        <h2 className="font-semibold">Zálohy dat</h2>
        <p className="mt-2 text-les/70">
          Každý týden se automaticky uloží kompletní záloha (klienti, permanentky, kredity, rezervace, platby, texty webu). Drží se
          posledních {KEEP_AUTO} týdenních. Aspoň jednou za měsíc si zálohu stáhni a ulož mimo web (disk, Google Drive) – obsahuje
          osobní údaje, tak ji nikam neposílej.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ActionForm action={backupNowAction}>
            <SubmitButton variant="outline">Zálohovat teď</SubmitButton>
          </ActionForm>
          <a href="/admin/zalohy/klienti" download className="inline-flex items-center rounded-full border border-les px-5 py-3 text-xs font-semibold uppercase tracking-wider">
            Klienti do Excelu (CSV)
          </a>
        </div>
        {backupList.length === 0 ? (
          <p className="mt-4 text-les/50">Zatím žádná záloha – první se udělá při nejbližším nočním běhu.</p>
        ) : (
          <ul className="mt-4 divide-y divide-linka/60">
            {backupList.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span>
                  <strong>{formatDateTime(b.createdAt)}</strong>{" "}
                  <span className="text-les/60">
                    · {b.kind === "auto" ? "týdenní" : "ruční"} · {(b.size / 1024).toLocaleString("cs", { maximumFractionDigits: 0 })} kB ·{" "}
                    {b.counts.users ?? 0} lidí, {b.counts.bookings ?? 0} rezervací
                  </span>
                </span>
                <span className="flex items-center gap-4">
                  <a href={`/admin/zalohy/${b.id}`} className="font-semibold underline">Stáhnout</a>
                  <ActionForm action={deleteBackupAction} confirm="Smazat tuto zálohu?">
                    <input type="hidden" name="id" value={b.id} />
                    <button className="text-xs text-chyba underline">Smazat</button>
                  </ActionForm>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="mt-6 max-w-3xl text-sm">
        <h2 className="font-semibold">Integrace</h2>
        <ul className="mt-3 space-y-1 text-les/70">
          <li>Platby: <strong>{provider === "stripe" ? "Kartou (Stripe) i převodem s QR kódem" : provider === "test" ? "Testovací karetní brána i převodem" : "Převodem s QR kódem (účet z Obsah webu → Masáže); karty se zapnou vyplněním STRIPE_SECRET_KEY"}</strong></li>
          <li>E-maily: <strong>{process.env.RESEND_API_KEY ? "Resend" : "jen do logu serveru (nenastaveno)"}</strong></li>
        </ul>
        <p className="mt-3 text-les/50">Klíče se nastavují v proměnných prostředí hostingu – viz README.</p>
      </Card>
    </>
  );
}
