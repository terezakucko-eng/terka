import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { userEntitlements } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { credits } from "@/lib/money";
import { qrSvg } from "@/lib/qr-payment";
import { CardSave } from "@/components/card-save";
import { PushToggle } from "@/components/push-toggle";
import { vapidKeys } from "@/lib/push";

export const metadata: Metadata = { title: "Členská karta", robots: { index: false } };

/**
 * Member card for the reception: the QR code opens the client's record in
 * the admin (staff have to be logged in, for anyone else it's a dead link).
 */
export default async function MemberCardPage() {
  const user = await requireUser("/ucet/karta");
  const ents = await userEntitlements(await getDb(), user.id, true);
  const { publicKey } = await vapidKeys(await getDb());
  const qr = await qrSvg(`${site.url}/admin/klienti/${user.id}`);

  return (
    <div className="mx-auto max-w-sm">
      <Link href="/ucet" className="eyebrow text-les/60 hover:text-les">← Můj účet</Link>
      <div className="mt-6 rounded-3xl bg-forest p-6 text-papir shadow-[0_24px_60px_-30px_rgba(21,26,19,.8)]">
        <div className="flex items-center justify-between">
          <span className="font-semibold tracking-[0.25em]">OCTO<span className="text-gold">PUSH</span></span>
          <span className="eyebrow text-papir/50">Členská karta</span>
        </div>
        <div className="mx-auto mt-6 w-52 rounded-2xl bg-white p-3" dangerouslySetInnerHTML={{ __html: qr }} />
        <p className="mt-6 text-center text-xl font-semibold">{user.name}</p>
        <p className="text-center text-sm text-papir/60">s námi od {formatDate(user.createdAt)}</p>
        <ul className="mt-6 space-y-2 border-t border-zlato/20 pt-4 text-sm">
          {ents.map((e) => (
            <li key={e.id} className="flex justify-between gap-3">
              <span>{e.name}</span>
              <span className="text-papir/70">
                {e.entriesTotal === null ? `do ${formatDate(e.validUntil)}` : `zbývá ${e.entriesTotal - e.entriesUsed}`}
              </span>
            </li>
          ))}
          {user.creditBalance > 0 && (
            <li className="flex justify-between gap-3"><span>Kredit</span><span className="text-papir/70">{credits(user.creditBalance)}</span></li>
          )}
          {!ents.length && user.creditBalance <= 0 && <li className="text-papir/60">Zatím žádná permanentka ani kredit.</li>}
        </ul>
      </div>
      <p className="mt-4 text-center text-sm text-les/60">Na recepci ukaž QR kód – načteme tvůj účet.</p>
      <CardSave />
      <div className="mt-4 rounded-2xl border border-linka/60 bg-white/60 p-5">
        <p className="text-sm font-semibold">Upozornění v tomhle zařízení</p>
        <p className="mt-1 text-sm text-les/70">Připomínky lekcí a uvolněná místa z pořadníku ti přijdou jako notifikace. Zapíná se zvlášť v každém zařízení – v mobilu i v počítači.</p>
        <PushToggle publicKey={publicKey} className="mt-3" />
      </div>
    </div>
  );
}
