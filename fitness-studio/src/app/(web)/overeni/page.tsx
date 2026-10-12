import type { Metadata } from "next";
import { getContent } from "@/content";
import { Button, Card, Container, Field, Input } from "@/components/ui";
import { getDb } from "@/db";
import { findConfirmation, formatCode, normalizeCode } from "@/domain/insurance";
import { formatDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";

export const metadata: Metadata = { title: "Ověření potvrzení pro pojišťovnu", robots: { index: false } };

const czDate = (key: string) => key.split("-").reverse().map(Number).join(". ");

/** Public check of a confirmation for the health insurance company (code from the PDF or its QR code). */
export default async function VerifyPage({ searchParams }: PageProps<"/overeni">) {
  const { kod } = await searchParams;
  const code = typeof kod === "string" ? normalizeCode(kod) : "";
  const [row, c] = await Promise.all([code ? findConfirmation(await getDb(), code) : null, getContent()]);

  return (
    <Container className="max-w-xl py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Ověření potvrzení</h1>
      <p className="mt-3 text-les/70">
        Potvrzení o úhradě pohybových aktivit pro zdravotní pojišťovnu vystavuje {c.raw("site.companyName")} (IČO {c.raw("site.ico")}) elektronicky.
        Zadejte kód z dokladu – ukážeme, co jsme skutečně vystavili.
      </p>

      <form action="/overeni" className="mt-8 flex items-end gap-3">
        <div className="flex-1">
          <Field label="Kód potvrzení">
            <Input name="kod" defaultValue={code ? formatCode(code) : ""} placeholder="např. 7KQ4-M2PX" autoComplete="off" required className="uppercase" />
          </Field>
        </div>
        <Button type="submit">Ověřit</Button>
      </form>

      {code &&
        (row ? (
          <Card className="mt-8 border-[#3f7a4a]/40 bg-[#3f7a4a]/5">
            <p className="font-semibold text-[#2f6a3a]">✓ Potvrzení {formatCode(row.code)} je pravé</p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-les/60">Klient</dt>
              <dd className="font-semibold">{row.name}</dd>
              {row.birthDate && (
                <>
                  <dt className="text-les/60">Datum narození</dt>
                  <dd className="font-semibold">{czDate(row.birthDate)}</dd>
                </>
              )}
              <dt className="text-les/60">Rok</dt>
              <dd className="font-semibold">{row.year}</dd>
              <dt className="text-les/60">Celkem uhrazeno</dt>
              <dd className="font-semibold">{formatPrice(row.total)} ({row.payments} {row.payments === 1 ? "platba" : row.payments <= 4 ? "platby" : "plateb"})</dd>
              <dt className="text-les/60">Vystaveno</dt>
              <dd className="font-semibold">{formatDate(row.createdAt)}</dd>
            </dl>
            <p className="mt-4 text-xs text-les/60">Údaje musí souhlasit s předloženým dokladem.</p>
          </Card>
        ) : (
          <Card className="mt-8 border-[#e5372f]/40 bg-[#e5372f]/5">
            <p className="font-semibold text-[#b3261e]">Potvrzení s tímto kódem jsme nevystavili.</p>
            <p className="mt-2 text-sm text-les/70">Zkontrolujte, prosím, kód. Při pochybnostech nás kontaktujte na {c.raw("site.email")}.</p>
          </Card>
        ))}
    </Container>
  );
}
