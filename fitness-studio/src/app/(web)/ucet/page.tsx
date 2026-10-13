import Link from "next/link";
import { and, asc, eq, gt, ne, sql } from "drizzle-orm";
import { cancelBookingAction } from "@/app/actions/booking";
import { cancelMassageAction } from "@/app/actions/massages";
import { bookings, massageBookings, orders } from "@/db/schema";
import { ActionForm, SubmitButton } from "@/components/forms";
import { entitlementKindLabel } from "@/components/labels";
import { Badge, ButtonLink, Card, Empty, Eyebrow, Input } from "@/components/ui";
import { getDb } from "@/db";
import { userBookings, userEntitlements } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDay, formatRange, formatTime } from "@/lib/dates";
import { credits, formatPrice } from "@/lib/money";
import { SurchargePay } from "@/components/surcharge-pay";
import { openFees } from "@/domain/membership-fees";
import { insuranceYears } from "@/domain/insurance";
import { payOrderAction } from "@/app/actions/booking";
import { cardPayments } from "@/lib/payments";
import { WelcomeTour } from "@/components/welcome-tour";
import { vapidKeys } from "@/lib/push";
import { splitName } from "@/lib/client-list";
import { vocative } from "@/lib/vocative";
import { myReview } from "@/domain/reviews";
import { getContent } from "@/content";
import { feedLinks } from "@/lib/ics";
import { CopyButton, ShareButton } from "@/components/copy-button";
import { myReferrals } from "@/domain/referrals";
import { VOUCHER_STATUS, boughtVouchers, formatVoucherCode, voucherStatus } from "@/domain/vouchers";
import { redeemVoucherAction } from "@/app/actions/vouchers";
import { getSettings } from "@/lib/settings";
import { site } from "@/config/site";
import { resetCalendarAction } from "@/app/actions/calendar";

