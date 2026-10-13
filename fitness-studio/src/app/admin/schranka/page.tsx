import Link from "next/link";
import { publishWishAction, replyWishAction, resolveWishAction } from "@/app/admin/wish-actions";
import { AdminTitle } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Empty, Textarea } from "@/components/ui";
import { getDb } from "@/db";
import { MAX_REPLY, WISH_KINDS, adminWishes, markWishesRead } from "@/domain/wishes";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";

/** Admin → 💌 Schránka přání a nápadů. Opening it marks new messages as read. */
export default async function AdminWishesPage({ searchParams }: PageProps<"/admin/schranka">) {
  await requireAdmin();
  const { vse } = await searchParams;
  const db = await getDb();
  const all = await adminWishes(db);
  if (all.some((w) => w.status === "new")) await markWishesRead(db);
  const list = vse ? all : all.filter((w) => w.status !== "resolved");
  const resolved = all.length - all.filter((w) => w.status !== "resolved").length;

  return (
    <>
      <AdminTitle title="💌 Schránka přání a nápadů">
        <Link href="/schranka" className="text-sm underline underline-offset-4">Veřejná stránka →</Link>
      </AdminTitle>
      <p className="-mt-4 mb-6 max-w-3xl text-sm text-les/60">
        Vzkazy klientů. Odpověď dostane klient e-mailem a uvidí ji v účtu. Na web jde jen vzkaz, u kterého to klient dovolil – a až ho
        zveřejníš. U anonymních vzkazů nevidíš, kdo je napsal.
      </p>
      <p className="mb-4 text-sm">
        {vse ? (
          <Link href="/admin/schranka" className="underline underline-offset-4">Jen otevřené</Link>
        ) : (
          resolved > 0 && <Link href="/admin/schranka?vse=1" className="underline underline-offset-4">Zobrazit i vyřešené ({resolved})</Link>
        )}
      </p>
      <div className="space-y-4">
        {list.length === 0 && <Empty>Žádné otevřené vzkazy. 🎉</Empty>}
        {list.map((w) => (
          <Card key={w.id}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{WISH_KINDS[w.kind].emoji} {WISH_KINDS[w.kind].label}</span>
              <span className="text-les/50">· {formatDateTime(w.createdAt)} ·</span>
              {w.author ? (
                <Link href={`/admin/klienti/${w.author.id}`} className="underline underline-offset-4">{w.author.name}</Link>
              ) : (
                <span className="text-les/60">anonymně</span>
              )}
              <span className="ml-auto flex flex-wrap gap-1.5">
                {w.status === "new" && <Badge tone="red">Nové</Badge>}
                {w.published ? <Badge tone="green">Na webu</Badge> : w.allowPublic ? <Badge tone="gold">Smí na web</Badge> : <Badge>Jen pro studio</Badge>}
                {w.status === "resolved" && <Badge tone="green">Vyřešeno</Badge>}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-line">{w.body}</p>
            {w.allowPublic && (
              <p className="mt-1 text-xs text-les/50">Na webu by byl podepsaný: {w.signature ?? "anonymně"}</p>
            )}

            <ActionForm action={replyWishAction} className="mt-4 space-y-2" resetOnSuccess={false}>
              <input type="hidden" name="id" value={w.id} />
              <Textarea name="reply" rows={3} maxLength={MAX_REPLY} defaultValue={w.reply ?? ""} placeholder="Tvoje odpověď…" required />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-les/50">{w.repliedAt ? `Odpovězeno ${formatDate(w.repliedAt)} – upravená odpověď se pošle znovu.` : "Klient dostane odpověď e-mailem."}</span>
                <SubmitButton className="px-4 py-2 text-[0.65rem]">{w.reply ? "Upravit odpověď" : "Odeslat odpověď"}</SubmitButton>
              </div>
            </ActionForm>

            <div className="mt-3 flex flex-wrap gap-2 border-t border-linka pt-3">
              <ActionForm action={resolveWishAction}>
                <input type="hidden" name="id" value={w.id} />
                <input type="hidden" name="resolved" value={w.status === "resolved" ? "false" : "true"} />
                <SubmitButton variant="outline" className="px-3 py-2 text-[0.65rem]">
                  {w.status === "resolved" ? "Znovu otevřít" : "Vyřešeno ✓"}
                </SubmitButton>
              </ActionForm>
              {w.allowPublic && (
                <ActionForm action={publishWishAction}>
                  <input type="hidden" name="id" value={w.id} />
                  <input type="hidden" name="on" value={w.published ? "false" : "true"} />
                  <SubmitButton variant={w.published ? "ghost" : "outline"} className="px-3 py-2 text-[0.65rem]">
                    {w.published ? "Skrýt z webu" : "Zveřejnit na webu"}
                  </SubmitButton>
                </ActionForm>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
