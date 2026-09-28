import { asc, isNull } from "drizzle-orm";
import { deleteClassTypeAction, saveClassTypeAction } from "@/app/admin/actions";
import { AdminTitle, Panel } from "@/components/admin";
import { kc } from "@/components/admin-forms";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Textarea } from "@/components/ui";
import { getDb } from "@/db";
import { classTypes, type ClassType } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { ImageInput } from "@/components/image-input";

function ClassTypeForm({ t }: { t?: ClassType }) {
  return (
    <ActionForm action={saveClassTypeAction} className="space-y-4">
      {t && <input type="hidden" name="id" value={t.id} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Název"><Input name="name" defaultValue={t?.name} required /></Field>
        <Field label="URL (slug)" hint="Prázdné = z názvu"><Input name="slug" defaultValue={t?.slug} /></Field>
        <Field label="Úroveň"><Input name="level" defaultValue={t?.level ?? "Pro všechny"} /></Field>
        <Field label="Barva"><Input name="color" type="color" defaultValue={t?.color ?? "#D2A772"} className="h-12 p-1" /></Field>
        <Field label="Délka (min)"><Input name="durationMin" type="number" min={10} defaultValue={t?.durationMin ?? 60} /></Field>
        <Field label="Kapacita"><Input name="capacity" type="number" min={1} defaultValue={t?.capacity ?? 12} /></Field>
        <Field label="Cena v kreditech"><Input name="creditCost" type="number" min={0} defaultValue={t?.creditCost ?? 1} /></Field>
        <Field label="Jednorázový vstup (Kč)" hint="Prázdné = nelze koupit jednorázově"><Input name="dropInPrice" inputMode="decimal" defaultValue={kc(t?.dropInPrice)} /></Field>
        <Field label="Pořadí"><Input name="sortOrder" type="number" defaultValue={t?.sortOrder ?? 0} /></Field>
      </div>
      <fieldset className="rounded-xl border border-linka/60 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-les/70">Zvláštní ceny</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Vstupů z permanentky" hint="Kolik vstupů se strhne z permanentky (Reformer = 2)">
            <Input name="passEntries" type="number" min={1} defaultValue={t?.passEntries ?? 1} />
          </Field>
          <Field label="Doplatek pro členy (Kč / lekce)" hint="Prázdné = členové bez doplatku">
            <Input name="memberSurcharge" inputMode="decimal" defaultValue={kc(t?.memberSurcharge)} />
          </Field>
          <Field label="Doplatek platí od" hint="Prázdné = hned">
            <Input name="memberSurchargeFrom" type="date" defaultValue={t?.memberSurchargeFrom ?? ""} />
          </Field>
          <Field label="Cena první lekce (Kč)" hint="Pro klienta, který na téhle lekci ještě nebyl">
            <Input name="firstVisitPrice" inputMode="decimal" defaultValue={kc(t?.firstVisitPrice)} />
          </Field>
          <Field label="Jednorázově pro dva (Kč)" hint="Klient + kamarádka. Prázdné = 2× jednorázová cena">
            <Input name="duoPrice" inputMode="decimal" defaultValue={kc(t?.duoPrice)} />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="noFreeEntry" defaultChecked={t?.noFreeEntry ?? false} /> Úvodní vstup zdarma na tuhle lekci nejde použít
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" name="noPass" defaultChecked={t?.noPass ?? false} /> Permanentka na tuhle lekci neplatí
        </label>
      </fieldset>
      <Field label="Popis"><Textarea name="description" rows={3} defaultValue={t?.description} /></Field>
      <div className="flex flex-wrap items-center gap-4">
        {t?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.imageUrl} alt="" className="h-20 w-32 rounded-lg object-cover" />
        )}
        <Field label="Fotka lekce (na stránce Lekce)">
          <ImageInput name="image" />
        </Field>
        {t?.imageUrl && <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="removeImage" /> Odebrat fotku</label>}
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={t?.isActive ?? true} /> Aktivní (zobrazit na webu)</label>
      <SubmitButton>Uložit</SubmitButton>
    </ActionForm>
  );
}

export default async function AdminClassTypes() {
  await requireAdmin();
  const list = await (await getDb()).select().from(classTypes).where(isNull(classTypes.archivedAt)).orderBy(asc(classTypes.sortOrder));
  return (
    <>
      <AdminTitle title="Typy lekcí" />
      <div className="space-y-3">
        <Panel title="+ Nový typ lekce"><ClassTypeForm /></Panel>
        {list.map((t) => (
          <Panel key={t.id} title={`${t.name}${t.isActive ? "" : " · neaktivní"}`}>
            <ClassTypeForm t={t} />
            <ActionForm
              action={deleteClassTypeAction}
              confirm={`Opravdu smazat typ lekce „${t.name}“? Zmizí z webu i z rozvrhu (nerezervované termíny se smažou).`}
              className="mt-4 border-t border-linka/60 pt-4"
            >
              <input type="hidden" name="id" value={t.id} />
              <button className="text-xs font-semibold text-chyba underline">Smazat typ lekce</button>
            </ActionForm>
          </Panel>
        ))}
      </div>
    </>
  );
}
