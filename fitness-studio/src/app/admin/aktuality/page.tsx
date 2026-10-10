import { countDistinct, desc } from "drizzle-orm";
import { deleteAnnouncementAction, saveAnnouncementAction } from "@/app/admin/actions";
import { AdminTitle, Panel } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input } from "@/components/ui";
import { RichEditor } from "@/components/rich-editor";
import { toSafeHtml } from "@/lib/rich-html";
import { getDb } from "@/db";
import { announcements, pushSubscriptions, type Announcement } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { site } from "@/config/site";
import { StoryShare } from "@/components/story-share";

function AnnouncementForm({ a, subscribers }: { a?: Announcement; subscribers: number }) {
  return (
    <ActionForm action={saveAnnouncementAction} className="space-y-4" resetOnSuccess={!a}>
      {a && <input type="hidden" name="id" value={a.id} />}
      <Field label="Nadpis"><Input name="title" defaultValue={a?.title} required /></Field>
      <Field label="Text"><RichEditor name="body" defaultValue={toSafeHtml(a?.body ?? "")} minHeight={180} /></Field>
      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="isPinned" defaultChecked={a?.isPinned ?? false} /> Připnout nahoru</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isPublished" defaultChecked={a?.isPublished ?? true} /> Zveřejnit</label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="notify" defaultChecked={!a} className="mt-1" />
        <span>
          Poslat push upozornění do mobilu
          <span className="block text-xs text-les/60">
            {subscribers ? `Počet lidí se zapnutým upozorněním: ${subscribers}. Po klepnutí se jim otevře tahle aktualita.` : "Zatím si upozornění nikdo nezapnul."}
          </span>
        </span>
      </label>
      <SubmitButton>Uložit</SubmitButton>
    </ActionForm>
  );
}

export default async function AdminNews() {
  await requireAdmin();
  const db = await getDb();
  const [list, [{ n: subscribers }]] = await Promise.all([
    db.select().from(announcements).orderBy(desc(announcements.createdAt)),
    db.select({ n: countDistinct(pushSubscriptions.userId) }).from(pushSubscriptions),
  ]);
  return (
    <>
      <AdminTitle title="Aktuality" />
      <p className="-mt-4 mb-6 text-sm text-les/60">Zobrazují se na úvodní stránce (3 nejnovější, připnuté první).</p>
      <div className="space-y-3">
        <Panel title="+ Nová aktualita" open><AnnouncementForm subscribers={subscribers} /></Panel>
        {list.map((a) => (
          <Panel key={a.id} title={`${formatDate(a.createdAt)} · ${a.title}${a.isPublished ? "" : " · skryto"}`}>
            {a.isPublished && (
              <div className="mb-6">
                <StoryShare id={a.id} title={a.title} url={`${site.url}/nastenka#${a.id}`} />
              </div>
            )}
            <AnnouncementForm a={a} subscribers={subscribers} />
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
