import Link from "next/link";
import { cancelBookingAction, cancelMembershipAction } from "@/app/actions/booking";
import { ActionForm, SubmitButton } from "@/components/forms";
import { entitlementKindLabel } from "@/components/labels";
import { Badge, ButtonLink, Card, Empty, Eyebrow } from "@/components/ui";
import { getDb } from "@/db";
import { userBookings, userEntitlements } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDay, formatRange } from "@/lib/dates";
import { credits } from "@/lib/money";

export default async function AccountPage({ searchParams }: PageProps<"/ucet">) {
  const { vitej } = await searchParams;
  const user = await requireUser("/ucet");
  const db = await getDb();
  const [upcoming, ents] = await Promise.all([
    userBookings(db, user.id, "upcoming"),
    userEntitlements(db, user.id, true),
  ]);

  return (
    <div className="space-y-12">
      {vitej && (
        <p className="rounded-2xl bg-forest p-6 text-papir">
          <span className="text-gold text-xl font-semibold">Vítej v OCTOPUSH!</span>
          <br />
          Na účtu máš připravenou úvodní lekci zdarma. <Link href="/rozvrh" className="underline">Vyber si ji v rozvrhu →</Link>
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="bg-les text-papir">
          <Eyebrow className="text-zlato">Kredit</Eyebrow>
          <p className="text-gold mt-3 text-5xl font-light">{user.creditBalance}</p>
          <p className="mt-1 text-sm text-papir/60">{credits(user.creditBalance).replace(/^\d+ /, "")} k dispozici</p>
          <ButtonLink href="/cenik" variant="outline-light" className="mt-6 px-4 py-2">Dobít</ButtonLink>
        </Card>
        <Card className="md:col-span-2">
          <Eyebrow className="text-zeme">Permanentky a členství</Eyebrow>
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
                      {e.entriesTotal === null ? "Neomezeně" : `Zbývá ${e.entriesTotal - e.entriesUsed} z ${e.entriesTotal}`}
                      {e.weeklyLimit ? ` · max ${e.weeklyLimit}× týdně` : ""} · platí do {formatDate(e.validUntil)}
                      {e.subscriptionId && (e.renewalCancelled ? " · obnovení zrušeno" : " · obnovuje se automaticky")}
                    </p>
                  </div>
                  {e.subscriptionId && !e.renewalCancelled && (
                    <ActionForm action={cancelMembershipAction} confirm="Opravdu zrušit automatické obnovení členství?">
                      <input type="hidden" name="entitlementId" value={e.id} />
                      <SubmitButton variant="ghost" className="px-3 py-2 text-[0.65rem]">Zrušit obnovení</SubmitButton>
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section>
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-semibold">Moje nadcházející lekce</h2>
          <Link href="/rozvrh" className="eyebrow text-zeme underline underline-offset-4">Rezervovat další</Link>
        </div>
        <div className="mt-5 space-y-3">
          {upcoming.length === 0 && <Empty>Zatím nemáš žádnou rezervaci. Vyber si lekci v rozvrhu.</Empty>}
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
                {b.status === "waitlist" && <Badge tone="gold">Pořadník</Badge>}
                {b.status === "pending_payment" && <Badge tone="gold">Čeká na platbu</Badge>}
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
    </div>
  );
}
