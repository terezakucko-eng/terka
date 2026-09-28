import { desc, sql } from "drizzle-orm";
import { reviewStatusAction, saveReviewAdminAction } from "@/app/admin/review-actions";
import { AdminTitle, Panel } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { StarInput, Stars } from "@/components/stars";
import { Badge, Field, Input, Select, Textarea } from "@/components/ui";
import { getDb } from "@/db";
import { reviews, type Review } from "@/db/schema";
import { MAX_REVIEW } from "@/domain/reviews";
import { requireAdmin } from "@/lib/auth";
import { dateKey, formatDate } from "@/lib/dates";

const statusLabel = { pending: "Čeká na schválení", approved: "Na webu", hidden: "Skryto" } as const;
const statusTone = { pending: "gold", approved: "green", hidden: "red" } as const;
const sourceLabel = { web: "z webu", google: "z Googlu", manual: "vložená ručně" } as const;

function ReviewForm({ r }: { r?: Review }) {
  return (
    <ActionForm action={saveReviewAdminAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess={!r}>
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="sm:col-span-2">
        <StarInput name="rating" defaultValue={r?.rating ?? 5} />
      </div>
      <div className="sm:col-span-2">
        <Field label="Text"><Textarea name="body" rows={4} maxLength={MAX_REVIEW} defaultValue={r?.body} required /></Field>
      </div>
      <Field label="Jméno autora"><Input name="authorName" defaultValue={r?.authorName} required /></Field>
      <Field label="Datum" hint="Kdy recenze vznikla (nepovinné).">
        <Input name="date" type="date" defaultValue={r ? dateKey(r.createdAt) : ""} />
      </Field>
      {!r && (
        <Field label="Odkud">
          <Select name="source">
            <option value="manual">Starý web / jinde</option>
            <option value="google">Google</option>
          </Select>
        </Field>
      )}
      <div className="sm:col-span-2">
        <SubmitButton>{r ? "Uložit úpravy" : "Přidat recenzi"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export default async function AdminReviews() {
  await requireAdmin();
  const list = await (await getDb())
    .select()
    .from(reviews)
    .orderBy(sql`case ${reviews.status} when 'pending' then 0 when 'approved' then 1 else 2 end`, desc(reviews.createdAt));
  return (
    <>
      <AdminTitle title="Recenze" />
      <p className="-mt-4 mb-6 max-w-2xl text-sm text-les/60">
        Klienti píšou recenze na stránce Recenze – na web jdou až po schválení. Zvýrazněné se ukazují na úvodní stránce jako první.
        Recenze z Googlu nebo starého webu můžeš vložit ručně (se souhlasem autora).
      </p>
      <div className="space-y-3">
        <Panel title="+ Vložit recenzi"><ReviewForm /></Panel>
        {list.map((r) => (
          <div key={r.id} className="rounded-2xl border border-linka/60 bg-white/60 p-5">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Stars rating={r.rating} />
              <strong>{r.authorName}</strong>
              <span className="text-les/50">{formatDate(r.createdAt)} · {sourceLabel[r.source]}</span>
              <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
              {r.isFeatured && <Badge tone="gold">Zvýrazněná</Badge>}
            </div>
            <p className="mt-3 whitespace-pre-line text-sm text-les/85">{r.body}</p>
            <ActionForm action={reviewStatusAction} className="mt-4 flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={r.id} />
              {r.status !== "approved" && <SubmitButton name="do" value="approve" className="px-4 py-2 text-[0.7rem]">Schválit</SubmitButton>}
              {r.status !== "hidden" && <SubmitButton name="do" value="hide" variant="outline" className="px-4 py-2 text-[0.7rem]">Skrýt</SubmitButton>}
              <SubmitButton name="do" value="feature" variant="outline" className="px-4 py-2 text-[0.7rem]">
                {r.isFeatured ? "Zrušit zvýraznění" : "Zvýraznit"}
              </SubmitButton>
              <button name="do" value="delete" data-confirm="Smazat recenzi?" className="ml-2 text-xs font-semibold text-chyba underline">
                Smazat
              </button>
            </ActionForm>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-les/60 underline">Upravit</summary>
              <div className="mt-4"><ReviewForm r={r} /></div>
            </details>
          </div>
        ))}
      </div>
    </>
  );
}
