import { asc, isNull } from "drizzle-orm";
import { deleteProductAction, saveProductAction } from "@/app/admin/actions";
import { AdminTitle, Panel } from "@/components/admin";
import { kc } from "@/components/admin-forms";
import { ActionForm, SubmitButton } from "@/components/forms";
import { productKindLabel } from "@/components/labels";
import { Badge, Field, Input, Select, Textarea } from "@/components/ui";
import { getDb } from "@/db";
import { massageServices, products, type MassageService, type Product } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { site } from "@/config/site";

function ProductForm({ p, services }: { p?: Product; services: MassageService[] }) {
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
        <Field label="Platnost (dny)" hint="U kreditu: od posledního dobití · prázdné = nepropadá"><Input name="validityDays" type="number" min={1} defaultValue={p ? (p.validityDays ?? "") : 30} /></Field>
        <Field label="Limit / týden" hint="Jen u členství"><Input name="weeklyLimit" type="number" min={1} defaultValue={p?.weeklyLimit ?? ""} /></Field>
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
  const [list, services] = await Promise.all([
    db.select().from(products).where(isNull(products.archivedAt)).orderBy(asc(products.sortOrder)),
    db.select().from(massageServices).where(isNull(massageServices.archivedAt)).orderBy(asc(massageServices.sortOrder)),
  ]);
  return (
    <>
      <AdminTitle title="Ceník – kredit, permanentky, členství" />
      <p className="-mt-4 mb-6 max-w-2xl text-sm text-les/60">Ceny jednorázových vstupů se nastavují u typů lekcí (a lze je přepsat u konkrétního termínu). Vstupy zdarma přidělíš v detailu klienta, úvodní vstup zdarma v Nastavení.</p>
      <div className="space-y-3">
        <Panel title="+ Nový produkt"><ProductForm services={services} /></Panel>
        {list.map((p) => (
          <Panel key={p.id} title={`${p.name} · ${formatPrice(p.price)} · ${productKindLabel[p.kind]}${p.isActive ? (p.linkOnly ? " · jen přes odkaz" : "") : " · skryto"}`}>
            {!p.isActive && <Badge tone="red">Není v nabídce</Badge>}
            <ProductForm p={p} services={services} />
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
