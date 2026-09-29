import type { Metadata } from "next";
import { saveReviewAction } from "@/app/actions/reviews";
import { ActionForm, SubmitButton } from "@/components/forms";
import { StarInput, Stars } from "@/components/stars";
import { ButtonLink, Card, Container, Empty, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { MAX_REVIEW, approvedReviews, myReview, reviewStats, reviewsLabel } from "@/domain/reviews";
import { getCurrentUser } from "@/lib/auth";
import { splitName } from "@/lib/client-list";
import { formatDate } from "@/lib/dates";
import { nbsp } from "@/lib/typography";

export const metadata: Metadata = {
  title: "Recenze",
  description: "Recenze a zkušenosti klientů studia OCTOPUSH v Ostravě – lekce, masáže a komunita.",
  alternates: { canonical: "/recenze" },
};

export default async function ReviewsPage() {
  const db = await getDb();
  const [c, user, list, stats] = await Promise.all([getContent(), getCurrentUser(), approvedReviews(db), reviewStats(db)]);
  const mine = user ? await myReview(db, user.id) : null;
  const { first, last } = splitName(user?.name ?? "");
  const google = c.googleReviewUrl;

  return (
    <>
      <PageHeader eyebrow={c("reviews.eyebrow")} title={c("reviews.title")}>
        {c("reviews.intro")}
      </PageHeader>
      <Container className="grid max-w-5xl gap-10 py-12 lg:grid-cols-[1fr_22rem]">
        <section className="space-y-5">
          {stats.count > 0 && (
            <p className="flex items-center gap-3 text-sm text-les/70">
              <Stars rating={stats.average ?? 0} /> <strong className="text-les">{stats.average?.toLocaleString("cs")}</strong> z 5 · {reviewsLabel(stats.count)}
            </p>
          )}
          {list.length === 0 && <Empty>Zatím tu žádné recenze nejsou. Buď první!</Empty>}
          {list.map((r) => (
            <Card key={r.id} className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Stars rating={r.rating} />
                <span className="text-xs text-les/50">
                  {formatDate(r.createdAt)}
                  {r.source === "google" && " · Google"}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-line text-les/85">{nbsp(r.body)}</p>
              <p className="mt-3 text-sm font-semibold">{r.authorName}</p>
            </Card>
          ))}
        </section>

        <aside className="space-y-4">
          <Card>
            <h2 className="font-semibold">{mine ? "Tvoje recenze" : "Napiš recenzi"}</h2>
            {user ? (
              <ActionForm action={saveReviewAction} className="mt-4 space-y-4">
                {mine?.status === "pending" && <p className="rounded-xl bg-zlato/15 px-3 py-2 text-xs">Čeká na schválení.</p>}
                {mine?.status === "approved" && <p className="rounded-xl bg-ok/10 px-3 py-2 text-xs">Je zveřejněná. Po úpravě ji znovu schválíme.</p>}
                <StarInput name="rating" defaultValue={mine?.rating ?? 0} />
                <Field label="Tvoje zkušenost">
                  <Textarea name="body" rows={5} maxLength={MAX_REVIEW} defaultValue={mine?.body} required />
                </Field>
                <Field label="Podepsat jako" hint="Takhle se jméno zobrazí u recenze.">
                  <Input name="authorName" defaultValue={mine?.authorName ?? (last ? `${first} ${last[0]}.` : first)} required />
                </Field>
                <SubmitButton className="w-full">{mine ? "Uložit změny" : "Odeslat recenzi"}</SubmitButton>
              </ActionForm>
            ) : (
              <>
                <p className="mt-2 text-sm text-les/70">Recenzi může napsat každý, kdo má u nás účet.</p>
                <ButtonLink href="/prihlaseni?next=/recenze" variant="outline" className="mt-4">Přihlásit se</ButtonLink>
              </>
            )}
          </Card>
          {google && (
            <Card className="text-sm">
              <h2 className="font-semibold">Ohodnoť nás i na Googlu</h2>
              <p className="mt-2 text-les/70">Hodnocení na Googlu nám moc pomáhá – díky němu nás najdou další lidé. Stačí pár slov a hvězdičky.</p>
              <a href={google} target="_blank" rel="noopener" className="mt-4 inline-flex rounded-full border border-les px-5 py-2.5 text-xs font-semibold uppercase tracking-wider">
                Ohodnotit na Googlu ↗
              </a>
            </Card>
          )}
        </aside>
      </Container>
    </>
  );
}
