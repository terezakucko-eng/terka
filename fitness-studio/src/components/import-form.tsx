"use client";

import { useActionState } from "react";
import { importAction, type ImportState } from "@/app/admin/messaging-actions";
import { formatPhone } from "@/lib/phone";
import { Button, Card } from "./ui";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importAction, undefined);
  return (
    <div className="space-y-6">
      <Card>
        <form action={action} className="space-y-4">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-les file:px-5 file:py-2.5 file:text-xs file:font-semibold file:uppercase file:tracking-widest file:text-papir"
          />
          <label className="flex gap-3 text-sm">
            <input type="checkbox" name="consent" className="mt-1" />
            <span>
              Převzít souhlas s newsletterem ze sloupce „Newsletter/Souhlas“.
              <span className="block text-xs text-les/60">Zaškrtni jen pokud máš souhlasy klientů doložitelné (GDPR). Bez toho se newsletter pošle až těm, kdo souhlas dají v novém systému.</span>
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" name="mode" value="preview" variant="outline" disabled={pending}>
              {pending ? "Načítám…" : "1 · Náhled"}
            </Button>
            <Button type="submit" name="mode" value="import" disabled={pending || !state?.dryRun}>
              2 · Importovat
            </Button>
          </div>
          <p className="text-xs text-les/50">Po náhledu vyber stejný soubor znovu a klikni na Importovat. Import lze bezpečně spustit opakovaně – existující e-maily se jen doplní, kredit ani permanentky se nezdvojí.</p>
        </form>
        {state?.error && <p className="mt-4 rounded-xl bg-chyba/10 px-4 py-2.5 text-sm text-chyba">{state.error}</p>}
      </Card>

      {state?.result && (
        <Card className="border-ok/40 bg-salvej/10">
          <h2 className="font-semibold">Hotovo</h2>
          <p className="mt-2 text-sm">
            Nových klientů: <strong>{state.result.created}</strong> · doplněno existujících: <strong>{state.result.updated}</strong> ·
            převedeno kreditů: <strong>{state.result.credits}</strong> · permanentek: <strong>{state.result.passes}</strong>
          </p>
          {state.result.skipped.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-chyba">Přeskočeno řádků: {state.result.skipped.length}</summary>
              <ul className="mt-2 space-y-1 text-xs text-les/70">
                {state.result.skipped.map((s) => <li key={s.line}>řádek {s.line}: {s.reason}</li>)}
              </ul>
            </details>
          )}
        </Card>
      )}

      {state?.preview && (
        <Card>
          <h2 className="font-semibold">Náhled ({state.total} řádků{state.invalid ? `, ${state.invalid} bez platného e-mailu` : ""})</h2>
          <p className="mt-2 text-xs text-les/60">
            Rozpoznané sloupce: {Object.entries(state.mapped ?? {}).map(([k, v]) => `${k} ← „${v}“`).join(" · ")}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-les/60">
                <tr><th className="py-2 pr-4">Řádek</th><th className="pr-4">Jméno</th><th className="pr-4">E-mail</th><th className="pr-4">Telefon</th><th className="pr-4">Kredit</th><th className="pr-4">Vstupy</th><th className="pr-4">Newsletter</th><th>Pozn.</th></tr>
              </thead>
              <tbody className="divide-y divide-linka/50">
                {state.preview.map((r) => (
                  <tr key={r.line} className={r.email ? "" : "text-chyba"}>
                    <td className="py-2 pr-4">{r.line}</td>
                    <td className="pr-4">{r.name}</td>
                    <td className="pr-4">{r.email ?? "—"}</td>
                    <td className="pr-4 whitespace-nowrap">{r.phone ? formatPhone(r.phone) : "—"}</td>
                    <td className="pr-4">{r.credits || ""}</td>
                    <td className="pr-4">{r.entries || ""}{r.validUntil && r.entries ? ` do ${r.validUntil.toLocaleDateString("cs-CZ")}` : ""}</td>
                    <td className="pr-4">{r.newsletter ? "ano" : ""}</td>
                    <td className="text-xs">{r.problem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
