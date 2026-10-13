import Link from "next/link";
import { submitWishAction } from "@/app/actions/wishes";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Empty, Field, Textarea } from "@/components/ui";
import { getDb } from "@/db";
import { MAX_WISH, WISH_KINDS, userWishes } from "@/domain/wishes";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { displayName } from "@/lib/profile";

const pick =
  "flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-linka bg-white/60 px-4 py-3 text-sm font-semibold transition has-[:checked]:border-zlato has-[:checked]:bg-zlato/15";

/** Můj účet → 💌 Schránka přání a nápadů. */
export default async function WishBoxPage() {
  const user = await requireUser("/ucet/schranka");
  const mine = await userWishes(await getDb(), user.id);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      <Card>
        <h2 className="text-2xl font-semibold">💌 Schránka přání a nápadů</h2>
        <p className="mt-2 text-sm text-les/70">
          Máš nápad, přání nebo pochvalu? Nebo tě něco trápí? Napiš nám – čteme všechno a odpovíme ti e-mailem i tady v účtu.
        </p>
        <ActionForm action={submitWishAction} className="mt-6 space-y-6" resetOnSuccess>
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-les/70">O co jde</legend>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(WISH_KINDS).map(([k, v], i) => (
                <label key={k} className={pick}>
                  <input type="radio" name="kind" value={k} defaultChecked={i === 0} className="sr-only" required />
                  <span className="text-lg">{v.emoji}</span> {v.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Vzkaz">
            <Textarea name="body" rows={6} maxLength={MAX_WISH} required placeholder="Napiš, co máš na srdci…" />
          </Field>
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-les/70">Kdo ho uvidí</legend>
            <div className="grid gap-2">
              <label className={pick}>
                <input type="radio" name="visibility" value="private" defaultChecked className="sr-only" />
                <span className="text-lg">🔒</span>
                <span>Jen studio<span className="block text-xs font-normal text-les/60">Vzkaz zůstane mezi námi.</span></span>
              </label>
              <label className={pick}>
                <input type="radio" name="visibility" value="public" className="sr-only" />
                <span className="text-lg">🌍</span>
                <span>
                  Může být i na webu
                  <span className="block text-xs font-normal text-les/60">
                    Zveřejníme ho až po schválení na stránce „Co jsme díky vám zlepšili“ – podepsaný jako {displayName(user)}, nebo anonymně.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
          <label className="flex gap-3 text-sm">
            <input type="checkbox" name="anonymous" className="mt-0.5 accent-[#674329]" />
            <span>
              Poslat anonymně
              <span className="block text-xs text-les/60">Studio neuvidí, od koho vzkaz je. Odpověď ti přijde i tak.</span>
            </span>
          </label>
          <SubmitButton className="w-full">Odeslat vzkaz</SubmitButton>
        </ActionForm>
      </Card>

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold">Moje vzkazy</h2>
          <Link href="/schranka" className="eyebrow text-zeme underline underline-offset-4">Co jsme díky vám zlepšili</Link>
        </div>
        <div className="mt-4 space-y-3">
          {mine.length === 0 && <Empty>Zatím jsi nám nic nenapsal/a.</Empty>}
          {mine.map((w) => (
            <Card key={w.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{WISH_KINDS[w.kind].emoji} {WISH_KINDS[w.kind].label}</span>
                <span className="text-les/50">· {formatDate(w.createdAt)}</span>
                <span className="ml-auto flex flex-wrap gap-1.5">
                  {w.anonymous && <Badge>Anonymně</Badge>}
                  {w.published ? <Badge tone="green">Na webu</Badge> : w.allowPublic ? <Badge>Může na web</Badge> : <Badge>Jen pro studio</Badge>}
                  {w.status === "resolved" && <Badge tone="green">Vyřešeno</Badge>}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm">{w.body}</p>
              {w.reply ? (
                <div className="mt-3 rounded-xl bg-zlato/10 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zeme">Odpověď studia{w.repliedAt && ` · ${formatDate(w.repliedAt)}`}</p>
                  <p className="mt-1 whitespace-pre-line">{w.reply}</p>
                </div>
              ) : (
                <p className="mt-3 text-xs text-les/50">Odpověď zatím nepřišla.</p>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
