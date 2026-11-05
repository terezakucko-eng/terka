import Link from "next/link";
import { santaGivenAction } from "@/app/admin/fee-actions";
import { AdminTitle, Table, Td } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Empty } from "@/components/ui";
import { getDb } from "@/db";
import { EARLY_BIRD, earlyBookingList } from "@/domain/early-bird";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";

/** Admin → Dárky členům: who signed up for 2027 in time – Fitness Ježíšek's list and the Reformer gift. */
export default async function AdminMemberGifts() {
  await requireAdmin();
  const list = await earlyBookingList(await getDb());
  const santa = list.filter((r) => r.santa);
  const rest = list.filter((r) => !r.santa);
  const row = (r: (typeof list)[number]) => (
    <tr key={r.b.id}>
      <Td>
        <Link href={`/admin/klienti/${r.b.userId}`} className="font-semibold underline">{r.name}</Link>
        <br />
        <span className="text-xs text-les/50">{r.email}</span>
      </Td>
      <Td label="Členství">{r.membership ?? "—"}</Td>
      <Td label="Přihlášeno">{formatDateTime(r.b.signedUpAt)}</Td>
      <Td label="Reformer bez doplatku">{r.used === null ? "—" : `využito ${r.used} z ${EARLY_BIRD.entries}`}</Td>
      {r.santa && (
        <Td label="Dárek od Ježíška">
          <ActionForm action={santaGivenAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={r.b.id} />
            {r.b.santaGivenAt ? (
              <>
                <Badge tone="green">Předáno {formatDate(r.b.santaGivenAt)}</Badge>
                <SubmitButton name="given" value="0" variant="ghost" className="px-2 py-1 text-[0.6rem]">Vrátit</SubmitButton>
              </>
            ) : (
              <SubmitButton name="given" value="1" variant="outline" className="px-3 py-1.5 text-[0.65rem]">Předáno</SubmitButton>
            )}
          </ActionForm>
        </Td>
      )}
    </tr>
  );

  return (
    <>
      <AdminTitle title="Dárky členům 2027">
        <span className="text-sm text-les/60">
          Nová členství se závazkem s počátkem od 1. 11. 2026 do 1. 1. 2027 (i v předprodeji) – {list.length} celkem · Fitness Ježíšek (přihlášení do 30. 11.):{" "}
          {santa.length}, předáno {santa.filter((r) => r.b.santaGivenAt).length}
        </span>
      </AdminTitle>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">🎅 Fitness Ježíšek – přihlášení do 30. 11. 2026</h2>
        {santa.length ? (
          <Table head={["Klient", "Členství", "Přihlášeno", "Reformer bez doplatku", "Dárek od Ježíška"]}>{santa.map(row)}</Table>
        ) : (
          <Empty>Zatím nikdo.</Empty>
        )}
      </section>
      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold">🎁 Přihlášení v prosinci – jen {EARLY_BIRD.entries}× Reformer bez doplatku</h2>
        {rest.length ? <Table head={["Klient", "Členství", "Přihlášeno", "Reformer bez doplatku"]}>{rest.map(row)}</Table> : <Empty>Zatím nikdo.</Empty>}
      </section>
    </>
  );
}
