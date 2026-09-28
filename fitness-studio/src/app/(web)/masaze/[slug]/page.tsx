import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { bookMassageAction } from "@/app/actions/massages";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ButtonLink, Container, Eyebrow, Field, Textarea, cx } from "@/components/ui";
import { getContent } from "@/content";
import { getDb } from "@/db";
import { activeMassageServices, freeSlotsByDay, isMember, massagePassesFor } from "@/domain/massages";
import { getCurrentUser } from "@/lib/auth";
import { formatDay, formatShortDay, formatTime } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { cardPayments } from "@/lib/payments";
import { nbsp } from "@/lib/typography";

async function load(slug: string) {
  const services = await activeMassageServices(await getDb());
  return services.find((s) => s.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/masaze/[slug]">): Promise<Metadata> {
  const m = await load((await params).slug);
  return m
    ? {
        title: `${m.name} – masáž`,
        description: m.description.replace(/\s+/g, " ").slice(0, 160) || undefined,
        alternates: { canonical: `/masaze/${m.slug}` },
      }
    : {};
}

export default async function MassagePage({ params, searchParams }: PageProps<"/masaze/[slug]">) {
  const { slug } = await params;
  const { den } = await searchParams;
  const service = await load(slug);
  if (!service) notFound();
  const db = await getDb();
  const [byDay, user, c] = await Promise.all([freeSlotsByDay(db, service), getCurrentUser(), getContent()]);
  const member = user && service.memberPrice !== null ? await isMember(db, user.id) : false;
  const passes = user ? await massagePassesFor(db, user.id, service.id, new Date()) : [];
  const passLeft = passes.reduce((n, p) => n + (p.entriesTotal ?? 0) - p.entriesUsed, 0);
  const days = [...byDay.keys()];
  const day = typeof den === "string" && byDay.has(den) ? den : days[0];
  const slots = day ? byDay.get(day)! : [];
  const bankAccount = c("massages.bankAccount").trim();
  const card = cardPayments();
  const here = `/masaze/${slug}${day ? `?den=${day}` : ""}`;

  return (
    <>
      <section className="bg-forest text-papir">
        <Container className="py-10 sm:py-14">
          <Link href="/masaze" className="eyebrow inline-flex items-center gap-2 text-papir/60 hover:text-zlato-light">
            <ArrowLeft className="size-4" /> Všechny masáže
          </Link>
          <Eyebrow className="mt-8 text-zlato">{c("massages.eyebrow") || "Masáž"}</Eyebrow>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">{service.name}</h1>
          <p className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-papir/80">
            <span className="flex items-center gap-2"><Clock className="size-5 text-zlato" /> {service.durationMin} min</span>
            <span className="text-gold text-2xl font-semibold">{formatPrice(service.price)}</span>
            {service.memberPrice !== null && (
              <span className="text-papir/80">pro členy <strong className="text-gold">{formatPrice(service.memberPrice)}</strong></span>
            )}
          </p>
          {member && <p className="mt-3 text-sm text-zlato-light">Máš aktivní členství – platíš cenu pro členy.</p>}
          {service.description && <p className="mt-6 max-w-2xl whitespace-pre-line text-papir/75">{nbsp(service.description)}</p>}
        </Container>
      </section>

      <Container className="py-12">
        <h2 className="text-2xl font-semibold">Vyber si termín</h2>
        {days.length === 0 ? (
          <p className="mt-4 max-w-xl text-les/70">{c("massages.noSlots")}</p>
        ) : (
          <>
            <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {days.map((d) => (
                <Link
                  key={d}
                  href={`/masaze/${slug}?den=${d}`}
                  scroll={false}
                  className={cx(
                    "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition",
                    d === day ? "border-les bg-les text-papir" : "border-linka hover:border-les",
                  )}
                >
                  {formatShortDay(byDay.get(d)![0])}
                </Link>
              ))}
            </div>

            <ActionForm action={bookMassageAction} className="mt-8 max-w-3xl space-y-8">
              <input type="hidden" name="serviceId" value={service.id} />
              <fieldset>
                <legend className="eyebrow text-zeme">{formatDay(slots[0])}</legend>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {slots.map((s, i) => (
                    <label key={s.toISOString()} className="cursor-pointer">
                      <input type="radio" name="slot" value={s.toISOString()} defaultChecked={i === 0} className="peer sr-only" required />
                      <span className="block rounded-xl border border-linka py-3 text-center font-semibold tabular-nums transition peer-checked:border-les peer-checked:bg-les peer-checked:text-papir peer-focus-visible:ring-2 peer-focus-visible:ring-zlato hover:border-les">
                        {formatTime(s)}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="eyebrow text-zeme">Platba</legend>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {passes.length > 0 && (
                    <PayOption value="pass" title="Permanentkou" sub={`Strhne se 1 vstup (zbývá ${passLeft})`} checked />
                  )}
                  {card && <PayOption value="card" title="Kartou online" sub="Zaplatíš hned po rezervaci" checked={passes.length === 0} />}
                  {bankAccount && <PayOption value="transfer" title="Převodem" sub="Údaje a QR kód hned po rezervaci" checked={passes.length === 0 && !card} />}
                  {!card && !bankAccount && <PayOption value="on_site" title="Na místě" sub="Při návštěvě" checked={passes.length === 0} />}
                </div>
              </fieldset>

              <Field label="Poznámka (nepovinné)" hint="Např. na co se zaměřit, zdravotní omezení…">
                <Textarea name="note" rows={3} />
              </Field>

              {user ? (
                <SubmitButton variant="gold">Rezervovat masáž</SubmitButton>
              ) : (
                <div className="rounded-2xl bg-krem/60 p-5">
                  <p className="text-les/80">Pro rezervaci se přihlas nebo si založ účet – zabere to minutu.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <ButtonLink href={`/prihlaseni?next=${encodeURIComponent(here)}`}>Přihlásit</ButtonLink>
                    <ButtonLink href={`/registrace?next=${encodeURIComponent(here)}`} variant="outline">Založit účet</ButtonLink>
                  </div>
                </div>
              )}
            </ActionForm>
          </>
        )}
      </Container>
    </>
  );
}

function PayOption({ value, title, sub, checked }: { value: string; title: string; sub: string; checked?: boolean }) {
  return (
    <label className="cursor-pointer">
      <input type="radio" name="payment" value={value} defaultChecked={checked} className="peer sr-only" />
      <span className="block rounded-xl border border-linka p-4 transition peer-checked:border-les peer-checked:bg-krem/60 hover:border-les">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-les/60">{sub}</span>
      </span>
    </label>
  );
}
