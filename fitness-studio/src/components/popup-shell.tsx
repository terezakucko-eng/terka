"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { popupDue, seenValue } from "@/lib/popup-seen";

const KEY = "octopush-popup-seen";

/**
 * Shows the pop-up once per visitor (per content version) a moment after the page loads –
 * and again on `repeatDay` (JS weekday) to those who closed it on an earlier day.
 */
export function PopupShell({
  id,
  wide,
  repeatDay = null,
  children,
}: {
  id: string;
  wide?: boolean;
  repeatDay?: number | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // not on login/registration and payment pages – don't get in the way there
    if (/^\/(prihlaseni|registrace|platba)/.test(pathname)) return;
    let due = true;
    try {
      due = popupDue(localStorage.getItem(KEY), id, repeatDay);
    } catch {}
    if (!due) return;
    const timer = setTimeout(() => setOpen(true), 2500);
    return () => clearTimeout(timer);
  }, [id, pathname, repeatDay]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, seenValue(id));
    } catch {}
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    box.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close only touches state and storage
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-les/60 p-4 backdrop-blur-sm" onClick={close}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          if ((e.target as HTMLElement).closest("[data-popup-close]")) close();
        }}
        className={`relative w-full ${wide ? "max-w-3xl" : "max-w-lg"} overflow-hidden rounded-2xl bg-papir text-les shadow-2xl outline-none`}
      >
        <button
          type="button"
          aria-label="Zavřít"
          onClick={close}
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full bg-papir/90 hover:bg-krem"
        >
          <X className="size-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
