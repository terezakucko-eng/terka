"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pencil } from "lucide-react";

/** Floating shortcut for admins browsing the public website. */
export function EditPageButton() {
  const path = usePathname();
  const page = path.startsWith("/rozvrh") ? "/rozvrh" : path === "/registrace" ? "/prihlaseni" : path;
  return (
    <Link
      href={`/admin/obsah?stranka=${encodeURIComponent(page)}`}
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-les px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-zlato-light shadow-xl ring-1 ring-zlato/40 transition hover:bg-mech"
    >
      <Pencil className="size-4" /> Upravit tuto stránku
    </Link>
  );
}
