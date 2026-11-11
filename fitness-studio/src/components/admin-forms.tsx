import type { ClassSession, ClassType, Instructor } from "@/db/schema";
import { toLocalInput } from "@/lib/dates";
import { Field, Input, Select, Textarea } from "./ui";

const kc = (h: number | null | undefined) => (h === null || h === undefined ? "" : String(h / 100));

/** Shared fields for creating/editing a class session. */
export function SessionFields({
  types,
  instructorList,
  s,
}: {
  types: ClassType[];
  instructorList: Instructor[];
  s?: ClassSession;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Lekce">
        <Select name="classTypeId" defaultValue={s?.classTypeId} required>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </Field>
      <Field label="Lektor">
        <Select name="instructorId" defaultValue={s?.instructorId ?? ""}>
          <option value="">—</option>
          {instructorList.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </Select>
      </Field>
      <Field label="Kapacita" hint={s ? undefined : "Předvyplněno podle typu lekce"}>
        <Input name="capacity" type="number" min={1} defaultValue={s?.capacity} />
      </Field>
      <Field label="Délka (min)" hint={s ? undefined : "Předvyplněno podle typu lekce"}>
        <Input name="durationMin" type="number" min={10} defaultValue={s?.durationMin} />
      </Field>
      <Field label="Cena v kreditech">
        <Input name="creditCost" type="number" min={0} defaultValue={s?.creditCost} />
      </Field>
      <Field label="Jednorázový vstup (Kč)">
        <Input name="dropInPrice" inputMode="decimal" defaultValue={kc(s?.dropInPrice)} />
      </Field>
      <Field label="Sál / místo">
        <Input name="room" defaultValue={s?.room ?? ""} />
      </Field>
      <label className="flex items-center gap-3 self-end pb-3 text-sm font-semibold">
        <input type="checkbox" name="isFree" defaultChecked={s?.isFree} className="size-4 accent-[#674329]" />
        Lekce zdarma pro všechny
      </label>
      <label className="flex items-start gap-3 self-end pb-3 text-sm font-semibold sm:col-span-2">
        <input type="checkbox" name="noFreeEntry" defaultChecked={s?.noFreeEntry} className="mt-0.5 size-4 accent-[#674329]" />
        <span>
          Speciální lekce – vždy placená
          <span className="block font-normal text-les/60">Neplatí na ni úvodní lekce zdarma, lekce z kartičky ani jiné vstupy zdarma, ani úvodní cena.</span>
        </span>
      </label>
      <label className="flex items-start gap-3 self-end pb-3 text-sm font-semibold sm:col-span-2">
        <input type="checkbox" name="dropInOnly" defaultChecked={s?.dropInOnly} className="mt-0.5 size-4 accent-[#674329]" />
        <span>
          Jen kartou nebo převodem
          <span className="block font-normal text-les/60">Benefiční lekce: neplatí členství, permanentky, kredity, vstupy zdarma ani úvodní či studentská cena. Pořadník tu není.</span>
        </span>
      </label>
      <label className="flex items-center gap-3 self-end pb-3 text-sm font-semibold sm:col-span-2">
        <input type="checkbox" name="ribbon" defaultChecked={s?.ribbon} className="size-4 accent-[#674329]" />
        Růžová stužka v rozvrhu
      </label>
      <div className="sm:col-span-2">
        <Field label="Rezervace otevřít od" hint="Prázdné = jako obvykle podle rezervačního okna. Vyplň, když chceš akci (brunch…) otevřít dřív.">
          <Input name="bookingOpensAt" type="datetime-local" defaultValue={s?.bookingOpensAt ? toLocalInput(s.bookingOpensAt) : ""} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Vlastní název termínu" hint="Prázdné = název lekce. Např. „Dýňový brunch“.">
          <Input name="title" defaultValue={s?.title ?? ""} />
        </Field>
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <Field label="Poznámka pro klienty">
          <Textarea name="note" rows={2} defaultValue={s?.note ?? ""} />
        </Field>
      </div>
    </div>
  );
}

export { kc };
