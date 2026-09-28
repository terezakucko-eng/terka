import type { Metadata } from "next";
import { availabilityText } from "@/components/session-card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, Clock, MapPin } from "lucide-react";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { bookAction, cancelBookingAction, waitlistAction } from "@/app/actions/booking";
import { ActionForm, SubmitButton } from "@/components/forms";
import { HealthCheckbox } from "@/components/health-checkbox";
import { cardPayments } from "@/lib/payments";
import { VideoEmbed } from "@/components/video-embed";
import { Badge, ButtonLink, Card, Container, Eyebrow, cx } from "@/components/ui";
import { sessionForUser, stateMessage } from "@/domain/booking";
import { getCurrentUser } from "@/lib/auth";
import { formatDay, formatRange } from "@/lib/dates";
import { credits, formatPrice } from "@/lib/money";
import { sessionDetail } from "@/lib/queries";
import { getContent } from "@/content";
import { nbsp } from "@/lib/typography";
import { SurchargePay } from "@/components/surcharge-pay";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: PageProps<"/rozvrh/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return {};
  const r = await sessionDetail(await getDb(), id);
  return r ? { title: `${r.ct.name} – ${formatDay(r.s.startsAt)}`, robots: { index: false } } : {};
}

function gcalLink(title: string, start: Date, durationMin: number, location: string) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(start.getTime() + durationMin * 60_000);
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: `${title} · ${site.name}`,
    dates: `${f(start)}/${f(end)}`,
    location,
  })}`;
}

export default async function SessionPage({ params, searchParams }: PageProps<"/rozvrh/[id]">) {
  const { id } = await params;
  const { plus1 } = await searchParams;
  if (!UUID.test(id)) notFound();
  const db = await getDb();
  const detail = await sessionDetail(db, id);
  if (!detail) notFound();
  const [user, c] = await Promise.all([getCurrentUser(), getContent()]);
  const address = `${c("site.street")}, ${c("site.city")}`;
  const view = (await sessionForUser(db, id, user?.id ?? null, undefined, plus1 === "1" ? 2 : 1))!;
  const { s, ct } = detail;
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
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">{ct.name}</h1>
            <ul className="mt-8 space-y-3 text-papir/80">
              <li className="flex items-center gap-3"><Clock className="size-5 text-zlato" /> {formatRange(s.startsAt, s.durationMin)} ({s.durationMin} min)</li>
              <li className="flex items-center gap-3"><MapPin className="size-5 text-zlato" /> {s.room ? `${s.room}, ` : ""}{address}</li>
            </ul>
            {!s.isFree && ct.noPass && (
              <p className="mt-6 rounded-xl border border-zlato/40 bg-zlato/10 p-4 text-zlato-light">
                Permanentka na tuhle lekci neplatí – zaplatíš kreditem nebo jednorázově.
              </p>
            )}
            {!s.isFree && !ct.noPass && ct.passEntries > 1 && (
              <p className="mt-6 rounded-xl border border-zlato/40 bg-zlato/10 p-4 text-zlato-light">
                Z permanentky se na tuhle lekci strhnou {ct.passEntries} vstupy.
              </p>
            )}
            {s.note && <p className="mt-6 rounded-xl border border-zlato/40 bg-zlato/10 p-4 text-zlato-light">{nbsp(s.note)}</p>}
            <p className="mt-8 max-w-xl leading-relaxed text-papir/70">{nbsp(ct.description)}</p>
            <VideoEmbed url={ct.videoUrl} title={ct.name} className="mt-6 max-w-xl [&_summary]:text-zlato" />
            <p className="eyebrow mt-6 text-papir/50">Úroveň: {ct.level}</p>
            <dl className="mt-8 grid max-w-md grid-cols-3 gap-6 border-t border-zlato/20 pt-6 text-sm">
              <div><dt className="eyebrow text-papir/50">Cena</dt><dd className="mt-1 font-semibold">{s.isFree ? "Zdarma" : credits(s.creditCost)}</dd></div>
              <div><dt className="eyebrow text-papir/50">Vstup</dt><dd className="mt-1 font-semibold">{s.isFree ? "—" : s.dropInPrice !== null ? formatPrice(s.dropInPrice) : "—"}</dd></div>
              <div><dt className="eyebrow text-papir/50">Místa</dt><dd className="mt-1 font-semibold">{s.status === "cancelled" ? "—" : availabilityText(left, s.capacity)}</dd></div>
            </dl>
          </div>

          <Card className="self-start border-zlato/30 bg-papir text-les">
            <BookingPanel
              view={view}
              loggedIn={!!user}
              needsHealth={!!user && !user.healthConfirmedAt}
              card={cardPayments()}
              sessionId={s.id}
              gcal={gcalLink(ct.name, s.startsAt, s.durationMin, address)}
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
  needsHealth,
  card,
  sessionId,
  gcal,
}: {
  card: boolean;
  view: NonNullable<Awaited<ReturnType<typeof sessionForUser>>>;
  loggedIn: boolean;
  needsHealth: boolean;
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
        <h2 className="mt-4 text-2xl font-semibold">{b.guestName ? "Těšíme se na vás!" : "Těšíme se na tebe!"}</h2>
        {b.guestName && <p className="mt-2 text-les/70">Rezervace je i pro kamarádku: <strong>{b.guestName}</strong>.</p>}
        {b.surcharge > 0 && !b.surchargePaidAt && view.state !== "cancelled" && <SurchargePay bookingId={b.id} amount={b.surcharge} />}
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
        <h2 className="text-2xl font-semibold">Rezervace</h2>
        <p className="mt-3 text-les/70">{stateMessage[view.state]}</p>
        <ButtonLink href="/rozvrh" variant="outline" className="mt-6">Jiné lekce</ButtonLink>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div>
        <h2 className="text-2xl font-semibold">Rezervuj si místo</h2>
        <p className="mt-3 text-les/70">Pro rezervaci se přihlas. Nový? Registrace trvá minutu a první lekce je zdarma.</p>
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
        <h2 className="text-2xl font-semibold">Lekce je plná</h2>
        {b?.status === "waitlist" ? (
          <ActionForm action={cancelBookingAction} className="mt-4">
            <input type="hidden" name="bookingId" value={b.id} />
            <p className="text-les/70">Jsi v pořadníku na <strong>{view.waitlistPosition}. místě</strong>. Když se uvolní místo, automaticky tě přihlásíme a strhneme vstup z tvé permanentky/kreditu.</p>
            <SubmitButton variant="outline" className="mt-5">Odejít z pořadníku</SubmitButton>
          </ActionForm>
        ) : (
          <ActionForm action={waitlistAction} className="mt-4">
            <input type="hidden" name="sessionId" value={sessionId} />
            {needsHealth && <div className="mb-4"><HealthCheckbox /></div>}
            <p className="text-les/70">Zapiš se do pořadníku. Jakmile někdo zruší, místo automaticky dostaneš a přijde ti e-mail. Potřebuješ mít kredit, permanentku nebo členství.</p>
            <SubmitButton className="mt-5">Zapsat do pořadníku</SubmitButton>
          </ActionForm>
        )}
      </div>
    );
  }

  // with card payments on, a drop-in can be paid right away by card or later by transfer
  const options = view.options.flatMap((o) =>
    o.method === "drop_in"
      ? card
        ? [
            { ...o, pay: "card", detail: "Zaplatíš hned kartou." },
            { ...o, pay: "transfer", label: `${o.label} – převodem`, detail: "Místo máš hned, zaplatíš převodem s QR kódem." },
          ]
        : [{ ...o, pay: "transfer", detail: "Zaplatíš převodem s QR kódem." }]
      : [{ ...o, pay: "" }],
  );
  const firstEnabled = options.find((o) => !o.disabled);
  return (
    // remount on switch so the preselected payment follows the new options
    <ActionForm key={view.withFriend ? "duo" : "solo"} action={bookAction}>
      <input type="hidden" name="sessionId" value={sessionId} />
      {view.canBringFriend && (
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-linka bg-white/60 p-1 text-center text-sm font-semibold">
          <Link href={`/rozvrh/${sessionId}`} scroll={false} className={cx("rounded-full py-2", !view.withFriend ? "bg-les text-papir" : "text-les/70")}>Jen já</Link>
          <Link href={`/rozvrh/${sessionId}?plus1=1`} scroll={false} className={cx("rounded-full py-2", view.withFriend ? "bg-les text-papir" : "text-les/70")}>+1 kamarádka</Link>
        </div>
      )}
      {view.withFriend && (
        <label className="mb-6 block">
          <span className="text-xs font-semibold uppercase tracking-wider text-les/70">Jméno kamarádky</span>
          <input name="guestName" required maxLength={80} autoComplete="off" className="mt-1 w-full rounded-xl border border-linka bg-white/80 px-4 py-3" />
          <span className="mt-1 block text-xs text-les/50">Rezervujeme 2 místa a zaplatíš za obě. Ve dvou se to lépe táhne!</span>
        </label>
      )}
      <h2 className="text-2xl font-semibold">{view.withFriend ? "Jak zaplatíš za obě místa?" : "Jak chceš zaplatit?"}</h2>
      <fieldset className="mt-5 space-y-2">
        <legend className="sr-only">Způsob platby</legend>
        {options.map((o) => {
          const value = `${o.method}:${o.entitlementId ?? ""}:${o.pay}`;
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
      {needsHealth && <div className="mt-5"><HealthCheckbox /></div>}
      <SubmitButton variant="gold" className="mt-6 w-full" disabled={!firstEnabled} pendingText="Rezervuji…">
        Rezervovat
      </SubmitButton>
      <p className="mt-3 text-center text-xs text-les/50">Storno zdarma do {view.cfg.cancellationHours} h před lekcí.</p>
    </ActionForm>
  );
}
