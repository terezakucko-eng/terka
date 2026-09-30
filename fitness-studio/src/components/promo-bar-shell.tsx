"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { PROMO_COOKIE } from "@/lib/promo";

/** Closable wrapper; the closed bar is remembered in a cookie, so the server leaves it out next time. */
export function PromoBarShell({ id, children }: { id: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="bg-gold relative px-10 py-2.5 text-center text-sm text-les">
      {children}
      <button
        type="button"
        aria-label="Zavřít"
        onClick={() => {
          setOpen(false);
          document.cookie = `${PROMO_COOKIE}=${id}; path=/; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
        }}
        className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full hover:bg-les/10"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
