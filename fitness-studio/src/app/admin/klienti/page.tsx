import Link from "next/link";
import { desc, ilike, or } from "drizzle-orm";
import { AdminTitle, Table, Td } from "@/components/admin";
import { Badge, Input } from "@/components/ui";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";

export default async function ClientsPage({ searchParams }: PageProps<"/admin/klienti">) {
  await requireAdmin();
  const { q } = await searchParams;
  const term = typeof q === "string" ? q.trim() : "";
  const db = await getDb();
  const like = `%${term.replace(/[%_]/g, "")}%`;
  const list = await db
    .select()
    .from(users)
    .where(term ? or(ilike(users.name, like), ilike(users.email, like), ilike(users.phone, like)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(100);

  return (
    <>
      <AdminTitle title="Klienti">
        <form className="flex gap-2">
          <Input name="q" defaultValue={term} placeholder="Jméno, e-mail, telefon…" className="w-64" />
        </form>
      </AdminTitle>
      <Table head={["Jméno", "E-mail", "Telefon", "Kredit", "Role", "Registrace"]}>
        {list.map((u) => (
          <tr key={u.id}>
            <Td><Link href={`/admin/klienti/${u.id}`} className="font-semibold text-zeme underline-offset-4 hover:underline">{u.name}</Link></Td>
            <Td>{u.email}</Td>
            <Td>{u.phone ?? "—"}</Td>
            <Td className="tabular-nums">{u.creditBalance}</Td>
            <Td>{u.role !== "client" && <Badge tone="dark">{u.role === "admin" ? "Admin" : "Lektor"}</Badge>}</Td>
            <Td>{formatDate(u.createdAt)}</Td>
          </tr>
        ))}
      </Table>
      <p className="mt-3 text-xs text-les/50">Zobrazeno max. 100 záznamů – použij hledání.</p>
    </>
  );
}
