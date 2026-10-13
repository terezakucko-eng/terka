import Link from "next/link";
import { cancelVoucherAction, issueVoucherAction } from "@/app/admin/voucher-actions";
import { AdminTitle, Table, Td } from "@/components/admin";
import { ClientSelect } from "@/components/client-select";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card } from "@/components/ui";
import { VoucherFields } from "@/components/voucher-fields";
import { getDb } from "@/db";
import { VOUCHER_AMOUNTS, VOUCHER_STATUS, adminVouchers, formatVoucherCode, giftableProducts, voucherContents, voucherStatus } from "@/domain/vouchers";
import { audienceOptions } from "@/lib/admin-options";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";

const tone = { active: "green", pending: "gold", redeemed: "neutral", expired: "red", cancelled: "red" } as const;

export default async function AdminVouchers() {
  await requireAdmin();
  const db = await getDb();
  const [list, products, { clients }] = await Promise.all([adminVouchers(db), giftableProducts(db), audienceOptions(db)]);
  const now = new Date();
  const sold = list.filter(({ v }) => v.paidAt && !v.cancelledAt);
  const open = sold.filter(({ v }) => voucherStatus(v, now) === "active");

  return (
    <>
      <AdminTitle title="Dárkové poukazy">
        <span className="text-sm text-les/60">
          Prodáno {sold.length} za {formatPrice(sold.reduce((n, { v }) => n + v.amount, 0))} · neuplatněných {open.length} · klienti je kupují na{" "}
          <Link href="/poukazy" className="underline">/poukazy</Link>
        </span>
      </AdminTitle>

      <Card className="max-w-3xl">
        <h2 className="font-semibold">Vystavit poukaz na recepci</h2>
        <p className="mt-1 text-xs text-les/60">Když je už zaplaceno (hotově, převodem). Poukaz bude hned platný – stáhneš ho v seznamu a vytiskneš.</p>
        <ActionForm action={issueVoucherAction} className="mt-5 space-y-5">
          <VoucherFields products={products.map((p) => ({ id: p.id, name: p.name, price: p.price, description: "" }))} amounts={VOUCHER_AMOUNTS} />
          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-les/70">Kupující (nepovinné)</span>
            <ClientSelect name="client" clients={clients} />
            <p className="mt-1 text-xs text-les/60">Když ho vybereš, uvidí poukaz i ve svém účtu. Jinak se prodej zapíše pod tvůj účet.</p>
          </div>
          <SubmitButton>Vystavit poukaz</SubmitButton>
        </ActionForm>
      </Card>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Všechny poukazy</h2>
        {list.length === 0 ? (
          <p className="text-sm text-les/50">Zatím žádný poukaz.</p>
        ) : (
          <Table head={["Kód", "Co", "Kupující", "Stav", "Uplatnil/a", ""]}>
            {list.map(({ v, buyer, buyerId, redeemer, redeemerId }) => {
              const st = voucherStatus(v, now);
              return (
                <tr key={v.id}>
                  <Td className="whitespace-nowrap font-mono">{formatVoucherCode(v.code)}</Td>
                  <Td>
                    {voucherContents(v)}
                    {v.recipientName && <span className="block text-xs text-les/60">pro: {v.recipientName}</span>}
                    <span className="block text-xs text-les/50">{formatPrice(v.amount)} · {formatDate(v.createdAt)}</span>
                  </Td>
                  <Td>{buyerId ? <Link href={`/admin/klienti/${buyerId}`} className="underline">{buyer}</Link> : "—"}</Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={tone[st]}>{VOUCHER_STATUS[st]}</Badge>
                    {st === "active" && v.validUntil && <span className="block text-xs text-les/60">do {formatDate(v.validUntil)}</span>}
                  </Td>
                  <Td>
                    {redeemerId ? <Link href={`/admin/klienti/${redeemerId}`} className="underline">{redeemer}</Link> : "—"}
                    {v.redeemedAt && <span className="block text-xs text-les/60">{formatDate(v.redeemedAt)}</span>}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {st !== "pending" && st !== "cancelled" && (
                      <a href={`/api/poukaz/${v.id}`} className="text-xs font-semibold text-zeme underline">PDF</a>
                    )}
                    {(st === "active" || st === "pending" || st === "expired") && (
                      <ActionForm action={cancelVoucherAction} confirm="Zrušit poukaz? Kód pak nepůjde uplatnit." className="mt-1">
                        <input type="hidden" name="id" value={v.id} />
                        <SubmitButton variant="ghost" className="px-2 py-1 text-[0.6rem]">Zrušit</SubmitButton>
                      </ActionForm>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </section>
    </>
  );
}
