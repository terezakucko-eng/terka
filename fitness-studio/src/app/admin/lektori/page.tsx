import { asc } from "drizzle-orm";
import { saveInstructorAction } from "@/app/admin/actions";
import { AdminTitle, Panel } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Textarea } from "@/components/ui";
import { getDb } from "@/db";
import { instructors, type Instructor } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

function InstructorForm({ i }: { i?: Instructor }) {
  return (
    <ActionForm action={saveInstructorAction} className="space-y-4">
      {i && <input type="hidden" name="id" value={i.id} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Jméno"><Input name="name" defaultValue={i?.name} required /></Field>
        <Field label="Zaměření"><Input name="specialties" defaultValue={i?.specialties} placeholder="Pilates · Mobilita" /></Field>
        <Field label="URL fotky" hint="Odkaz na obrázek (https://…)"><Input name="photoUrl" type="url" defaultValue={i?.photoUrl ?? ""} /></Field>
        <Field label="Pořadí"><Input name="sortOrder" type="number" defaultValue={i?.sortOrder ?? 0} /></Field>
      </div>
      <Field label="Medailonek"><Textarea name="bio" rows={3} defaultValue={i?.bio} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={i?.isActive ?? true} /> Zobrazit na webu</label>
      <SubmitButton>Uložit</SubmitButton>
    </ActionForm>
  );
}

export default async function AdminInstructors() {
  await requireAdmin();
  const list = await (await getDb()).select().from(instructors).orderBy(asc(instructors.sortOrder));
  return (
    <>
      <AdminTitle title="Lektoři" />
      <p className="-mt-4 mb-6 text-sm text-les/60">Aby lektor viděl docházku v administraci, nastav jeho účtu roli „Lektor“ v detailu klienta.</p>
      <div className="space-y-3">
        <Panel title="+ Nový lektor"><InstructorForm /></Panel>
        {list.map((i) => <Panel key={i.id} title={i.name}><InstructorForm i={i} /></Panel>)}
      </div>
    </>
  );
}
