import { asc, isNull } from "drizzle-orm";
import { deleteProductAction, saveProductAction } from "@/app/admin/actions";
import { AdminTitle, Panel } from "@/components/admin";
import { kc } from "@/components/admin-forms";
import { ActionForm, SubmitButton } from "@/components/forms";
import { productKindLabel } from "@/components/labels";
import { Badge, Field, Input, Select, Textarea } from "@/components/ui";
import { getDb } from "@/db";
import { classTypes, massageServices, products, type MassageService, type Product } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { dateKey, formatDate } from "@/lib/dates";
import { site } from "@/config/site";

function ProductForm({ p, services, types, limited }: { p?: Product; services: MassageService[]; types: { id: string; name: string }[]; limited: Product[] }) {
  return (
    <ActionForm action={saveProductAction} className="space-y-4">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Typ">
          <Select name="kind" defaultValue={p?.kind ?? "pass"}>
            <option value="credit_pack">Kredit (dobití)</option>
            <option value="pass">Permanentka (N vstupů)</option>
            <option value="membership">Členství</option>
            <option value="solarium">Solárium (minuty)</option>
            <option value="massage_pass">Permanentka na masáže</option>
          </Select>
        </Field>
        <Field label="Název"><Input name="name" defaultValue={p?.name} required /></Field>
        <Field label="Cena (Kč)"><Input name="price" inputMode="decimal" defaultValue={kc(p?.price)} required /></Field>
        <Field label="Pořadí"><Input name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} /></Field>
        <Field label="Kreditů" hint="Jen u kreditu"><Input name="credits" type="number" min={1} defaultValue={p?.credits ?? ""} /></Field>
        <Field label="Vstupů / minut" hint="Permanentka: vstupy · Masáže: počet masáží · Solárium: minuty · Členství: prázdné = neomezeně"><Input name="entries" type="number" min={1} defaultValue={p?.entries ?? ""} /></Field>
        <Field label="Platnost (dny)" hint="U kreditu: od posledního dobití · prázdné = nepropadá · členství zaplacené jednorázově platí vždy 365 dní"><Input name="validityDays" type="number" min={1} defaultValue={p ? (p.validityDays ?? "") : 30} /></Field>
        <Field label="Limit / týden" hint="Jen u členství"><Input name="weeklyLimit" type="number" min={1} defaultValue={p?.weeklyLimit ?? ""} /></Field>
        <Field label="Závazek (měsíců)" hint="Jen u členství · 0 = bez závazku (zruší si ho v účtu ke konci měsíce)"><Input name="commitmentMonths" type="number" min={0} defaultValue={p?.commitmentMonths ?? 12} /></Field>
        <Field label="Lekce v ceně" hint="Jen u členství · bez doplatku (např. Reformer)">
          <Select name="includedClassTypeId" defaultValue={p?.includedClassTypeId ?? ""}>
            <option value="">Žádné</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="…kolik měsíčně" hint="Za kalendářní měsíc, nevyčerpané se nepřevádí"><Input name="includedPerMonth" type="number" min={0} defaultValue={p?.includedPerMonth ?? 0} /></Field>
        <Field label="Omezený počet členství" hint="Jen u členství · nejvýš tolik platných členství najednou · prázdné = bez limitu"><Input name="maxActive" type="number" min={1} defaultValue={p?.maxActive ?? ""} /></Field>
        <Field label="Jen na lekci" hint="Jen u permanentky · 1 vstup = 1 lekce, přednostní rezervace jako s členstvím (např. Permanentka Reformer)">
          <Select name="classTypeId" defaultValue={p?.classTypeId ?? ""}>
            <option value="">Na kteroukoli lekci</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Bere místo z" hint="Jen u permanentky · každá platná permanentka ubere 1 místo z omezeného členství, vyčerpaná ho vrátí">
          <Select name="sharesPlacesWith" defaultValue={p?.sharesPlacesWith ?? ""}>
            <option value="">Nebere</option>
            {limited.map((m) => (
              <option key={m.id} value={m.id}>{m.name} (max. {m.maxActive})</option>
            ))}
          </Select>
        </Field>
        <Field label="V prodeji od" hint="Ceník na další rok (např. 1. 1. 2027) · prázdné = hned"><Input name="saleFrom" type="date" defaultValue={p?.saleFrom ? dateKey(p.saleFrom) : ""} /></Field>
        <Field label="Předprodej od" hint="Koupit jde už od tohoto dne, platit začne až od „V prodeji od“ · prázdné = bez předprodeje"><Input name="presaleFrom" type="date" defaultValue={p?.presaleFrom ? dateKey(p.presaleFrom) : ""} /></Field>
        <Field label="V prodeji do" hint="Den, kdy se prodej ukončí (např. 1. 1. 2027) · prázdné = bez konce"><Input name="saleUntil" type="date" defaultValue={p?.saleUntil ? dateKey(p.saleUntil) : ""} /></Field>
        <Field label="Na masáž" hint="Jen u permanentky na masáže">
          <Select name="massageServiceId" defaultValue={p?.massageServiceId ?? ""}>
            <option value="">Kterákoli masáž</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Popis"><Textarea name="description" rows={2} defaultValue={p?.description} /></Field>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="recurring" defaultChecked={p?.recurring ?? false} /> Členství se obnovuje měsíčně (předplatné kartou)</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="highlight" defaultChecked={p?.highlight ?? false} /> Zvýraznit</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={p?.isActive ?? true} /> V nabídce</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="membersOnly" defaultChecked={p?.membersOnly ?? false} /> Online jen pro členy</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="studentsOnly" defaultChecked={p?.studentsOnly ?? false} /> Studentská cena (koupí jen ověřený student – „Student do“ v kartě klienta)</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="linkOnly" defaultChecked={p?.linkOnly ?? false} /> Jen přes odkaz (nezobrazovat v ceníku)</label>
      </div>
      {p?.linkOnly && p.isActive && (
        <p className="rounded-xl bg-krem/60 p-3 text-sm">
          Odkaz pro vybrané klienty: <code className="select-all break-all font-semibold">{`${site.url}/cenik/${p.id}`}</code>
        </p>
      )}
      <SubmitButton>Uložit</SubmitButton>
    </ActionForm>
  );
}

