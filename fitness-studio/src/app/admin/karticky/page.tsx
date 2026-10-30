import Link from "next/link";
import { addPassCardAction, chargePassCardAction, renewPassCardAction, resetPassCardAction, togglePassCardAction } from "@/app/admin/pass-card-actions";
import { AdminTitle } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card } from "@/components/ui";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { listPassCards } from "@/domain/pass-cards";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDay, formatTime } from "@/lib/dates";
import { pluralCs } from "@/lib/money";
import { qrSvg } from "@/lib/qr-payment";

const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

export default async function AdminPassCards() {
  await requireAdmin();
  const db = await getDb();
  const cards = await listPassCards(db);
  const now = new Date();
  const qrs = await Promise.all(cards.map((c) => qrSvg(`${site.url}/karticka/${c.code}`)));
  const people = cards.reduce((n, c) => n + c.chain.length, 0);

  return (
    <>
      <AdminTitle title="Pošli to dál">
        <a href="/api/karticky?arch=a4" className="rounded-full bg-les px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-papir">
          Tisk na A4 – oboustranně (PDF)
        </a>
        <a href="/api/karticky" className="rounded-full border border-les px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-les">
          Pro tiskárnu karet (PDF)
        </a>
        <ActionForm action={addPassCardAction}>
          <SubmitButton variant="ghost" className="px-5 py-2.5 text-xs">Přidat kartičku</SubmitButton>
        </ActionForm>
      </AdminTitle>
      <p className="-mt-4 mb-8 max-w-3xl text-sm text-les/70">
        Plastové kartičky s QR kódem putují od člověka k člověku. 🔋 Nabitá kartička má <strong>2 místa</strong> – pro dva nové klienty
        (typicky kamarádky). Každý se přes ni zaregistruje, dostane místo úvodní lekce lekci zdarma na 14 dní a u rezervace ji zaplatí
        „Kartičkou Pošli to dál“ (stávající klienti tu možnost nevidí). Jakmile jsou obě místa obsazená – nebo první klikne v účtu „Přijdu
        sama“ – kartička má hned zase 2 místa a putuje dál. Kartička platí měsíc od posledního použití (nová od prvního naskenování) – když ji
        nikdo nevyužije, propadne a tady ji můžeš obnovit. Když se s kartičkou cokoli zasekne, tlačítko „Resetovat“ ji vrátí na začátek: je ve hře, má 2 místa a měsíc se jí začne počítat od dalšího naskenování (kdo už přes ni přišel, v přehledu zůstane). O registraci, rezervaci i propadnutí ti přijde upozornění do mobilu.
        Zatím přes kartičky přišlo {pluralCs(people, "člověk", "lidi", "lidí")}. Tisk na A4: 10 kartiček na list, tiskni oboustranně s otočením podél dlouhé hrany a v měřítku 100 % (skutečná velikost), pak stříhej podle značek. Když zadní strana na tiskárně ujíždí, nastav posun v Nastavení (Tisk). PDF pro tiskárnu karet je ve formátu platební karty 85,6 × 54 mm se spadávkou 3 mm.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {cards.map((c, i) => (
          <Card key={c.id} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {c.label} <span className="font-mono text-sm text-les/60">{c.code}</span>
                </h2>
                <a href={`/karticka/${c.code}`} target="_blank" className="break-all text-xs text-zeme underline">
                  {site.url.replace(/^https?:\/\//, "")}/karticka/{c.code}
                </a>
                <p className="mt-2 flex flex-wrap gap-2">
                  {c.isActive ? <Badge tone="green">Ve hře</Badge> : <Badge tone="red">Mimo hru</Badge>}
                  <Badge tone="gold">{c.placesLeft === 1 ? "🔋 Zbývá 1 místo" : "🔋 Nabitá – 2 místa"}</Badge>
                  <Badge tone="neutral">
                    📱 {c.scans.n ? `Naskenovaná ${c.scans.n}×${c.scans.last ? ` · naposledy ${formatDate(c.scans.last)}` : ""}` : "Zatím nenaskenovaná"}
                  </Badge>
                  {c.isActive &&
                    (c.validUntil && c.validUntil <= now ? (
                      <Badge tone="red">⌛ Propadla {formatDate(c.validUntil)}</Badge>
                    ) : c.validUntil ? (
                      <Badge tone="neutral">Platí do {formatDate(c.validUntil)}</Badge>
                    ) : (
                      <Badge tone="neutral">Měsíc začne prvním naskenováním</Badge>
                    ))}
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dataUri(qrs[i])} alt={`QR kód ${c.label}`} className="h-24 w-24 shrink-0 rounded-lg" />
            </div>
            {c.chain.length > 0 && (
              <ol className="space-y-1 border-l-2 border-zlato/50 pl-4 text-sm">
                {c.chain.map((u) => (
                  <li key={u.userId}>
                    <span className="text-les/50">{formatDate(u.at)}</span>{" "}
                    <Link href={`/admin/klienti/${u.userId}`} className="font-semibold underline">{u.name}</Link>
                    {u.fromName && <span className="text-les/60"> od {u.fromName}</span>}
                    <span className="block text-xs text-les/60">
                      {u.lesson
                        ? `${u.lesson.endsAt <= now ? (u.lesson.status === "no_show" ? "nedorazil/a na" : "byl/a na") : "jde na"} ${u.lesson.name} ${formatDay(u.lesson.startsAt)} ${formatTime(u.lesson.startsAt)}`
                        : u.validUntil && u.validUntil <= now
                          ? "vstup propadl"
                          : `zatím bez rezervace${u.validUntil ? ` (platí do ${formatDate(u.validUntil)})` : ""}`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-auto flex flex-wrap items-center gap-2">
              <a href={`/api/karticky?id=${c.id}`} className="text-xs font-semibold text-zeme underline">PDF k tisku</a>
              {c.isActive && c.validUntil && c.validUntil <= now && (
                <ActionForm action={renewPassCardAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton variant="ghost" className="px-3 py-1.5 text-[0.65rem]">Obnovit na měsíc</SubmitButton>
                </ActionForm>
              )}
              {c.placesLeft < 2 && (
                <ActionForm action={chargePassCardAction} confirm="Uvolnit druhé místo a nabít kartičku hned na 2 místa? Normálně se nabije sama, jakmile se zaregistruje kamarádka.">
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton variant="ghost" className="px-3 py-1.5 text-[0.65rem]">Nabít ručně</SubmitButton>
                </ActionForm>
              )}
              <ActionForm
                action={resetPassCardAction}
                confirm="Resetovat kartičku? Bude ve hře, nabitá na 2 místa a měsíc se jí začne počítat od dalšího naskenování. Když teď na volné místo čeká kamarádka, to místo propadne. Kdo už přes kartičku přišel, v přehledu zůstane."
              >
                <input type="hidden" name="id" value={c.id} />
                <SubmitButton variant="ghost" className="px-3 py-1.5 text-[0.65rem]">Resetovat</SubmitButton>
              </ActionForm>
              <ActionForm
                action={togglePassCardAction}
                confirm={c.isActive ? "Vyřadit kartičku ze hry? Registrace přes ni pak lekce navíc nedá." : undefined}
              >
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="active" value={c.isActive ? "0" : "1"} />
                <SubmitButton variant="ghost" className="px-3 py-1.5 text-[0.65rem]">
                  {c.isActive ? "Ztratila se – vyřadit" : "Vrátit do hry"}
                </SubmitButton>
              </ActionForm>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
