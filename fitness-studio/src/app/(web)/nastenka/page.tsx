import type { Metadata } from "next";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { addCommentAction, deleteCommentAction } from "@/app/actions/board";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, Container, Empty, PageHeader, Textarea } from "@/components/ui";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { announcementComments, announcements, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Nástěnka" };

/** News from the studio with clients' reactions. */
export default async function BoardPage() {
  const db = await getDb();
  const [user, c] = await Promise.all([getCurrentUser(), getContent()]);
  const posts = await db
    .select()
    .from(announcements)
    .where(eq(announcements.isPublished, true))
    .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
    .limit(30);
  const comments = posts.length
    ? await db
        .select({ c: announcementComments, name: users.name })
        .from(announcementComments)
        .innerJoin(users, eq(announcementComments.userId, users.id))
        .where(inArray(announcementComments.announcementId, posts.map((p) => p.id)))
        .orderBy(asc(announcementComments.createdAt))
    : [];

  return (
    <>
      <PageHeader eyebrow={c("board.eyebrow")} title={c("board.title")}>
        {c("board.intro")}
      </PageHeader>
      <Container className="max-w-3xl space-y-10 py-12">
        {posts.length === 0 && <Empty>Zatím tu nic není.</Empty>}
        {posts.map((p) => {
          const list = comments.filter((x) => x.c.announcementId === p.id);
          return (
            <article key={p.id} className="rounded-2xl border border-linka/60 bg-white/60 p-6">
              <p className="eyebrow flex items-center gap-2 text-les/50">
                {formatDate(p.createdAt)} {p.isPinned && <Badge tone="gold">Připnuto</Badge>}
              </p>
              <h2 className="mt-2 text-2xl font-semibold">{p.title}</h2>
              <p className="mt-3 whitespace-pre-line text-les/80">{p.body}</p>

              <div className="mt-6 space-y-3 border-t border-linka/60 pt-4">
                {list.map(({ c: r, name }) => (
                  <div key={r.id} className="rounded-xl bg-krem/50 px-4 py-3 text-sm">
                    <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-les/60">
                      <span><strong className="text-les">{name.split(" ")[0]}</strong> · {formatDateTime(r.createdAt)}</span>
                      {user && (user.id === r.userId || user.role !== "client") && (
                        <ActionForm action={deleteCommentAction} confirm="Smazat reakci?">
                          <input type="hidden" name="id" value={r.id} />
                          <button className="underline">Smazat</button>
                        </ActionForm>
                      )}
                    </p>
                    <p className="mt-1 whitespace-pre-line">{r.body}</p>
                  </div>
                ))}
                {user ? (
                  <ActionForm action={addCommentAction} className="space-y-2" resetOnSuccess>
                    <input type="hidden" name="announcementId" value={p.id} />
                    <Textarea name="body" rows={2} maxLength={1000} placeholder="Napiš reakci…" aria-label="Reakce" required />
                    <SubmitButton variant="outline" className="px-4 py-2 text-[0.7rem]">Přidat reakci</SubmitButton>
                  </ActionForm>
                ) : (
                  <ButtonLink href="/prihlaseni?next=/nastenka" variant="outline" className="text-[0.7rem]">
                    Přihlas se a napiš reakci
                  </ButtonLink>
                )}
              </div>
            </article>
          );
        })}
      </Container>
    </>
  );
}
