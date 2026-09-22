import { count, eq } from "drizzle-orm";
import { inviteImportedAction } from "@/app/admin/messaging-actions";
import { AdminTitle } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ImportForm } from "@/components/import-form";
import { Card } from "@/components/ui";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { IMPORTED_PASSWORD } from "@/domain/import";
import { requireAdmin } from "@/lib/auth";

export default async function ImportPage() {
  await requireAdmin();
  const [{ n: waiting }] = await (await getDb())
    .select({ n: count() })
    .from(users)
    .where(eq(users.passwordHash, IMPORTED_PASSWORD));

  return (
    <>
      <AdminTitle title="Převod klientů ze starého systému" />
      <div className="grid gap-8 xl:grid-cols-[1.6fr_1fr]">
        <ImportForm />
        <aside className="space-y-4 text-sm">
          <Card>
            <h2 className="font-semibold">Jak na to</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-les/80">
              <li>Ve starém systému vyexportuj klienty (Excel/CSV).</li>
              <li>Excel: <em>Soubor → Uložit jako → CSV (oddělený středníkem)</em>.</li>
              <li>Potřebný je sloupec <strong>E-mail</strong>. Rozpoznám i: Jméno, Příjmení, Telefon, Kredit, Zbývající vstupy, Platnost do, Newsletter/Souhlas, Poznámka.</li>
              <li>Nejdřív náhled, pak import.</li>
              <li>Pošli klientům pozvánku – nastaví si heslo a vše mají na účtu.</li>
            </ol>
          </Card>
          <Card className="border-zlato">
            <h2 className="font-semibold">Pozvánka do nového systému</h2>
            <p className="mt-2 text-les/70">Převedených účtů bez nastaveného hesla: <strong>{waiting}</strong>. Každý dostane e-mail s odkazem na nastavení hesla (platí 14 dní).</p>
            <ActionForm action={inviteImportedAction} className="mt-4" confirm="Odeslat pozvánky převedeným klientům?">
              <SubmitButton variant="gold" className="w-full" disabled={!waiting}>Poslat pozvánky</SubmitButton>
            </ActionForm>
          </Card>
        </aside>
      </div>
    </>
  );
}
