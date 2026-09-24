import { desc } from "drizzle-orm";
import { deleteAnnouncementAction, saveAnnouncementAction } from "@/app/admin/actions";
import { AdminTitle, Panel } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Textarea } from "@/components/ui";
import { getDb } from "@/db";
import { announcements, type Announcement } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";

function AnnouncementForm({ a }: { a?: Announcement }) {
  return (
    <ActionForm action={saveAnnouncementAction} className="space-y-4" resetOnSuccess={!a}>
      {a && <input type="hidden" name="id" value={a.id} />}
      <Field label="Nadpis"><Input name="title" defaultValue={a?.title} required /></Field>
      <Field label="Text"><Textarea name="body" rows={4} defaultValue={a?.body} required /></Field>
      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="isPinned" defaultChecked={a?.isPinned ?? false} /> Připnout nahoru</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isPublished" defaultChecked={a?.isPublished ?? true} /> Zveřejnit</label>
      </div>
      <SubmitButton>Uložit</SubmitButton>
    </ActionForm>
  );
}

export default async function AdminNews() {
  await requireAdmin();
  const list = await (await getDb()).select().from(announcements).orderBy(desc(announcements.createdAt));
  return (
    <>
      <AdminTitle title="Aktuality" />
      <p className="-mt-4 mb-6 text-sm text-les/60">Zobrazují se na úvodní stránce (3 nejnovější, připnuté první).</p>
      <div className="space-y-3">
        <Panel title="+ Nová aktualita" open><AnnouncementForm /></Panel>
        {list.map((a) => (
          <Panel key={a.id} title={`${formatDate(a.createdAt)} · ${a.title}${a.isPublished ? "" : " · skryto"}`}>
            <AnnouncementForm a={a} />
            <ActionForm action={deleteAnnouncementAction} confirm="Smazat aktualitu?" className="mt-3">
              <input type="hidden" name="id" value={a.id} />
              <button className="text-xs font-semibold text-chyba underline">Smazat</button>
            </ActionForm>
          </Panel>
        ))}
      </div>
    </>
  );
}
