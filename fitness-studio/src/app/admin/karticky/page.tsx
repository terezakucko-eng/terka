import Link from "next/link";
import { addPassCardAction, togglePassCardAction } from "@/app/admin/pass-card-actions";
import { AdminTitle } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card } from "@/components/ui";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { lessonsFree, listPassCards } from "@/domain/pass-cards";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { pluralCs } from "@/lib/money";
import { qrSvg } from "@/lib/qr-payment";
import { getSettings } from "@/lib/settings";

const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

export default async function AdminPassCards() {
  await requireAdmin();
  const db = await getDb();
  const [cards, cfg] = await Promise.all([listPassCards(db), getSettings(db)]);
  const qrs = await Promise.all(cards.map((c) => qrSvg(`${site.url}/karticka/${c.code}`)));
  const people = cards.reduce((n, c) => n + c.chain.length, 0);
  const free = lessonsFree(Math.max(cfg.welcomeFreeEntries, cfg.passCardFreeEntries));

  return (
    <>
      <AdminTitle title="Pošli to dál">
        <a href="/api/karticky" className="rounded-full bg-les px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-papir">
          Všechny k tisku (PDF)
        </a>
        <ActionForm action={addPassCardAction}>
          <SubmitButton variant="ghost" className="px-5 py-2.5 text-xs">Přidat kartičku</SubmitButton>
        </ActionForm>
      </AdminTitle>
      <p className="-mt-4 mb-8 max-w-3xl text-sm text-les/70">
        Vytištěné kartičky s QR kódem putují od člověka k člověku. Kdo se přes kartičku zaregistruje, dostane {free} (počet změníš v{" "}
        <Link href="/admin/nastaveni" className="underline">Nastavení</Link>) a kartička je pak u něj – předá ji dál. Zatím přes kartičky
        přišlo {pluralCs(people, "člověk", "lidi", "lidí")}. PDF má spadávku 3 mm (vizitka 85 × 55 mm) – rovnou pro tiskárnu.
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
                <p className="mt-2">{c.isActive ? <Badge tone="green">Ve hře</Badge> : <Badge tone="red">Mimo hru</Badge>}</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dataUri(qrs[i])} alt={`QR kód ${c.label}`} className="h-24 w-24 shrink-0 rounded-lg" />
            </div>
            <p className="text-sm">
              Teď je u:{" "}
              {c.holderId ? (
                <Link href={`/admin/klienti/${c.holderId}`} className="font-semibold underline">{c.holderName}</Link>
              ) : (
                <span className="text-les/60">zatím ji nikdo nepoužil (u tebe nebo u prvního držitele)</span>
              )}
            </p>
            {c.chain.length > 0 && (
              <ol className="space-y-1 border-l-2 border-zlato/50 pl-4 text-sm">
                {c.chain.map((u) => (
                  <li key={u.userId}>
                    <span className="text-les/50">{formatDate(u.at)}</span>{" "}
                    <Link href={`/admin/klienti/${u.userId}`} className="font-semibold underline">{u.name}</Link>
                    {u.fromName && <span className="text-les/60"> od {u.fromName}</span>}
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-auto flex flex-wrap items-center gap-2">
              <a href={`/api/karticky?id=${c.id}`} className="text-xs font-semibold text-zeme underline">PDF k tisku</a>
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
