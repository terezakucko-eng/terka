import Link from "next/link";
import { whatsappLink } from "@/lib/phone";
import { and, count, desc, eq, ilike, isNotNull, or } from "drizzle-orm";
import { deleteAllClientsAction, deleteClientsAction } from "@/app/admin/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { AdminTitle, Panel, Table, Td } from "@/components/admin";
import { Badge, Field, Input, Select } from "@/components/ui";
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
  const [[all], [imported]] = await Promise.all([
    db.select({ n: count() }).from(users).where(eq(users.role, "client")),
    db.select({ n: count() }).from(users).where(and(eq(users.role, "client"), isNotNull(users.importedAt))),
  ]);

  return (
    <>
      <AdminTitle title="Klienti">
        <form className="flex gap-2">
          <Input name="q" defaultValue={term} placeholder="Jméno, e-mail, telefon…" className="w-64" />
        </form>
      </AdminTitle>
      <p className="-mt-4 mb-6 text-sm text-les/60">
        Klientů celkem: <strong>{all.n}</strong> (z toho převzatých ze starého systému: {imported.n})
      </p>
      <ActionForm
        action={deleteClientsAction}
        confirm="Natrvalo smazat zaškrtnuté klienty i se vším (rezervace, permanentky, kredit, platby)?"
        className="space-y-3"
      >
        <Table head={["", "Jméno", "E-mail", "Telefon", "Kredit", "Role", "Registrace"]}>
          {list.map((u) => (
            <tr key={u.id}>
              <Td>
                {u.role === "client" && (
                  <input type="checkbox" name="ids" value={u.id} aria-label={`Vybrat ${u.name}`} className="size-4" />
                )}
              </Td>
              <Td><Link href={`/admin/klienti/${u.id}`} className="font-semibold text-zeme underline-offset-4 hover:underline">{u.name}</Link></Td>
              <Td>{u.email}</Td>
              <Td className="whitespace-nowrap">
                {u.phone ?? "—"}
                {whatsappLink(u.phone) && (
                  <a href={whatsappLink(u.phone)!} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs font-semibold text-zeme underline">
                    WhatsApp
                  </a>
                )}
              </Td>
              <Td className="tabular-nums">{u.creditBalance}</Td>
              <Td>{u.role !== "client" && <Badge tone="dark">{u.role === "admin" ? "Admin" : "Lektor"}</Badge>}</Td>
              <Td>{formatDate(u.createdAt)}</Td>
            </tr>
          ))}
        </Table>
        <SubmitButton variant="ghost" className="text-chyba">Smazat zaškrtnuté klienty</SubmitButton>
      </ActionForm>
      <p className="mt-3 text-xs text-les/50">Zobrazeno max. 100 záznamů – použij hledání.</p>

      <div className="mt-10">
        <Panel title="Smazat všechny klienty">
          <ActionForm
            action={deleteAllClientsAction}
            confirm="Opravdu natrvalo smazat klienty? Tohle nejde vrátit."
            className="space-y-4"
            resetOnSuccess
          >
            <p className="text-sm text-les/70">
              Smaže klientské účty i se vším, co k nim patří (rezervace, permanentky, kredit, platby, masáže).
              Účty adminů a lektorů zůstanou. Hodí se před novým importem.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Koho">
                <Select name="scope" defaultValue="all">
                  <option value="all">Všechny klienty ({all.n})</option>
                  <option value="imported">Jen převzaté ze starého systému ({imported.n})</option>
                </Select>
              </Field>
              <Field label="Pro potvrzení napiš SMAZAT">
                <Input name="confirm" autoComplete="off" required />
              </Field>
            </div>
            <SubmitButton variant="danger">Smazat klienty</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
