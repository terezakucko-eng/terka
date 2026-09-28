"use client";

import { useEffect, useRef } from "react";

export type TypeDefault = { id: string; capacity: number; durationMin: number; creditCost: number; dropInPrice: number | null };

/**
 * Fills capacity, duration and prices of the surrounding form from the chosen
 * class type – on load and whenever the type changes. Values stay editable.
 */
export function TypeDefaults({ types }: { types: TypeDefault[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    const select = form?.querySelector<HTMLSelectElement>('select[name="classTypeId"]');
    if (!form || !select) return;
    const set = (name: string, v: string) => {
      const input = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      if (input) input.value = v;
    };
    const fill = () => {
      const t = types.find((x) => x.id === select.value);
      if (!t) return;
      set("capacity", String(t.capacity));
      set("durationMin", String(t.durationMin));
      set("creditCost", String(t.creditCost));
      set("dropInPrice", t.dropInPrice === null ? "" : String(t.dropInPrice / 100));
    };
    fill();
    select.addEventListener("change", fill);
    return () => select.removeEventListener("change", fill);
  }, [types]);
  return <span ref={ref} hidden />;
}
