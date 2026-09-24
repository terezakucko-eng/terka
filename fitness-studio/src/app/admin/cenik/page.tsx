import { asc } from "drizzle-orm";
import { saveProductAction } from "@/app/admin/actions";
import { AdminTitle, Panel } from "@/components/admin";
import { kc } from "@/components/admin-forms";
import { ActionForm, SubmitButton } from "@/components/forms";
import { productKindLabel } from "@/components/labels";
import { Badge, Field, Input, Select, Textarea } from "@/components/ui";
import { getDb } from "@/db";
import { products, type Product } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/money";

function ProductForm({ p }: { p?: Product }) {
  return (
    <ActionForm action={saveProductAction} className="space-y-4">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Typ">
          <Select name="kind" defaultValue={p?.kind ?? "pass"}>
            <option value="credit_pack">Kredit (dobití)</option>
            <option value="pass">Permanentka (N vstupů)</option>
            <option value="membership">Členství</option>
          </Select>
        </Field>
        <Field label="Název"><Input name="name" defaultValue={p?.name} required /></Field>
        <Field label="Cena (Kč)"><Input name="price" inputMode="decimal" defaultValue={kc(p?.price)} required /></Field>
        <Field label="Pořadí"><Input name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} /></Field>
        <Field label="Kreditů" hint="Jen u kreditu"><Input name="credits" type="number" min={1} defaultValue={p?.credits ?? ""} /></Field>
        <Field label="Vstupů" hint="Permanentka; u členství prázdné = neomezeně"><Input name="entries" type="number" min={1} defaultValue={p?.entries ?? ""} /></Field>
        <Field label="Platnost (dny)"><Input name="validityDays" type="number" min={1} defaultValue={p?.validityDays ?? 30} /></Field>
        <Field label="Limit / týden" hint="Jen u členství"><Input name="weeklyLimit" type="number" min={1} defaultValue={p?.weeklyLimit ?? ""} /></Field>
      </div>
      <Field label="Popis"><Textarea name="description" rows={2} defaultValue={p?.description} /></Field>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="recurring" defaultChecked={p?.recurring ?? false} /> Členství se obnovuje měsíčně (předplatné kartou)</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="highlight" defaultChecked={p?.highlight ?? false} /> Zvýraznit</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={p?.isActive ?? true} /> V nabídce</label>
      </div>
      <SubmitButton>Uložit</SubmitButton>
    </ActionForm>
  );
}

export default async function AdminPricing() {
  await requireAdmin();
  const list = await (await getDb()).select().from(products).orderBy(asc(products.sortOrder));
  return (
    <>
      <AdminTitle title="Ceník – kredit, permanentky, členství" />
      <p className="-mt-4 mb-6 max-w-2xl text-sm text-les/60">Ceny jednorázových vstupů se nastavují u typů lekcí (a lze je přepsat u konkrétního termínu). Vstupy zdarma přidělíš v detailu klienta, úvodní vstup zdarma v Nastavení.</p>
      <div className="space-y-3">
        <Panel title="+ Nový produkt"><ProductForm /></Panel>
        {list.map((p) => (
          <Panel key={p.id} title={`${p.name} · ${formatPrice(p.price)} · ${productKindLabel[p.kind]}${p.isActive ? "" : " · skryto"}`}>
            {!p.isActive && <Badge tone="red">Není v nabídce</Badge>}
            <ProductForm p={p} />
          </Panel>
        ))}
      </div>
    </>
  );
}