export default async function AccountPage({ searchParams }: PageProps<"/ucet">) {
  const { vitej } = await searchParams;
  const user = await requireUser("/ucet");
  const db = await getDb();
  const fees = await openFees(db, user.id);
  const [upcoming, ents, massages, unpaid, visits, review, content, insuranceYrs] = await Promise.all([
    userBookings(db, user.id, "upcoming"),
    userEntitlements(db, user.id, true),
    db
      .select()
      .from(massageBookings)
      .where(
        and(
          eq(massageBookings.userId, user.id),
          eq(massageBookings.status, "confirmed"),
          gt(massageBookings.endsAt, new Date()),
        ),
      )
      .orderBy(asc(massageBookings.startsAt)),
    db
      .select()
      .from(orders)
      .where(and(eq(orders.userId, user.id), eq(orders.status, "pending"), eq(orders.provider, "transfer"), ne(orders.kind, "membership_fee")))
      .orderBy(asc(orders.createdAt)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(eq(bookings.userId, user.id), eq(bookings.status, "attended")))
      .then(([r]) => r.n),
    myReview(db, user.id),
    getContent(),
    insuranceYears(db, user.id),
  ]);
  const [cfg, invited, gifts] = await Promise.all([getSettings(db), myReferrals(db, user.id), boughtVouchers(db, user.id)]);
  const invite = `${site.url}/pozvanka/${user.referralCode}`;
  // regulars who haven't written a review yet get a gentle nudge
  const google = content.googleReviewUrl;
  const askReview = user.role === "client" && visits >= 3 && !review;
  const cal = feedLinks(user.calendarToken);

  return (
    <div className="space-y-12">
      {fees.map((o) => (
        <div key={o.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zlato bg-zlato/10 p-5">
          <p>
            <span className="block font-semibold">{o.description}</span>
            <span className="text-sm text-les/70">{formatPrice(o.amount)} · variabilní symbol {o.number}</span>
          </p>
          <ActionForm action={payOrderAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="orderId" value={o.id} />
            {cardPayments() && <SubmitButton name="pay" value="card" variant="gold">Zaplatit kartou</SubmitButton>}
            <SubmitButton name="pay" value="transfer" variant="outline">Převodem (QR)</SubmitButton>
          </ActionForm>
        </div>
      ))}
      {!user.onboardedAt && user.role === "client" && (
        <WelcomeTour
          firstName={vocative(splitName(user.name).first || user.name)}
          publicKey={(await vapidKeys(db)).publicKey}
          marketing={user.marketingConsent}
          reminders={user.remindersOptIn}
          sms={user.smsConsent}
          whatsapp={user.whatsappConsent}
          hasPhone={!!user.phone}
        />
      )}
      {user.bookingPausedUntil && user.bookingPausedUntil > new Date() && (
        <p className="rounded-2xl bg-chyba/10 p-5 text-sm text-chyba">
          Kvůli opakovanému pozdnímu odhlášení nebo nepříchodu je přihlašování na nové lekce pozastavené do{" "}
          <strong>{formatDate(user.bookingPausedUntil)}</strong>. Na lekce, na které už jsi přihlášený/á, chodit můžeš.
        </p>
      )}
      {vitej && (
        <p className="rounded-2xl bg-forest p-6 text-papir">
          <span className="text-gold text-xl font-semibold">Vítej v OCTOPUSH!</span>
          <br />
          Na účtu máš připravenou úvodní lekci zdarma. <Link href="/rozvrh" className="underline">Vyber si ji v rozvrhu →</Link>
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="bg-les text-papir">
          <Eyebrow className="text-zlato">Kredit</Eyebrow>
          <p className="text-gold mt-3 text-5xl font-light">{user.creditBalance}</p>
          <p className="mt-1 text-sm text-papir/60">
            {credits(user.creditBalance).replace(/^\d+ /, "")} k dispozici
            {user.creditBalance > 0 && user.creditExpiresAt && ` · platí do ${formatDate(user.creditExpiresAt)}`}
          </p>
          <ButtonLink href="/cenik" variant="outline-light" className="mt-6 px-4 py-2">Dobít</ButtonLink>
        </Card>
        <Card className="md:col-span-2">
          <Eyebrow className="text-zeme">Permanentky a členství</Eyebrow>
          {ents.length === 0 ? (
            <p className="mt-4 text-les/60">
              Žádná aktivní permanentka. <Link href="/cenik" className="font-semibold text-zeme underline">Prohlédnout ceník</Link>
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-linka/60">
              {ents.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{e.name} <Badge tone={e.kind === "free" ? "gold" : "green"}>{entitlementKindLabel[e.kind]}</Badge></p>
                    <p className="text-sm text-les/60">
                      {e.entriesTotal === null ? "Neomezeně" : `Zbývá ${e.entriesTotal - e.entriesUsed} z ${e.entriesTotal}${e.kind === "solarium" ? " min" : ""}`}
                      {e.weeklyLimit ? ` · max ${e.weeklyLimit}× týdně` : ""} · platí do {formatDate(e.validUntil)}
                      {e.kind === "membership" && " · členství spravuje studio"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {unpaid.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold">Čeká na platbu</h2>
          <ul className="mt-4 divide-y divide-linka/60 rounded-2xl border border-zlato/50 bg-white/60">
            {unpaid.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span>
                  <span className="font-semibold">{o.description}</span>
                  <span className="block text-sm text-les/60">{formatPrice(o.amount)} · VS {o.number}</span>
                </span>
                <ButtonLink href={`/platba/prevod?order=${o.id}`} variant="gold">Zaplatit převodem (QR)</ButtonLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-semibold">Moje nadcházející lekce</h2>
          <Link href="/rozvrh" className="eyebrow text-zeme underline underline-offset-4">Rezervovat další</Link>
        </div>
        <div className="mt-5 space-y-3">
          {upcoming.length === 0 && <Empty>Zatím nemáš žádnou rezervaci. Vyber si lekci v rozvrhu.</Empty>}
          {upcoming.map(({ b, s, ct }) => (
            <Card key={b.id} className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
              <Link href={`/rozvrh/${s.id}`} className="flex items-center gap-4">
                <span className="h-12 w-1 rounded-full" style={{ background: ct.color }} />
                <span>
                  <span className="block font-semibold">{ct.name}</span>
                  <span className="block text-sm text-les/60">
                    {formatDay(s.startsAt)} · {formatRange(s.startsAt, s.durationMin)}
                  </span>
                </span>
              </Link>
              <div className="flex items-center gap-3">
                {b.isHold ? <Badge>{b.seats} {b.seats === 1 ? "místo" : b.seats < 5 ? "místa" : "míst"}</Badge> : b.guestName && <Badge>+1 {b.guestName}</Badge>}
                {b.status === "waitlist" && <Badge tone="gold">Pořadník</Badge>}
                {b.status === "pending_payment" && <Badge tone="gold">Čeká na platbu</Badge>}
                {b.surcharge > 0 && !b.surchargePaidAt && b.status !== "waitlist" && <SurchargePay bookingId={b.id} amount={b.surcharge} compact />}
                {s.status === "cancelled" && <Badge tone="red">Lekce zrušena</Badge>}
                {s.status !== "cancelled" && (
                  <ActionForm action={cancelBookingAction} confirm="Opravdu zrušit rezervaci?">
                    <input type="hidden" name="bookingId" value={b.id} />
                    <SubmitButton variant="ghost" className="px-3 py-2 text-[0.65rem]">Zrušit</SubmitButton>
                  </ActionForm>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {cfg.referralGiftEntries > 0 && user.role === "client" && (
        <section id="pozvi" className="rounded-2xl border border-zlato/50 bg-zlato/10 p-5">
          <p className="font-semibold">👯 Pozvi kamarádku</p>
          <p className="mt-1 max-w-2xl text-sm text-les/70">
            Pošli kamarádce svůj odkaz.{cfg.welcomeFreeEntries > 0 && " Ona má první lekci zdarma"}
            {cfg.welcomeFreeEntries > 0 ? ", a jakmile" : " Jakmile"} si u nás poprvé něco zaplatí, dostaneš{" "}
            {cfg.referralGiftEntries === 1 ? "lekci" : `${cfg.referralGiftEntries} lekce`} zdarma i ty (platí {cfg.referralGiftValidityDays} dní).
          </p>
          <p className="mt-3 break-all text-sm font-semibold text-zeme">{invite}</p>
          <span className="mt-3 flex flex-wrap gap-2">
            <ShareButton url={invite} text="Pojď si se mnou zacvičit do OCTOPUSH – první lekce je zdarma 🐙" className="px-5 py-2.5" />
            <CopyButton text={invite} className="px-5 py-2.5" />
          </span>
          {invited.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm">
              {invited.map((f) => (
                <li key={f.id}>
                  {f.rewarded ? "✅" : "⏳"} <strong>{f.name}</strong> –{" "}
                  {f.rewarded ? "už u nás cvičí, lekce zdarma je na tvém účtu" : "má u nás účet, odměnu dostaneš po prvním nákupu"}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section id="poukazy" className="rounded-2xl border border-linka/60 bg-krem/40 p-5">
        <p className="font-semibold">🎁 Dárkové poukazy</p>
        <ActionForm action={redeemVoucherAction} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex-1">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-les/70">Máš poukaz? Zadej kód</span>
            <Input name="code" placeholder="např. 7KQ4-M2PX" required autoCapitalize="characters" autoComplete="off" className="min-w-48" />
          </label>
          <SubmitButton variant="dark" className="px-5 py-3">Uplatnit</SubmitButton>
        </ActionForm>
        {gifts.length > 0 && (
          <ul className="mt-4 divide-y divide-linka/60 text-sm">
            {gifts.map((v) => {
              const st = voucherStatus(v);
              return (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <strong>{v.title}</strong>
                    {v.recipientName && <span className="font-normal"> · pro: {v.recipientName}</span>}
                    <span className="block text-xs text-les/60">
                      {formatVoucherCode(v.code)} · {VOUCHER_STATUS[st]}
                      {st === "active" && v.validUntil && `, platí do ${formatDate(v.validUntil)}`}
                    </span>
                  </span>
                  {st !== "pending" && (
                    <a href={`/api/poukaz/${v.id}`} className="rounded-full border border-les/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Stáhnout PDF
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-sm text-les/70">
          Chceš někoho obdarovat? <Link href="/poukazy" className="font-semibold text-zeme underline">Koupit dárkový poukaz</Link>
        </p>
      </section>

      <section id="kalendar" className="rounded-2xl border border-linka/60 bg-krem/40 p-5">
        <p className="font-semibold">📅 Lekce v kalendáři v mobilu</p>
        <p className="mt-1 max-w-2xl text-sm text-les/70">
          Přidej si svoje lekce a masáže do kalendáře. Nové rezervace se v něm objeví samy a zrušené zmizí – iPhone kalendář obnovuje zhruba
          každou hodinu, Google kalendář párkrát denně. U Google kalendáře otevři odkaz raději na počítači, v mobilu se pak ukáže sám.
        </p>
        <span className="mt-4 flex flex-wrap gap-2">
          <a href={cal.webcal} className="rounded-full bg-les px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-papir">iPhone a Mac</a>
          <a href={cal.google} target="_blank" rel="noopener" className="rounded-full border border-les/30 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider">Google kalendář ↗</a>
          <a href={cal.outlook} target="_blank" rel="noopener" className="rounded-full border border-les/30 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider">Outlook ↗</a>
          <CopyButton text={cal.https} className="px-5 py-2.5" />
        </span>
        <details className="mt-3 text-xs text-les/60">
          <summary className="cursor-pointer">Poslala jsi odkaz omylem někomu dalšímu?</summary>
          <p className="mt-2">Odkaz je jen tvůj – kdo ho má, uvidí tvoje rezervace. Můžeš si vytvořit nový, starý pak přestane fungovat.</p>
          <ActionForm action={resetCalendarAction} confirm="Vytvořit nový odkaz? Kalendář si pak přidej znovu." className="mt-2">
            <SubmitButton variant="ghost" className="px-3 py-2 text-[0.65rem]">Vytvořit nový odkaz</SubmitButton>
          </ActionForm>
        </details>
      </section>

      {askReview && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-linka/60 bg-krem/40 p-5">
          <p>
            <span className="block font-semibold">Jak se ti u nás líbí?</span>
            <span className="text-sm text-les/70">Máš za sebou už {visits} {visits <= 4 ? "lekce" : "lekcí"} – budeme moc rádi za pár slov. Nejvíc nám pomůže hodnocení na Googlu.</span>
          </p>
          <span className="flex flex-wrap gap-2">
            {google && (
              <a href={google} target="_blank" rel="noopener" className="rounded-full bg-les px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-papir">
                Ohodnotit na Googlu ↗
              </a>
            )}
            <ButtonLink href="/recenze" variant="outline" className="px-5 py-2.5">Napsat recenzi sem</ButtonLink>
          </span>
        </section>
      )}

      {insuranceYrs.length > 0 && (
        <section id="pojistovna" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-linka/60 bg-krem/40 p-5">
          <p className="max-w-2xl">
            <span className="block font-semibold">Potvrzení pro zdravotní pojišťovnu</span>
            <span className="text-sm text-les/70">
              Pojišťovny přispívají na pohyb. Stáhni si potvrzení o zaplaceném cvičení – členství, permanentkách, kreditu i jednotlivých
              lekcích. Platí elektronicky bez razítka, pojišťovna si ho ověří kódem. Když bude chtít razítko a podpis, vytiskni si ho a přines
              do studia. Platby z doby před spuštěním webu v něm nejsou – když je potřebuješ, ozvi se nám.
            </span>
          </p>
          <span className="flex flex-wrap gap-2">
            {user.birthDate ? (
              insuranceYrs.map((y) => (
                <a
                  key={y}
                  href={`/api/potvrzeni?rok=${y}`}
                  className="rounded-full bg-les px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-papir"
                >
                  Stáhnout {y} (PDF)
                </a>
              ))
            ) : (
              <ButtonLink href="/ucet/profil?pojistovna=1#osobni-udaje" variant="outline" className="px-5 py-2.5">
                Doplnit datum narození
              </ButtonLink>
            )}
          </span>
        </section>
      )}

      {massages.length > 0 && (
        <section>
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold">Moje masáže</h2>
            <Link href="/masaze" className="eyebrow text-zeme underline underline-offset-4">Další masáž</Link>
          </div>
          <div className="mt-5 space-y-3">
            {massages.map((m) => (
              <Card key={m.id} className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
                <Link href={`/masaze/rezervace/${m.id}`}>
                  <span className="block font-semibold">{m.serviceName}</span>
                  <span className="block text-sm text-les/60">
                    {formatDay(m.startsAt)} · {formatTime(m.startsAt)} – {formatTime(m.endsAt)}
                  </span>
                </Link>
                <div className="flex items-center gap-3">
                  {m.payment === "pass" ? (
                    <Badge tone="green">Permanentkou</Badge>
                  ) : m.paidAt ? (
                    <Badge tone="green">Zaplaceno</Badge>
                  ) : m.payment === "transfer" ? (
                    <Link href={`/masaze/rezervace/${m.id}`}><Badge tone="gold">Zaplatit</Badge></Link>
                  ) : (
                    <Badge>Platba na místě</Badge>
                  )}
                  <ActionForm action={cancelMassageAction} confirm="Opravdu zrušit masáž?">
                    <input type="hidden" name="bookingId" value={m.id} />
                    <SubmitButton variant="ghost" className="px-3 py-2 text-[0.65rem]">Zrušit</SubmitButton>
                  </ActionForm>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
