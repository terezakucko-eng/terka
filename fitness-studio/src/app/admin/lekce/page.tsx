import { asc, isNull } from "drizzle-orm";
import {
  deleteClassTypeAction,
  fillAllLessonTextsAction,
  hideLessonDraftAction,
  lessonFromTemplateAction,
  lessonTextFromTemplateAction,
  saveClassTypeAction,
} from "@/app/admin/actions";
import { hiddenDrafts } from "@/domain/lesson-drafts";
import { LESSON_TEMPLATES, templateFor } from "@/domain/lesson-templates";
import { AdminTitle, Panel } from "@/components/admin";
import { kc } from "@/components/admin-forms";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { getDb } from "@/db";
import { classTypes, type ClassType } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { ImageInput } from "@/components/image-input";

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
      <fieldset className="rounded-xl border border-linka/60 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-les/70">Zvláštní ceny</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Vstupů z permanentky" hint="Kolik vstupů se strhne z permanentky (Reformer = 2)">
            <Input name="passEntries" type="number" min={1} defaultValue={t?.passEntries ?? 1} />
          </Field>
          <Field label="Doplatek pro členy (Kč / lekce)" hint="Prázdné = členové bez doplatku">
            <Input name="memberSurcharge" inputMode="decimal" defaultValue={kc(t?.memberSurcharge)} />
          </Field>
          <Field label="Doplatek platí od" hint="Prázdné = hned">
            <Input name="memberSurchargeFrom" type="date" defaultValue={t?.memberSurchargeFrom ?? ""} />
          </Field>
          <Field label="Cena první lekce (Kč)" hint="Pro klienta, který na téhle lekci ještě nebyl">
            <Input name="firstVisitPrice" inputMode="decimal" defaultValue={kc(t?.firstVisitPrice)} />
          </Field>
          <Field label="Jednorázově pro dva (Kč)" hint="Klient + kamarádka. Prázdné = 2× jednorázová cena">
            <Input name="duoPrice" inputMode="decimal" defaultValue={kc(t?.duoPrice)} />
          </Field>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" name="noFreeEntry" defaultChecked={t?.noFreeEntry ?? false} /> Úvodní vstup zdarma na tuhle lekci nejde použít
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" name="noPass" defaultChecked={t?.noPass ?? false} /> Permanentka na tuhle lekci neplatí
        </label>
      </fieldset>
      <Field label="Popis" hint="Zobrazí se na stránce Lekce i na vlastní stránce lekce – pár vět o tom, co se na lekci dělá a pro koho je.">
        <Textarea name="description" rows={3} defaultValue={t?.description} />
      </Field>
      <Field label="Hledané výrazy (čárkou)" hint="Co lidé píšou do Googlu, např. „zumba Ostrava, taneční fitness“. Ukážou se jako štítky na stránce lekce.">
        <Input
          name="keywords"
          defaultValue={t?.keywords ?? ""}
          maxLength={500}
          placeholder={(t && templateFor(t)?.keywords) ?? "např. zumba Ostrava, taneční fitness"}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        {t?.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.imageUrl} alt="" className="h-20 w-32 rounded-lg object-cover" />
        )}
        <Field label="Fotka lekce (na stránce Lekce)">
          <ImageInput name="image" />
        </Field>
        {t?.imageUrl && <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="removeImage" /> Odebrat fotku</label>}
      </div>
      <Field label="Videoukázka – odkaz" hint="YouTube nebo Vimeo (klidně jako neveřejné video). Prázdné = bez videa.">
        <Input name="videoUrl" type="url" placeholder="https://youtu.be/…" defaultValue={t?.videoUrl ?? ""} />
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={t?.isActive ?? true} /> Aktivní (zobrazit na webu)</label>
      <SubmitButton>Uložit</SubmitButton>
    </ActionForm>
  );
}

