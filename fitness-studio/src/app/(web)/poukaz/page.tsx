import type { Metadata } from "next";
import Link from "next/link";
import { redeemVoucherAction } from "@/app/actions/vouchers";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, ButtonLink, Card, Container, Eyebrow, Field, Input } from "@/components/ui";
import { getDb } from "@/db";
import { VOUCHER_STATUS, formatVoucherCode, voucherByCode, voucherContents, voucherStatus } from "@/domain/vouchers";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Uplatnit dárkový poukaz", robots: { index: false } };

/** Check a gift voucher by its code (the QR on the voucher leads here) and redeem it. */
export default async function RedeemPage({ searchParams }: PageProps<"/poukaz">) {
  const { kod } = await searchParams;
  const code = typeof kod === "string" ? kod : "";
  const [user, v] = await Promise.all([getCurrentUser(), code ? voucherByCode(await getDb(), code) : null]);
  const status = v ? voucherStatus(v) : null;
  const next = `/poukaz?kod=${encodeURIComponent(code)}`;

  return (
    <Container className="max-w-xl py-16">
      <Eyebrow className="text-zeme">🎁 Dárkový poukaz</Eyebrow>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Uplatnit poukaz</h1>
      {v ? (
        <Card className="mt-8">
          <p className="text-sm text-les/60">Poukaz {formatVoucherCode(v.code)}</p>
          <p className="mt-1 text-2xl font-semibold">{voucherContents(v)}</p>
          {v.recipientName && <p className="mt-1 text-les/70">Pro: {v.recipientName}</p>}
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={status === "active" ? "green" : status === "pending" ? "gold" : "red"}>{VOUCHER_STATUS[status!]}</Badge>
            {status === "active" && v.validUntil && <span className="text-les/60">platí do {formatDate(v.validUntil)}</span>}
          </p>
          {status === "redeemed" && user && v.redeemedBy === user.id && (
            <div className="mt-6 rounded-xl bg-salvej/15 p-4">
              <p className="font-semibold">Hotovo! 🎁 Poukaz je uplatněný na tvém účtu.</p>
              <ButtonLink href="/ucet" variant="dark" className="mt-3">Můj účet</ButtonLink>
              <ButtonLink href="/rozvrh" variant="outline" className="ml-2 mt-3">Rozvrh</ButtonLink>
            </div>
          )}
          {status === "active" &&
            (user ? (
              <ActionForm action={redeemVoucherAction} className="mt-6">
                <input type="hidden" name="code" value={v.code} />
                <SubmitButton variant="gold">Uplatnit na můj účet</SubmitButton>
              </ActionForm>
            ) : (
              <div className="mt-6">
                <p className="text-sm text-les/70">Poukaz se připíše na tvůj účet na webu. Přihlas se, nebo si účet založ – zabere to minutku.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ButtonLink href={`/prihlaseni?next=${encodeURIComponent(next)}`}>Přihlásit se</ButtonLink>
                  <ButtonLink href={`/registrace?next=${encodeURIComponent(next)}`} variant="outline">Založit účet</ButtonLink>
                </div>
              </div>
            ))}
        </Card>
      ) : (
        code && <p className="mt-6 rounded-xl bg-chyba/10 p-4 text-sm text-chyba">Poukaz s tímhle kódem neznáme. Zkontroluj prosím, že je opsaný správně.</p>
      )}
      <Card className="mt-8">
        <form action="/poukaz" className="space-y-3">
          <Field label="Kód poukazu" hint="Najdeš ho na poukazu, např. 7KQ4-M2PX.">
            <Input name="kod" defaultValue={v ? formatVoucherCode(v.code) : code} required autoCapitalize="characters" autoComplete="off" />
          </Field>
          <button type="submit" className="rounded-full bg-les px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-papir">Ověřit poukaz</button>
        </form>
      </Card>
      <p className="mt-6 text-sm text-les/60">
        Chceš někoho obdarovat? <Link href="/poukazy" className="underline">Koupit dárkový poukaz</Link>
      </p>
    </Container>
  );
}
