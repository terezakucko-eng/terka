"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/money";
import { Field, Input, Textarea } from "./ui";

const pick =
  "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 border-linka bg-white/60 px-4 py-3 text-sm font-semibold transition has-[:checked]:border-zlato has-[:checked]:bg-zlato/15";

type GiftProduct = { id: string; name: string; price: number; description: string };

/** What to give (a price-list item or an amount), for whom and a message – inside a voucher form. */
export function VoucherFields({ products, amounts }: { products: GiftProduct[]; amounts: number[] }) {
  const [item, setItem] = useState(products[0]?.id ?? `amount-${amounts[1] ?? amounts[0]}`);
  const radio = (value: string) => ({
    type: "radio" as const,
    name: "item",
    value,
    checked: item === value,
    onChange: () => setItem(value),
    className: "sr-only",
  });
  return (
    <>
      {products.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-les/70">Z ceníku</legend>
          <div className="grid gap-2">
            {products.map((p) => (
              <label key={p.id} className={pick}>
                <input {...radio(p.id)} />
                <span>
                  {p.name}
                  {p.description && <span className="block text-xs font-normal text-les/60">{p.description}</span>}
                </span>
                <span className="shrink-0">{formatPrice(p.price)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-les/70">Na částku</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {amounts.map((kc) => (
            <label key={kc} className={pick}>
              <input {...radio(`amount-${kc}`)} />
              <span className="w-full text-center">{formatPrice(kc * 100)}</span>
            </label>
          ))}
        </div>
        <label className={`${pick} mt-2`}>
          <input {...radio("amount-custom")} />
          <span>Jiná částka</span>
          <span className="flex items-center gap-2">
            <Input
              name="customKc"
              type="number"
              min={200}
              max={20000}
              step={50}
              placeholder="800"
              className="w-28 py-2 text-right"
              onFocus={() => setItem("amount-custom")}
            />
            Kč
          </span>
        </label>
      </fieldset>
      <Field label="Pro koho" hint="Nepovinné – jméno se vytiskne na poukaz.">
        <Input name="recipientName" maxLength={60} placeholder="např. Jana" />
      </Field>
      <Field label="Věnování" hint="Nepovinné – krátký vzkaz na poukaz (nejvýš 200 znaků).">
        <Textarea name="message" rows={3} maxLength={200} placeholder="Všechno nejlepší k narozeninám!" />
      </Field>
    </>
  );
}
