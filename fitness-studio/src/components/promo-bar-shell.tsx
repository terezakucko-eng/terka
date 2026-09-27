"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

const KEY = "octopush-promo-closed";

/** Closable wrapper; remembers the closed bar (per text) in the browser. */
export function PromoBarShell({ id, children }: { id: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser-only storage after hydration
      if (localStorage.getItem(KEY) === id) setOpen(false);
    } catch {}
  }, [id]);
  if (!open) return null;
  return (
    <div className="bg-gold relative px-10 py-2.5 text-center text-sm text-les">
      {children}
      <button
        type="button"
        aria-label="Zavřít"
        onClick={() => {
          setOpen(false);
          try {
            localStorage.setItem(KEY, id);
          } catch {}
        }}
        className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full hover:bg-les/10"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
