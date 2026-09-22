import Link from "next/link";
import { Menu, UserRound, X } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { LogoLink } from "./brand";
import { buttonClass } from "./ui";

const nav = [
  { href: "/rozvrh", label: "Rozvrh" },
  { href: "/lekce", label: "Lekce" },
  { href: "/cenik", label: "Ceník" },
  { href: "/lektori", label: "Lektoři" },
  { href: "/#kontakt", label: "Kontakt" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  const account = user
    ? { href: user.role === "client" ? "/ucet" : "/admin", label: user.role === "client" ? "Můj účet" : "Administrace" }
    : { href: "/prihlaseni", label: "Přihlásit" };

  return (
    <header className="sticky top-0 z-40 border-b border-zlato/15 bg-les/95 text-papir backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <LogoLink />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Hlavní menu">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="eyebrow text-papir/75 transition hover:text-zlato-light"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href={account.href}
            className={buttonClass("outline-light", "px-4 py-2 max-sm:hidden")}
          >
            <UserRound className="size-4" /> {account.label}
          </Link>
          <Link
            href="/rozvrh"
            className={buttonClass("gold", "px-4 py-2 max-lg:hidden")}
          >
            Rezervovat
          </Link>
          {/* mobile menu without client JS */}
          <details className="group relative md:hidden">
            <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full border border-zlato/30 [&::-webkit-details-marker]:hidden">
              <Menu className="size-5 group-open:hidden" />
              <X className="hidden size-5 group-open:block" />
              <span className="sr-only">Menu</span>
            </summary>
            <nav className="fixed inset-x-0 top-16 border-b border-zlato/20 bg-les px-6 py-6">
              <ul className="space-y-4">
                {[...nav, account].map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} className="eyebrow block py-1 text-papir/90">
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/rozvrh" className={buttonClass("gold", "mt-6 w-full")}>
                Rezervovat lekci
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
