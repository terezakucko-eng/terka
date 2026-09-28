import type { Metadata } from "next";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { addCommentAction, deleteCommentAction, toggleReactionAction } from "@/app/actions/board";
import { CommentBox, EditableComment } from "@/components/board";
import { REACTIONS } from "@/lib/board";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, Container, Empty, PageHeader, cx } from "@/components/ui";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { announcementComments, announcementReactions, announcements, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { nbsp } from "@/lib/typography";
import { RichText } from "@/components/rich-text";
import { Avatar } from "@/components/avatar";
import { displayName } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Nástěnka",
  description: "Novinky ze studia OCTOPUSH v Ostravě: změny v rozvrhu, akce, workshopy a reakce klientů.",
  alternates: { canonical: "/nastenka" },
};

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
        .select({ c: announcementComments, author: { name: users.name, nickname: users.nickname, avatar: users.avatar } })
        .from(announcementComments)
        .innerJoin(users, eq(announcementComments.userId, users.id))
        .where(inArray(announcementComments.announcementId, posts.map((p) => p.id)))
        .orderBy(asc(announcementComments.createdAt))
    : [];
  const reactions = posts.length
    ? await db
        .select({ announcementId: announcementReactions.announcementId, userId: announcementReactions.userId, emoji: announcementReactions.emoji })
        .from(announcementReactions)
        .where(inArray(announcementReactions.announcementId, posts.map((p) => p.id)))
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
            <article key={p.id} id={p.id} className="scroll-mt-24 rounded-2xl border border-linka/60 bg-white/60 p-6">
              <p className="eyebrow flex items-center gap-2 text-les/50">
                {formatDate(p.createdAt)} {p.isPinned && <Badge tone="gold">Připnuto</Badge>}
              </p>
              <h2 className="mt-2 text-2xl font-semibold">{nbsp(p.title)}</h2>
              <RichText text={p.body} className="mt-3 text-les/80" />

              <div className="mt-5 flex flex-wrap gap-1.5">
                {REACTIONS.map((e) => {
                  const who = reactions.filter((r) => r.announcementId === p.id && r.emoji === e);
                  const mine = !!user && who.some((r) => r.userId === user.id);
                  const chip = cx(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition",
                    mine ? "border-zlato bg-zlato/20" : "border-linka/60 bg-white/60",
                    !who.length && "opacity-60",
                  );
                  if (!user)
                    return who.length ? (
                      <span key={e} className={chip}>{e} <span className="text-xs text-les/70">{who.length}</span></span>
                    ) : null;
                  return (
                    <ActionForm key={e} action={toggleReactionAction}>
                      <input type="hidden" name="announcementId" value={p.id} />
                      <input type="hidden" name="emoji" value={e} />
                      <button className={cx(chip, "hover:border-zlato hover:opacity-100")} aria-pressed={mine} aria-label={`Reagovat ${e}`}>
                        {e} {who.length > 0 && <span className="text-xs text-les/70">{who.length}</span>}
                      </button>
                    </ActionForm>
                  );
                })}
              </div>

              <div className="mt-6 space-y-3 border-t border-linka/60 pt-4">
                {list.map(({ c: r, author }) => (
                  <div key={r.id} className="rounded-xl bg-krem/50 px-4 py-3 text-sm">
                    <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-les/60">
                      <span className="flex items-center gap-2">
                        <Avatar user={author} size={28} />
                        <span><strong className="text-les">{displayName(author)}</strong> · {formatDateTime(r.createdAt)}</span>
                      </span>
                      {user && (user.id === r.userId || user.role !== "client") && (
                        <ActionForm action={deleteCommentAction} confirm="Smazat reakci?">
                          <input type="hidden" name="id" value={r.id} />
                          <button className="underline">Smazat</button>
                        </ActionForm>
                      )}
                    </p>
                    <EditableComment id={r.id} body={r.body} edited={!!r.editedAt} canEdit={!!user && (user.id === r.userId || user.role === "admin")} />
                  </div>
                ))}
                {user ? (
                  <ActionForm action={addCommentAction} className="space-y-2" resetOnSuccess>
                    <input type="hidden" name="announcementId" value={p.id} />
                    <CommentBox />
                    <SubmitButton variant="outline" className="px-4 py-2 text-[0.7rem]">Přidat reakci</SubmitButton>
                  </ActionForm>
                ) : (
                  <ButtonLink href="/prihlaseni?next=/nastenka" variant="outline" className="text-[0.7rem]">
                    Přihlas se a napiš reakci
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
