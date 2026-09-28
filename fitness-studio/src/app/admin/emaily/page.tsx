import { saveEmailAction, sendEmailSampleAction } from "@/app/admin/email-actions";
import { AdminTitle } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Field, Input, Textarea } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { COMMON_VARS, EMAILS, emailKey, renderEmail, sampleVars, savedEmailTexts, type EmailDef, type EmailId } from "@/lib/email-templates";

export default async function EmailsPage() {
  await requireAdmin();
  const saved = await savedEmailTexts();
  const ids = Object.keys(EMAILS) as EmailId[];
  const previews = await Promise.all(ids.map((id) => renderEmail(id, sampleVars(id), saved)));

  return (
    <>
      <AdminTitle title="Automatické e-maily" />
      <p className="-mt-4 mb-8 max-w-3xl text-sm text-les/60">
        E-maily, které web posílá sám (registrace, rezervace, připomínky…). Uprav předmět i text – změna platí hned pro další odeslané e-maily.
        Slova ve dvojitých složených závorkách, např. <code>{"{{osloveni}}"}</code>, se při odeslání nahradí skutečnými údaji. Hromadné zprávy píšeš v sekci Zprávy.
      </p>
      <div className="space-y-6">
        {ids.map((id, i) => {
          const def: EmailDef = EMAILS[id];
          const subject = saved.get(emailKey(id, "subject")) ?? def.subject;
          const body = saved.get(emailKey(id, "body")) ?? def.body;
          const edited = saved.has(emailKey(id, "subject")) || saved.has(emailKey(id, "body"));
          const vars = { ...Object.fromEntries(Object.entries(def.vars).map(([k, v]) => [k, v.label])), ...COMMON_VARS };
          return (
            <details key={id} id={id} className="group rounded-2xl border border-linka bg-white/60">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-5">
                <span>
                  <span className="block font-semibold">{def.title}</span>
                  <span className="text-sm text-les/60">{def.when}</span>
                </span>
                {edited ? <Badge tone="gold">Upraveno</Badge> : <Badge>Původní text</Badge>}
              </summary>
              <div className="grid gap-6 border-t border-linka p-5 xl:grid-cols-2">
                <div>
                  <ActionForm action={saveEmailAction} className="space-y-4">
                    <input type="hidden" name="id" value={id} />
                    {id !== "signature" && (
                      <Field label="Předmět"><Input name="subject" defaultValue={subject} required /></Field>
                    )}
                    <Field label={id === "signature" ? "Podpis" : "Text e-mailu"}>
                      <Textarea name="body" rows={Math.min(14, body.split("\n").length + 3)} defaultValue={body} />
                    </Field>
                    <p className="text-xs text-les/60">
                      Můžeš použít:{" "}
                      {Object.entries(vars).map(([k, label]) => (
                        <span key={k} className="mr-2 inline-block"><code>{`{{${k}}}`}</code> {label}</span>
                      ))}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <SubmitButton name="do" value="save">Uložit</SubmitButton>
                      {edited && <SubmitButton name="do" value="reset" variant="ghost">Vrátit původní text</SubmitButton>}
                    </div>
                  </ActionForm>
                </div>
                <div>
                  <p className="eyebrow mb-2 text-les/60">Náhled s ukázkovými údaji</p>
                  <Card className="bg-papir p-5 text-sm">
                    {id !== "signature" && <p className="mb-3 font-semibold">{previews[i].subject}</p>}
                    <p className="whitespace-pre-line text-les/80">{previews[i].text}</p>
                  </Card>
                  {id !== "signature" && (
                    <ActionForm action={sendEmailSampleAction} className="mt-3">
                      <input type="hidden" name="id" value={id} />
                      <SubmitButton variant="outline" className="px-4 py-2 text-[0.7rem]">Poslat si ukázku na svůj e-mail</SubmitButton>
                    </ActionForm>
                  )}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}
