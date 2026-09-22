import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, Clock, MapPin, UserRound } from "lucide-react";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { bookAction, cancelBookingAction, waitlistAction } from "@/app/actions/booking";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, Card, Container, Eyebrow, cx } from "@/components/ui";
import { sessionForUser, stateMessage } from "@/domain/booking";
import { getCurrentUser } from "@/lib/auth";
import { formatDay, formatRange } from "@/lib/dates";
import { credits, formatPrice } from "@/lib/money";
import { sessionDetail } from "@/lib/queries";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: PageProps<"/rozvrh/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return {};
  const r = await sessionDetail(await getDb(), id);
  return r ? { title: `${r.ct.name} – ${formatDay(r.s.startsAt)}` } : {};
}

function gcalLink(title: string, start: Date, durationMin: number) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(start.getTime() + durationMin * 60_000);
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: `${title} · ${site.name}`,
    dates: `${f(start)}/${f(end)}`,
    location: `${site.address.street}, ${site.address.city}`,
  })}`;
}

export default async function SessionPage({ params }: PageProps<"/rozvrh/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const db = await getDb();
  const detail = await sessionDetail(db, id);
  if (!detail) notFound();
  const user = await getCurrentUser();
  const view = (await sessionForUser(db, id, user?.id ?? null))!;
  const { s, ct, ins } = detail;
  const left = Math.max(0, s.capacity - view.occupied);

  return (
    <section className="bg-forest text-papir">
      <Container className="py-10 sm:py-14">
        <Link href="/rozvrh" className="eyebrow inline-flex items-center gap-2 text-papir/60 hover:text-zlato-light">
          <ArrowLeft className="size-4" /> Zpět na rozvrh
        </Link>
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Eyebrow className="text-zlato">{formatDay(s.startsAt)}</Eyebrow>
            <h1 className="mt-4 text-4xl font-medium tracking-tight sm:text-6xl">{ct.name}</h1>
            <ul className="mt-8 space-y-3 text-papir/80">
              <li className="flex items-center gap-3"><Clock className="size-5 text-zlato" /> {formatRange(s.startsAt, s.durationMin)} ({s.durationMin} min)</li>
              {ins && (
                <li className="flex items-center gap-3"><UserRound className="size-5 text-zlato" /> {ins.name}{ins.specialties && <span className="text-papir/50">· {ins.specialties}</span>}</li>
              )}
              <li className="flex items-center gap-3"><MapPin className="size-5 text-zlato" /> {s.room ? `${s.room}, ` : ""}{site.address.street}, {site.address.city}</li>
            </ul>
            {s.note && <p className="mt-6 rounded-xl border border-zlato/40 bg-zlato/10 p-4 text-zlato-light">{s.note}</p>}
            <p className="mt-8 max-w-xl leading-relaxed text-papir/70">{ct.description}</p>
            <p className="eyebrow mt-6 text-papir/50">Úroveň: {ct.level}</p>
            <dl className="mt-8 grid max-w-md grid-cols-3 gap-6 border-t border-zlato/20 pt-6 text-sm">
              <div><dt className="eyebrow text-papir/50">Cena</dt><dd className="mt-1 font-semibold">{s.isFree ? "Zdarma" : credits(s.creditCost)}</dd></div>
              <div><dt className="eyebrow text-papir/50">Vstup</dt><dd className="mt-1 font-semibold">{s.isFree ? "—" : s.dropInPrice !== null ? formatPrice(s.dropInPrice) : "—"}</dd></div>
              <div><dt className="eyebrow text-papir/50">Volno</dt><dd className="mt-1 font-semibold">{s.status === "cancelled" ? "—" : `${left} / ${s.capacity}`}</dd></div>
            </dl>
          </div>

          <Card className="self-start border-zlato/30 bg-papir text-les">
            <BookingPanel
              view={view}
              loggedIn={!!user}
              sessionId={s.id}
              gcal={gcalLink(ct.name, s.startsAt, s.durationMin)}
            />
          </Card>
        </div>
      </Container>
    </section>
  );
}

function BookingPanel({
  view,
  loggedIn,
  sessionId,
  gcal,
}: {
  view: NonNullable<Awaited<ReturnType<typeof sessionForUser>>>;
  loggedIn: boolean;
  sessionId: string;
  gcal: string;
}) {
  const b = view.myBooking;

  if (b && b.status !== "waitlist") {
    const label =
      b.status === "pending_payment" ? "Čeká na zaplacení" : b.status === "attended" ? "Zúčastnil/a ses" : b.status === "no_show" ? "Nedorazil/a jsi" : "Máš rezervováno";
    return (
      <div>
        <Badge tone={b.status === "pending_payment" ? "gold" : "green"}>{label}</Badge>
        <h2 className="mt-4 text-2xl font-medium">Těšíme se na tebe!</h2>
        {view.state !== "past" && view.state !== "cancelled" && (
          <>
            <a href={gcal} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-zeme underline underline-offset-4">
              <CalendarPlus className="size-4" /> Přidat do Google kalendáře
            </a>
            <ActionForm action={cancelBookingAction} className="mt-6 border-t border-linka/60 pt-6" confirm="Opravdu zrušit rezervaci?">
              <input type="hidden" name="bookingId" value={b.id} />
              <p className="mb-3 text-sm text-les/70">
                {view.lateCancel
                  ? `Do lekce zbývá méně než ${view.cfg.cancellationHours} h – při zrušení vstup propadá.`
                  : `Zrušit můžeš zdarma do ${view.cfg.cancellationHours} h před začátkem.`}
              </p>
              <SubmitButton variant="danger">Zrušit rezervaci</SubmitButton>
            </ActionForm>
          </>
        )}
      </div>
    );
  }

  if (view.state !== "bookable" && view.state !== "full") {
    return (
      <div>
        <h2 className="text-2xl font-medium">Rezervace</h2>
        <p className="mt-3 text-les/70">{stateMessage[view.state]}</p>
        <ButtonLink href="/rozvrh" variant="outline" className="mt-6">Jiné lekce</ButtonLink>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div>
        <h2 className="text-2xl font-medium">Rezervuj si místo</h2>
        <p className="mt-3 text-les/70">Pro rezervaci se přihlas. Nový? Registrace trvá minutu a první lekce je zdarma.</p>
        <div className="mt-6 flex flex-col gap-3">
          <ButtonLink href={`/prihlaseni?next=/rozvrh/${sessionId}`}>Přihlásit se</ButtonLink>
          <ButtonLink href={`/registrace?next=/rozvrh/${sessionId}`} variant="outline">Vytvořit účet</ButtonLink>
        </div>
      </div>
    );
  }

  if (view.state === "full") {
    return (
      <div>
        <h2 className="text-2xl font-medium">Lekce je plná</h2>
        {b?.status === "waitlist" ? (
          <ActionForm action={cancelBookingAction} className="mt-4">
            <input type="hidden" name="bookingId" value={b.id} />
            <p className="text-les/70">Jsi v pořadníku na <strong>{view.waitlistPosition}. místě</strong>. Když se uvolní místo, automaticky tě přihlásíme a strhneme vstup z tvé permanentky/kreditu.</p>
            <SubmitButton variant="outline" className="mt-5">Odejít z pořadníku</SubmitButton>
          </ActionForm>
        ) : (
          <ActionForm action={waitlistAction} className="mt-4">
            <input type="hidden" name="sessionId" value={sessionId} />
            <p className="text-les/70">Zapiš se do pořadníku. Jakmile někdo zruší, místo automaticky dostaneš a přijde ti e-mail. Potřebuješ mít kredit, permanentku nebo členství.</p>
            <SubmitButton className="mt-5">Zapsat do pořadníku</SubmitButton>
          </ActionForm>
        )}
      </div>
    );
  }

  const firstEnabled = view.options.find((o) => !o.disabled);
  return (
    <ActionForm action={bookAction}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <h2 className="text-2xl font-medium">Jak chceš zaplatit?</h2>
      <fieldset className="mt-5 space-y-2">
        <legend className="sr-only">Způsob platby</legend>
        {view.options.map((o) => {
          const value = `${o.method}:${o.entitlementId ?? ""}`;
          return (
            <label
              key={value}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-xl border border-linka bg-white/60 p-4 transition has-[:checked]:border-zlato has-[:checked]:bg-zlato/10",
                o.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="radio"
                name="option"
                value={value}
                disabled={!!o.disabled}
                defaultChecked={o === firstEnabled}
                className="mt-1 accent-[#674329]"
              />
              <span>
                <span className="block font-semibold">{o.label}</span>
                <span className="block text-sm text-les/60">{o.disabled ?? o.detail}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {!firstEnabled && (
        <p className="mt-4 text-sm text-les/70">
          Nemáš čím zaplatit. <Link href="/cenik" className="font-semibold text-zeme underline">Kup si kredit nebo permanentku</Link>.
        </p>
      )}
      <SubmitButton variant="gold" className="mt-6 w-full" disabled={!firstEnabled} pendingText="Rezervuji…">
        Rezervovat
      </SubmitButton>
      <p className="mt-3 text-center text-xs text-les/50">Storno zdarma do {view.cfg.cancellationHours} h před lekcí.</p>
    </ActionForm>
  );
}
