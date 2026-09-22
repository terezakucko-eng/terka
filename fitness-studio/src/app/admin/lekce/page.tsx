import { asc } from "drizzle-orm";
import { saveClassTypeAction } from "@/app/admin/actions";
import { AdminTitle, Panel } from "@/components/admin";
import { kc } from "@/components/admin-forms";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Textarea } from "@/components/ui";
import { getDb } from "@/db";
import { classTypes, type ClassType } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

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
      <Field label="Popis"><Textarea name="description" rows={3} defaultValue={t?.description} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={t?.isActive ?? true} /> Aktivní (zobrazit na webu)</label>
      <SubmitButton>Uložit</SubmitButton>
    </ActionForm>
  );
}

export default async function AdminClassTypes() {
  await requireAdmin();
  const list = await (await getDb()).select().from(classTypes).orderBy(asc(classTypes.sortOrder));
  return (
    <>
      <AdminTitle title="Typy lekcí" />
      <div className="space-y-3">
        <Panel title="+ Nový typ lekce"><ClassTypeForm /></Panel>
        {list.map((t) => (
          <Panel key={t.id} title={`${t.name}${t.isActive ? "" : " · neaktivní"}`}><ClassTypeForm t={t} /></Panel>
        ))}
      </div>
    </>
  );
}
