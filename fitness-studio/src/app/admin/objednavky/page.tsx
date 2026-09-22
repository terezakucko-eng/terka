import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { markOrderPaidAction } from "@/app/admin/actions";
import { AdminTitle, Table, Td } from "@/components/admin";
import { ActionForm } from "@/components/forms";
import { orderStatusLabel } from "@/components/labels";
import { Badge } from "@/components/ui";
import { getDb } from "@/db";
import { orders, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { formatPrice } from "@/lib/money";

export default async function OrdersPage() {
  await requireAdmin();
  const list = await (await getDb())
    .select({ o: orders, u: users })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .orderBy(desc(orders.createdAt))
    .limit(200);

  return (
    <>
      <AdminTitle title="Platby a objednávky" />
      <Table head={["Č.", "Datum", "Klient", "Položka", "Částka", "Způsob", "Stav", ""]}>
        {list.map(({ o, u }) => (
          <tr key={o.id}>
            <Td>{o.number}</Td>
            <Td className="whitespace-nowrap">{formatDateTime(o.createdAt)}</Td>
            <Td><Link href={`/admin/klienti/${u.id}`} className="underline-offset-4 hover:underline">{u.name}</Link></Td>
            <Td>{o.description}</Td>
            <Td className="whitespace-nowrap tabular-nums">{formatPrice(o.amount)}</Td>
            <Td>{{ stripe: "Karta online", reception: "Recepce", manual: "Ručně", test: "Test" }[o.provider] ?? o.provider}</Td>
            <Td><Badge tone={o.status === "paid" ? "green" : o.status === "pending" ? "gold" : "neutral"}>{orderStatusLabel[o.status]}</Badge></Td>
            <Td>
              {o.status === "pending" && o.kind === "product" && (
                <ActionForm action={markOrderPaidAction} confirm="Označit jako zaplacené a připsat klientovi?">
                  <input type="hidden" name="orderId" value={o.id} />
                  <button className="text-xs font-semibold text-zeme underline">Zaplaceno</button>
                </ActionForm>
              )}
            </Td>
          </tr>
        ))}
      </Table>
      <p className="mt-3 text-xs text-les/50">Posledních 200 objednávek. Vrácení peněz za online platby se provádí v administraci Stripe.</p>
    </>
  );
}
