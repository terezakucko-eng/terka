import { cancelVacationAction, planVacationAction } from "@/app/actions/membership";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Eyebrow, Input } from "@/components/ui";
import { discountText, firstVacationDay, vacationsLeft, type vacationsOf } from "@/domain/vacations";
import { dateKey, formatDate, pragueLocalToDate } from "@/lib/dates";
import { VACATION } from "@/lib/vacation";

/** Můj účet: Zmražení členství – frozen weeks and freezing another one. */
export function VacationCard({ list, canPlan, now = new Date() }: { list: Awaited<ReturnType<typeof vacationsOf>>; canPlan: boolean; now?: Date }) {
  const today = dateKey(now);
  const first = firstVacationDay(now);
  const year = first.slice(0, 4);
  const left = vacationsLeft(list, year);
  const shown = list.filter((v) => v.endsOn >= today);
  return (
    <Card>
      <Eyebrow className="text-zeme">Zmražení členství</Eyebrow>
      <p className="mt-3 text-sm text-les/70">
        Dovolená, nemoc nebo cokoli jiného? {VACATION.perYear}× za rok si zmraz členství na týden ({VACATION.days} dní po sobě) a za ten měsíc
        zaplatíš méně – poměrně podle dní. Když je platba za ten měsíc už zaplacená, sleva se odečte z té příští. V tom týdnu se na lekce
        nepřihlašuješ; rezervace na ty dny se zruší a vstupy se vrátí.
        {now < VACATION.from && ` Platí od ${formatDate(VACATION.from)} – leden si můžeš zmrazit už teď.`}
      </p>
      {shown.length > 0 && (
        <ul className="mt-4 divide-y divide-linka/60">
          {shown.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">
                  ❄️ {v.label} {v.startsOn <= today && <Badge tone="gold">Právě teď</Badge>}
                </p>
                <p className="text-sm text-les/60">{v.discount > 0 ? `Ušetříš ${discountText(v.discounts)}` : "Bez slevy – ten měsíc nic neplatíš"}</p>
              </div>
              {v.startsOn > today && (
                <ActionForm action={cancelVacationAction} confirm={`Zrušit zmražení ${v.label}? Platba bude zase v plné výši.`}>
                  <input type="hidden" name="id" value={v.id} />
                  <SubmitButton variant="ghost" className="px-3 py-2 text-[0.65rem]">Zrušit zmražení</SubmitButton>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      )}
      {canPlan &&
        (left > 0 ? (
          <ActionForm
            action={planVacationAction}
            confirm={`Zmrazit členství na týden? ${VACATION.days} dní od zvoleného dne se na lekce nepřihlásíš a rezervace na ty dny se zruší.`}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <label className="text-sm">
              <span className="mb-1 block font-semibold">Od kdy?</span>
              <Input type="date" name="startsOn" min={first} defaultValue={first} required />
            </label>
            <SubmitButton variant="dark" className="px-4 py-2" pendingText="Moment…">
              Zmrazit na týden
            </SubmitButton>
            <p className="w-full text-xs text-les/60">
              Nejdřív od {formatDate(pragueLocalToDate(`${first}T00:00`))} · v roce {year} ti {left === 1 ? "zbývá 1 zmražení" : `zbývají ${left} zmražení`}
            </p>
          </ActionForm>
        ) : (
          <p className="mt-4 text-sm text-les/60">V roce {year} už máš obě zmražení využitá.</p>
        ))}
    </Card>
  );
}
