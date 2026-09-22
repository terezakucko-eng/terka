import Link from "next/link";
import { notFound } from "next/navigation";
import { saveContentAction } from "@/app/admin/content-actions";
import { AdminTitle } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Card, Field, Input, Textarea } from "@/components/ui";
import { sectionValues } from "@/content";
import { SECTIONS, type SectionDef } from "@/content/definitions";
import { requireAdmin } from "@/lib/auth";

export default async function EditSection({ params }: PageProps<"/admin/obsah/[section]">) {
  await requireAdmin();
  const { section: id } = await params;
  const section = (SECTIONS as Record<string, SectionDef>)[id];
  if (!section) notFound();
  const values = await sectionValues(id);
  const hasPlaceholders = Object.values(section.fields).some((f) => f.type !== "image");

  return (
    <>
      <Link href="/admin/obsah" className="eyebrow text-les/60 hover:text-les">← Obsah webu</Link>
      <AdminTitle title={section.title}>
        {section.page !== "*" && (
          <Link href={section.page} target="_blank" className="text-sm font-semibold text-zeme underline underline-offset-4">Zobrazit na webu ↗</Link>
        )}
      </AdminTitle>
      <Card className="max-w-3xl">
        <ActionForm action={saveContentAction} className="space-y-6">
          <input type="hidden" name="section" value={id} />
          {Object.entries(section.fields).map(([name, def]) =>
            def.type === "image" ? (
              <fieldset key={name} className="rounded-xl border border-linka/60 p-4">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-les/70">{def.label}</legend>
                <div className="flex flex-col gap-4 sm:flex-row">
                  {values[name] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={values[name]} alt="" className="h-32 w-48 shrink-0 rounded-lg object-cover" />
                  )}
                  <div className="flex-1 space-y-3">
                    <input
                      type="file"
                      name={`file_${name}`}
                      accept="image/*"
                      className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-les file:px-4 file:py-2 file:text-xs file:font-semibold file:text-papir"
                    />
                    <p className="text-xs text-les/50">JPG/PNG z mobilu i foťáku – web ji sám zmenší. Fotka se ořízne podle rámečku na stránce, hlavní motiv dej doprostřed.</p>
                    <Field label="…nebo odkaz na obrázek">
                      <Input name={`f_${name}`} defaultValue={values[name]} />
                    </Field>
                    {values[name] !== def.default && (
                      <label className="flex items-center gap-2 text-xs text-les/70">
                        <input type="checkbox" name={`reset_${name}`} /> Vrátit původní fotku
                      </label>
                    )}
                  </div>
                </div>
              </fieldset>
            ) : (
              <Field key={name} label={def.label} hint={def.hint}>
                {def.type === "text" || def.type === "url" ? (
                  <Input name={`f_${name}`} type={def.type === "url" ? "url" : "text"} defaultValue={values[name]} />
                ) : (
                  <Textarea
                    name={`f_${name}`}
                    defaultValue={values[name]}
                    rows={def.type === "richtext" ? 22 : 3}
                    className={def.type === "richtext" ? "font-mono text-[13px] leading-relaxed" : undefined}
                  />
                )}
              </Field>
            ),
          )}
          {hasPlaceholders && (
            <p className="rounded-xl bg-krem/50 p-3 text-xs text-les/70">
              Do textu můžeš vložit hodnoty, které se doplní samy: <code>{"{{storno_hodin}}"}</code>, <code>{"{{rezervace_dni}}"}</code>,{" "}
              <code>{"{{platba_minut}}"}</code>, <code>{"{{vstupy_zdarma}}"}</code>, <code>{"{{platnost_zdarma}}"}</code>, <code>{"{{firma}}"}</code>,{" "}
              <code>{"{{ico}}"}</code>, <code>{"{{adresa}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{telefon}}"}</code>. Smazáním textu a uložením se vrátí původní znění.
            </p>
          )}
          {(id === "terms" || id === "privacy") && (
            <p className="rounded-xl bg-zlato/20 p-3 text-xs text-zeme">Výchozí znění je vzor – před spuštěním ho nech zkontrolovat právníkem.</p>
          )}
          <div className="sticky bottom-0 -mx-5 border-t border-linka/60 bg-papir/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:px-6">
            <SubmitButton variant="gold">Uložit změny</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
