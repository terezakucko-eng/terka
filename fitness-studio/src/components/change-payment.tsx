"use client";

import { useEffect, useState } from "react";
import { changePaymentAction, changePaymentOptionsAction } from "@/app/admin/actions";
import type { BookingOption } from "@/domain/booking";
import { ActionForm, SubmitButton } from "./forms";
import { Select } from "./ui";

const value = (o: BookingOption) => `${o.method}:${o.entitlementId ?? ""}`;

/**
 * Reception: "Změnit platbu" – another way the booked client pays (their passes,
 * membership, free entries, credit – or nothing, admins only). What it cost
 * comes back as on an in-time cancel, the place stays.
 */
export function ChangePayment({ bookingId, allowFree }: { bookingId: string; allowFree: boolean }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<BookingOption[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    changePaymentOptionsAction(bookingId).then((o) => alive && setOpts(o));
    return () => {
      alive = false;
    };
  }, [open, bookingId]);

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1 block text-xs font-semibold text-zeme underline">
        💱 Změnit platbu
      </button>
    );

  const usable = (opts ?? []).filter((o) => !o.disabled);
  return (
    <ActionForm
      action={changePaymentAction}
      confirm="Změnit platbu? Původní se vrátí jako při včasném stornu (vstup, kredit; nezaplacený převod se zruší) a strhne se nová. Místo na lekci zůstává."
      className="mt-2 space-y-2 rounded-xl border border-linka/60 bg-white/70 p-3 text-left"
    >
      <input type="hidden" name="bookingId" value={bookingId} />
      <Select name="pay" key={opts ? "loaded" : "loading"} defaultValue={usable[0] ? value(usable[0]) : allowFree ? "admin" : ""} className="py-2 text-sm">
        {opts === null && <option value="">Načítám…</option>}
        {opts?.map((o) => (
          <option key={value(o)} value={value(o)} disabled={!!o.disabled}>
            {o.label} – {o.disabled ?? o.detail}
          </option>
        ))}
        {allowFree && <option value="admin">Bez platby (zaplaceno na místě / host)</option>}
      </Select>
      {opts !== null && usable.length === 0 && !allowFree && <p className="text-xs text-chyba">Klient nemá čím jiným zaplatit.</p>}
      <div className="flex items-center gap-3">
        <SubmitButton className="px-4 py-2 text-xs" disabled={opts === null || (!usable.length && !allowFree)}>
          Změnit
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-les/60 underline">
          Zpět
        </button>
      </div>
    </ActionForm>
  );
}
