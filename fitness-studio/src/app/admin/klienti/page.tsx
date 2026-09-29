import Link from "next/link";
import { whatsappLink } from "@/lib/phone";
import { and, count, eq, gt, ilike, isNotNull, lte, or, sql } from "drizzle-orm";
import { clientsBulkAction, deleteAllClientsAction } from "@/app/admin/actions";
import { SelectAll } from "@/components/select-all";
import { ActionForm, SubmitButton } from "@/components/forms";
import { AdminTitle, Panel, Table, Td } from "@/components/admin";
import { Badge, Field, Input, Select } from "@/components/ui";
import { getDb } from "@/db";
import { entitlements, pushSubscriptions, users } from "@/db/schema";
import { DEVICE_TAGS, SORTS, TAGS, sortClients, splitName, type Sort, type Tag } from "@/lib/client-list";
import { Bell, CalendarClock, CreditCard, Mail, Smartphone } from "lucide-react";

const isDeviceTag = (t: Tag): t is (typeof DEVICE_TAGS)[number] => (DEVICE_TAGS as readonly string[]).includes(t);
const DEVICE_ICONS = { push: Bell, card: CreditCard, app: Smartphone, reminders: CalendarClock, newsletter: Mail } as const;
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/dates";

export default async function ClientsPage({ searchParams }: PageProps<"/admin/klienti">) {
  await requireAdmin();
  const { q, razeni, stitek } = await searchParams;
  const term = typeof q === "string" ? q.trim() : "";
  const sort: Sort = typeof razeni === "string" && razeni in SORTS ? (razeni as Sort) : "prijmeni";
  const tag: Tag | null = typeof stitek === "string" && stitek in TAGS ? (stitek as Tag) : null;
  const db = await getDb();
  const now = new Date();
  const like = `%${term.replace(/[%_]/g, "")}%`;
  const [rows, ents, pushRows] = await Promise.all([
    db
      .select()
      .from(users)
      .where(term ? or(ilike(users.name, like), ilike(users.email, like), ilike(users.phone, like)) : undefined),
    db
      .selectDistinct({ userId: entitlements.userId, kind: entitlements.kind })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.status, "active"),
          lte(entitlements.validFrom, now),
          gt(entitlements.validUntil, now),
          sql`(${entitlements.entriesTotal} is null or ${entitlements.entriesUsed} < ${entitlements.entriesTotal})`,
        ),
      ),
    db.selectDistinct({ userId: pushSubscriptions.userId }).from(pushSubscriptions),
  ]);
  const withPush = new Set(pushRows.map((r) => r.userId));
  const kinds = new Map<string, Set<string>>();
  for (const e of ents) kinds.set(e.userId, (kinds.get(e.userId) ?? new Set()).add(e.kind));
  const tagsOf = (u: (typeof rows)[number]): Tag[] => {
    const k = kinds.get(u.id) ?? new Set();
    return (Object.keys(TAGS) as Tag[]).filter((t) =>
      t === "credit" ? u.creditBalance > 0
      : t === "paused" ? !!u.bookingPausedUntil && u.bookingPausedUntil > now
      : t === "noPassword" ? u.role === "client" && u.passwordHash.startsWith("!")
      : t === "push" ? withPush.has(u.id)
      : t === "card" ? !!u.cardSavedAt
      : t === "app" ? !!u.appInstalledAt
      : t === "reminders" ? u.remindersOptIn
      : t === "newsletter" ? u.marketingConsent
      : k.has(t),
    );
  };
  const withTags = rows.map((u) => ({ ...u, tags: tagsOf(u) }));
  const tagCounts = new Map((Object.keys(TAGS) as Tag[]).map((t) => [t, withTags.filter((u) => u.tags.includes(t)).length]));
  const list = sortClients(tag ? withTags.filter((u) => u.tags.includes(tag)) : withTags, sort);
  const [[all], [imported]] = await Promise.all([
    db.select({ n: count() }).from(users).where(eq(users.role, "client")),
    db.select({ n: count() }).from(users).where(and(eq(users.role, "client"), isNotNull(users.importedAt))),
  ]);
  const href = (p: { razeni?: string; stitek?: string | null }) => {
    const sp = new URLSearchParams();
    if (term) sp.set("q", term);
    const r = p.razeni ?? sort;
    if (r !== "prijmeni") sp.set("razeni", r);
    const st = p.stitek === undefined ? tag : p.stitek;
    if (st) sp.set("stitek", st);
    const qs = sp.toString();
    return `/admin/klienti${qs ? `?${qs}` : ""}`;
  };
  const sortHead = (key: Sort) => (
    <Link href={href({ razeni: key })} className={sort === key ? "text-les underline underline-offset-4" : "hover:text-les"}>
      {SORTS[key]}{sort === key ? " ↓" : ""}
    </Link>
  );

  return (
    <>
      <AdminTitle title="Klienti">
        <form className="flex gap-2">
          <Input name="q" defaultValue={term} placeholder="Jméno, e-mail, telefon…" className="w-64" />
          {sort !== "prijmeni" && <input type="hidden" name="razeni" value={sort} />}
          {tag && <input type="hidden" name="stitek" value={tag} />}
        </form>
      </AdminTitle>
      <p className="-mt-4 mb-4 text-sm text-les/60">
        Klientů celkem: <strong>{all.n}</strong> (z toho převzatých ze starého systému: {imported.n})
        {(term || tag) && <> · zobrazeno <strong>{list.length}</strong></>}
      </p>
      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        <Link href={href({ stitek: null })} className={`rounded-full border px-3 py-1.5 font-semibold ${!tag ? "border-les bg-les text-papir" : "border-linka hover:border-les"}`}>
          Všichni
        </Link>
        {(Object.keys(TAGS) as Tag[]).map((t) => (
          <Link key={t} href={href({ stitek: tag === t ? null : t })} className={`rounded-full border px-3 py-1.5 font-semibold ${tag === t ? "border-les bg-les text-papir" : "border-linka hover:border-les"}`}>
            {TAGS[t]} <span className="opacity-60">{tagCounts.get(t)}</span>
          </Link>
        ))}
      </div>
      <ActionForm action={clientsBulkAction} className="space-y-4">
        <Table head={[<SelectAll key="all" />, sortHead("prijmeni"), sortHead("jmeno"), "Štítky", "E-mail", "Telefon", sortHead("kredit"), sortHead("registrace")]}>
          {list.map((u) => (
            <tr key={u.id}>
              <Td>
                {u.role === "client" && (
                  <input type="checkbox" name="ids" value={u.id} aria-label={`Vybrat ${u.name}`} className="size-4" />
                )}
              </Td>
              <Td><Link href={`/admin/klienti/${u.id}`} className="font-semibold text-zeme underline-offset-4 hover:underline">{splitName(u.name).last || "—"}</Link></Td>
              <Td><Link href={`/admin/klienti/${u.id}`} className="text-zeme underline-offset-4 hover:underline">{splitName(u.name).first}</Link></Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {u.role !== "client" && <Badge tone="dark">{u.role === "admin" ? "Admin" : "Lektor"}</Badge>}
                  {u.tags.filter((t) => !isDeviceTag(t)).map((t) => (
                    <Badge key={t} tone={t === "membership" ? "green" : t === "paused" ? "red" : t === "noPassword" ? "neutral" : "gold"}>{TAGS[t]}</Badge>
                  ))}
                  {u.tags.some(isDeviceTag) && (
                    <span className="inline-flex items-center gap-1 text-zeme">
                      {u.tags.filter(isDeviceTag).map((t) => {
                        const Icon = DEVICE_ICONS[t];
                        return <Icon key={t} className="size-3.5" aria-label={TAGS[t]}><title>{TAGS[t]}</title></Icon>;
                      })}
                    </span>
                  )}
                </div>
              </Td>
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
              <Td>{formatDate(u.createdAt)}</Td>
            </tr>
          ))}
        </Table>
        <div className="rounded-2xl border border-linka bg-white/60 p-5">
          <h2 className="font-semibold">Přidělit zaškrtnutým klientům</h2>
          <p className="mt-1 text-sm text-les/60">Tip: nahoře vyfiltruj štítkem nebo vyhledej, pak zaškrtni všechny v záhlaví tabulky.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Co">
              <Select name="kind" defaultValue="membership">
                <option value="membership">Členství</option>
                <option value="pass">Permanentka</option>
                <option value="free">Vstup zdarma</option>
              </Select>
            </Field>
            <Field label="Název" hint="Prázdné = podle typu"><Input name="name" placeholder="např. Členství 12 měsíců" /></Field>
            <Field label="Vstupů" hint="Jen u permanentky / vstupu zdarma"><Input name="entries" type="number" min={1} /></Field>
            <Field label="Platí do"><Input name="until" type="date" /></Field>
            <Field label="Poznámka"><Input name="note" placeholder="např. převod ze starého systému" /></Field>
          </div>
          <SubmitButton name="do" value="grant" className="mt-4" data-confirm="Přidělit vybraným klientům?">Přidělit zaškrtnutým</SubmitButton>
        </div>
        <SubmitButton name="do" value="delete" variant="ghost" className="text-chyba" data-confirm="Natrvalo smazat zaškrtnuté klienty i se vším (rezervace, permanentky, kredit, platby)?">
          Smazat zaškrtnuté klienty
        </SubmitButton>
      </ActionForm>

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