export default async function AdminPricing() {
  await requireAdmin();
  const db = await getDb();
  const [list, services, types] = await Promise.all([
    db.select().from(products).where(isNull(products.archivedAt)).orderBy(asc(products.sortOrder)),
    db.select().from(massageServices).where(isNull(massageServices.archivedAt)).orderBy(asc(massageServices.sortOrder)),
    db.select({ id: classTypes.id, name: classTypes.name }).from(classTypes).orderBy(asc(classTypes.sortOrder), asc(classTypes.name)),
  ]);
  const limited = list.filter((p) => p.kind === "membership" && p.maxActive !== null);
  return (
    <>
      <AdminTitle title="Ceník – kredit, permanentky, členství" />
      <p className="-mt-4 mb-6 max-w-2xl text-sm text-les/60">Ceny jednorázových vstupů se nastavují u typů lekcí (a lze je přepsat u konkrétního termínu). Vstupy zdarma přidělíš v detailu klienta, úvodní vstup zdarma v Nastavení.</p>
      <div className="space-y-3">
        <Panel title="+ Nový produkt"><ProductForm services={services} types={types} limited={limited} /></Panel>
        {list.map((p) => (
          <Panel key={p.id} title={`${p.name} · ${formatPrice(p.price)} · ${productKindLabel[p.kind]}${p.isActive ? (p.linkOnly ? " · jen přes odkaz" : "") : " · skryto"}${p.saleFrom ? ` · v prodeji od ${formatDate(p.saleFrom)}` : ""}${p.presaleFrom && p.saleFrom ? ` (předprodej od ${formatDate(p.presaleFrom)})` : ""}${p.saleUntil ? ` · do ${formatDate(p.saleUntil)}` : ""}`}>
            {!p.isActive && <Badge tone="red">Není v nabídce</Badge>}
            <ProductForm p={p} services={services} types={types} limited={limited.filter((m) => m.id !== p.id)} />
            <ActionForm
              action={deleteProductAction}
              confirm={`Opravdu smazat „${p.name}“ z ceníku? Kdo ho už koupil, má ho dál platný.`}
              className="mt-4 border-t border-linka/60 pt-4"
            >
              <input type="hidden" name="id" value={p.id} />
              <button className="text-xs font-semibold text-chyba underline">Smazat produkt</button>
            </ActionForm>
          </Panel>
        ))}
      </div>
    </>
  );
}