export default async function AdminClassTypes() {
  await requireAdmin();
  const db = await getDb();
  const [list, hidden] = await Promise.all([
    db.select().from(classTypes).where(isNull(classTypes.archivedAt)).orderBy(asc(classTypes.sortOrder)),
    hiddenDrafts(db),
  ]);
  const taken = new Set(list.map((t) => templateFor(t)).filter(Boolean));
  const ready = LESSON_TEMPLATES.filter((t) => !taken.has(t) && !hidden.has(t.slug));
  const hiddenList = LESSON_TEMPLATES.filter((t) => hidden.has(t.slug) && !taken.has(t));
  const matched = list.filter((t) => templateFor(t));
  return (
    <>
      <AdminTitle title="Typy lekcí" />
      <div className="space-y-3">
        <Panel title="+ Nový typ lekce"><ClassTypeForm /></Panel>
        {matched.length > 0 && (
          <ActionForm
            action={fillAllLessonTextsAction}
            confirm={`Doplnit popis a hledané výrazy z návrhů lekcím: ${matched.map((t) => t.name).join(", ")}? Stávající popisy se přepíšou, jinak se nic nemění.`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zlato/50 bg-zlato/10 p-4 text-sm"
          >
            <span>
              <strong>Doplnit texty všem lekcím z návrhů</strong>
              <span className="block text-les/60">{matched.map((t) => t.name).join(" · ")} – zůstanou aktivní, cena, fotka ani rozvrh se nemění.</span>
            </span>
            <SubmitButton variant="gold" className="px-4 py-2 text-[0.7rem]">Doplnit všem</SubmitButton>
          </ActionForm>
        )}
        {(ready.length > 0 || hiddenList.length > 0) && (
          <Panel title="+ Připravené návrhy lekcí">
            <p className="mb-4 text-sm text-les/60">
              Lekce s hotovým popisem a hledanými výrazy. Vytvoří se jako <strong>neaktivní</strong> – stránku uvidíš jen ty. Až lekci
              budeš nabízet, doplň cenu a fotku a zaškrtni „Aktivní“: stránka se zveřejní a dostane se do mapy webu pro Google.
            </p>
            <ul className="divide-y divide-linka/60">
              {ready.map((t) => (
                <li key={t.slug} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="max-w-xl text-sm">
                    <strong>{t.name}</strong> <span className="text-les/50">/lekce/{t.slug}</span>
                    <span className="block text-les/60">{t.keywords}</span>
                    {t.note && <span className="block text-xs text-zeme">⚠ {t.note}</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <ActionForm action={lessonFromTemplateAction}>
                      <input type="hidden" name="slug" value={t.slug} />
                      <SubmitButton variant="outline" className="px-4 py-2 text-[0.7rem]">Připravit</SubmitButton>
                    </ActionForm>
                    <ActionForm action={hideLessonDraftAction}>
                      <input type="hidden" name="slug" value={t.slug} />
                      <button className="text-xs font-semibold text-chyba underline">Smazat návrh</button>
                    </ActionForm>
                  </span>
                </li>
              ))}
            </ul>
            {hiddenList.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-les/60 underline">Smazané návrhy ({hiddenList.length})</summary>
                <ul className="mt-2 space-y-2">
                  {hiddenList.map((t) => (
                    <li key={t.slug}>
                      <ActionForm action={hideLessonDraftAction} className="flex items-center gap-3">
                        <input type="hidden" name="slug" value={t.slug} />
                        <input type="hidden" name="do" value="show" />
                        <span>{t.name}</span>
                        <button className="text-xs font-semibold text-zeme underline">Vrátit</button>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Panel>
        )}
        {list.map((t) => (
          <Panel key={t.id} title={`${t.name}${t.isActive ? "" : " · neaktivní"}`}>
            <a href={`/lekce/${t.slug}`} target="_blank" className="mb-4 inline-block text-xs font-semibold text-zeme underline">
              {t.isActive ? "Stránka lekce ↗" : "Náhled stránky lekce (zatím skrytá) ↗"}
            </a>
            <ActionForm
              action={lessonTextFromTemplateAction}
              confirm="Přepsat popis a hledané výrazy textem z návrhu?"
              className="mb-5 flex flex-wrap items-end gap-2 rounded-xl bg-krem/40 p-3 text-sm"
            >
              <input type="hidden" name="id" value={t.id} />
              <Field label="Doplnit popis a hledané výrazy z návrhu">
                <Select name="template" defaultValue={templateFor(t)?.slug ?? ""}>
                  <option value="" disabled>Vyber návrh…</option>
                  {LESSON_TEMPLATES.map((x) => (
                    <option key={x.slug} value={x.slug}>{x.name}</option>
                  ))}
                </Select>
              </Field>
              <SubmitButton variant="outline" className="px-4 py-2 text-[0.7rem]">Doplnit</SubmitButton>
            </ActionForm>
            <ClassTypeForm t={t} />
            <ActionForm
              action={deleteClassTypeAction}
              confirm={`Opravdu smazat typ lekce „${t.name}“? Zmizí z webu i z rozvrhu (nerezervované termíny se smažou).`}
              className="mt-4 border-t border-linka/60 pt-4"
            >
              <input type="hidden" name="id" value={t.id} />
              <button className="text-xs font-semibold text-chyba underline">Smazat typ lekce</button>
            </ActionForm>
          </Panel>
        ))}
      </div>
    </>
  );
}
