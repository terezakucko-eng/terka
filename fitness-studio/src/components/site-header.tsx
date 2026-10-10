import Link from "next/link";
import { Menu, UserRound, X } from "lucide-react";
import { getContent } from "@/content";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { LogoLink } from "./brand";
import { CloseMenuOnClick } from "./close-menu-on-click";
import { buttonClass } from "./ui";
import { BoardNewDot } from "./board-dot";
import { getDb } from "@/db";
import { latestAnnouncementAt } from "@/lib/queries";

export async function SiteHeader() {
  const [user, c, boardLatest] = await Promise.all([getCurrentUser(), getContent(), getDb().then(latestAnnouncementAt)]);
  const nav = [
    { href: "/rozvrh", label: c("nav.schedule") },
    { href: "/lekce", label: c("nav.classes") },
    { href: "/masaze", label: c("nav.massages") },
    { href: "/cenik", label: c("nav.pricing") },
    { href: "/o-mne", label: c("nav.about") },
    { href: "/nastenka", label: c("nav.board") },
    { href: "/#kontakt", label: c("nav.contact") },
  ].filter((n) => n.label); // an emptied label hides the item
  const account = user
    ? { href: user.role === "client" ? "/ucet" : "/admin", label: user.role === "client" ? "Můj účet" : "Administrace" }
    : { href: "/prihlaseni", label: "Přihlásit" };

  return (
    <header className="sticky top-0 z-40 border-b border-zlato/15 bg-les/95 text-papir backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6 xl:max-w-7xl">
        <LogoLink />
        <nav className="mx-auto hidden items-center gap-5 xl:flex 2xl:gap-7" aria-label="Hlavní menu">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="eyebrow relative whitespace-nowrap text-papir/75 transition hover:text-zlato-light">
              {n.label}
              {n.href === "/nastenka" && <BoardNewDot latest={boardLatest} className="absolute -right-2 -top-1.5" />}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href={account.href} className={buttonClass("outline-light", "px-4 py-2 max-sm:hidden")}>
            <UserRound className="size-4" /> {account.label}
          </Link>
          <Link href="/rozvrh" className={buttonClass("gold", "px-4 py-2 max-lg:hidden")}>
            {c("nav.book")}
          </Link>
          {/* mobile menu without client JS */}
          <details className="group relative xl:hidden">
            <summary className="relative flex size-10 cursor-pointer list-none items-center justify-center rounded-full border border-zlato/30 [&::-webkit-details-marker]:hidden">
              <BoardNewDot latest={boardLatest} className="absolute right-0.5 top-0.5" />
              <Menu className="size-5 group-open:hidden" />
              <X className="hidden size-5 group-open:block" />
              <span className="sr-only">Menu</span>
            </summary>
            <CloseMenuOnClick />
            <nav className="fixed inset-x-0 top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-zlato/20 bg-les px-6 pb-8 pt-4">
              <div className="mx-auto max-w-sm text-center">
                <ul className="divide-y divide-zlato/10">
                  {nav.map((n) => (
                    <li key={n.href}>
                      <Link href={n.href} className="eyebrow flex items-center justify-center gap-2 py-3.5 text-papir/90 hover:text-zlato-light">
                        {n.label}
                        {n.href === "/nastenka" && <BoardNewDot latest={boardLatest} />}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 space-y-3">
                  <Link href="/rozvrh" className={buttonClass("gold", "w-full")}>
                    {c("nav.book")}
                  </Link>
                  <Link href={account.href} className={buttonClass("outline-light", "w-full")}>
                    <UserRound className="size-4" /> {account.label}
                  </Link>
                </div>
                {user ? (
                  <form action={logoutAction} className="mt-5">
                    <button className="text-xs tracking-wider text-papir/50 underline underline-offset-4 hover:text-papir">Odhlásit se</button>
                  </form>
                ) : (
                  <p className="mt-5 text-xs text-papir/60">
                    Nemáš účet? <Link href="/registrace" className="underline underline-offset-4">Zaregistruj se</Link> – první lekce je zdarma.
                  </p>
                )}
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
