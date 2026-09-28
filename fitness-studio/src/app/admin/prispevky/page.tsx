import Link from "next/link";
import { createFeesAction, remindFeeAction } from "@/app/admin/fee-actions";
import { markOrderPaidAction } from "@/app/admin/actions";
import { AdminTitle, Stat, Table, Td } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card, Field, Input } from "@/components/ui";
import { getDb } from "@/db";
import { currentPeriod, feeOverview, isPeriod, periodLabel, shiftPeriod } from "@/domain/membership-fees";
import { requireAdmin } from "@/lib/auth";
import { sortClients, splitName } from "@/lib/client-list";
import { formatDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { getSettings } from "@/lib/settings";

const statusBadge = {
  paid: <Badge tone="green">Zaplaceno</Badge>,
  pending: <Badge tone="gold">Čeká na platbu</Badge>,
  none: <Badge tone="red">Bez výzvy</Badge>,
  auto: <Badge>Kartou automaticky</Badge>,
};

export default async function FeesPage({ searchParams }: PageProps<"/admin/prispevky">) {
  await requireAdmin();
  const { mesic, jen } = await searchParams;
  const period = typeof mesic === "string" && isPeriod(mesic) ? mesic : shiftPeriod(currentPeriod(), 1);
  const onlyUnpaid = jen === "nezaplaceno";
  const db = await getDb();
  const [{ rows, totals }, cfg] = await Promise.all([feeOverview(db, period), getSettings(db)]);
  const list = sortClients(
    rows.map((r) => ({ ...r, createdAt: new Date(0), creditBalance: 0 })),
    "prijmeni",
  ).filter((r) => !onlyUnpaid || r.status === "pending" || r.status === "none");
  const href = (p: string, unpaid = onlyUnpaid) => `/admin/prispevky?mesic=${p}${unpaid ? "&jen=nezaplaceno" : ""}`;

  return (
    <>
      <AdminTitle title="Členské příspěvky">
        <div className="flex items-center gap-3 text-sm">
          <Link href={href(shiftPeriod(period, -1))} className="rounded-full border border-linka px-3 py-1.5 hover:border-les">←</Link>
          <span className="min-w-36 text-center font-semibold capitalize">{periodLabel(period)}</span>
          <Link href={href(shiftPeriod(period, 1))} className="rounded-full border border-linka px-3 py-1.5 hover:border-les">→</Link>
        </div>
      </AdminTitle>
      <p className="-mt-4 mb-6 max-w-3xl text-sm text-les/60">
        Každý člen má za měsíc jednu výzvu k platbě (QR převod nebo karta).{" "}
        {cfg.membershipMonthlyFee > 0
          ? `Výzvy za další měsíc odcházejí automaticky ${cfg.membershipFeeNoticeDay}. dne v měsíci (výchozí částka ${cfg.membershipMonthlyFee} Kč, individuální částky podle člena).`
          : "Automatické výzvy jsou vypnuté – zapneš je v Nastavení vyplněním měsíčního příspěvku."}{" "}
        Platbu převodem potvrdíš tlačítkem Zaplaceno.
      </p>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Členů" value={totals.members} />
        <Stat label="Zaplaceno" value={totals.paid} sub={formatPrice(totals.collected)} />
        <Stat label="Čeká na platbu" value={totals.pending} />
        <Stat label="Bez výzvy" value={totals.none} sub={`očekáváno ${formatPrice(totals.expected)}`} />
      </div>

      <Card className="mt-6">
        <h2 className="font-semibold">Vytvořit výzvy za {periodLabel(period)}</h2>
        <p className="mt-1 text-sm text-les/60">Jen pro členy, kteří za tento měsíc výzvu ještě nemají. Člen s vlastní částkou dostane svou částku (sleva se počítá i z ní).</p>
        <ActionForm action={createFeesAction} className="mt-4 flex flex-wrap items-end gap-4">
          <input type="hidden" name="period" value={period} />
          <Field label="Částka (Kč)"><Input name="amount" type="number" min={1} defaultValue={cfg.membershipMonthlyFee || undefined} className="w-32" required /></Field>
          <Field label="Sleva (%)"><Input name="discount" type="number" min={0} max={100} defaultValue={0} className="w-24" /></Field>
          <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" name="send" defaultChecked className="size-4" /> poslat e-mail s výzvou</label>
          <SubmitButton data-confirm={`Vytvořit výzvy k platbě za ${periodLabel(period)}?`}>Vytvořit výzvy</SubmitButton>
        </ActionForm>
      </Card>

      <div className="mb-3 mt-8 flex flex-wrap gap-2 text-xs">
        <Link href={href(period, false)} className={`rounded-full border px-3 py-1.5 font-semibold ${!onlyUnpaid ? "border-les bg-les text-papir" : "border-linka hover:border-les"}`}>Všichni</Link>
        <Link href={href(period, true)} className={`rounded-full border px-3 py-1.5 font-semibold ${onlyUnpaid ? "border-les bg-les text-papir" : "border-linka hover:border-les"}`}>
          Nezaplacení <span className="opacity-60">{totals.pending + totals.none}</span>
        </Link>
      </div>
      <Table head={["Příjmení", "Jméno", "Částka", "Stav", "Zaplaceno", ""]}>
        {list.map((r) => (
          <tr key={r.userId}>
            <Td><Link href={`/admin/klienti/${r.userId}`} className="font-semibold text-zeme underline-offset-4 hover:underline">{splitName(r.name).last || "—"}</Link></Td>
            <Td>{splitName(r.name).first}</Td>
            <Td className="whitespace-nowrap tabular-nums">{r.amount !== null ? formatPrice(r.amount) : "výchozí"}</Td>
            <Td>{statusBadge[r.status]}{r.order && r.status === "pending" && <span className="ml-2 text-xs text-les/50">VS {r.order.number}</span>}</Td>
            <Td className="whitespace-nowrap text-xs">
              {r.status === "paid" && r.order?.paidAt && <>{formatDate(r.order.paidAt)} · {r.order.provider === "stripe" ? "kartou" : r.order.provider === "transfer" ? "převodem" : "ručně"}</>}
            </Td>
            <Td className="text-right">
              <div className="flex flex-wrap justify-end gap-3">
                {r.status === "pending" && r.order && (
                  <>
                    <ActionForm action={markOrderPaidAction} confirm={`${r.name}: potvrdit, že příspěvek dorazil?`}>
                      <input type="hidden" name="orderId" value={r.order.id} />
                      <button className="text-xs font-semibold text-zeme underline">Zaplaceno</button>
                    </ActionForm>
                    <ActionForm action={remindFeeAction} confirm={`Poslat ${r.name} připomínku e-mailem?`}>
                      <input type="hidden" name="orderId" value={r.order.id} />
                      <button className="text-xs font-semibold text-les/70 underline">Připomenout</button>
                    </ActionForm>
                  </>
                )}
                {r.status === "none" && (
                  <ActionForm action={createFeesAction} confirm={`Vytvořit ${r.name} výzvu a poslat e-mail?`}>
                    <input type="hidden" name="period" value={period} />
                    <input type="hidden" name="userId" value={r.userId} />
                    <input type="hidden" name="amount" value={cfg.membershipMonthlyFee} />
                    <button className="text-xs font-semibold text-zeme underline">Výzva</button>
                  </ActionForm>
                )}
              </div>
            </Td>
          </tr>
        ))}
        {list.length === 0 && <tr><Td className="text-les/50">{onlyUnpaid ? "Všichni mají zaplaceno. 🎉" : "V tomto měsíci nemá nikdo aktivní členství."}</Td></tr>}
      </Table>
    </>
  );
}
