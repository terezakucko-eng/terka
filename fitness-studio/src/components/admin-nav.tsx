"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Cog,
  FileText,
  Flower2,
  Gift,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  PartyPopper,
  QrCode,
  Receipt,
  Sparkles,
  Star,
  Tag,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { cx } from "@/components/ui";

type Item = { href: string; label: string; icon: LucideIcon; staff?: boolean; also?: string[] };

/** Admin menu by what it's used for; rarely used tools (e-mails, AI images, import) are linked from Nastavení. */
const groups: { title: string; items: Item[] }[] = [
  {
    title: "Recepce",
    items: [
      { href: "/admin", label: "Přehled", icon: LayoutDashboard, staff: true },
      { href: "/admin/rozvrh", label: "Rozvrh", icon: CalendarDays, staff: true },
      { href: "/admin/masaze", label: "Masáže", icon: Flower2, staff: true },
      { href: "/admin/klienti", label: "Klienti", icon: Users },
      { href: "/admin/schranka", label: "Schránka", icon: Inbox },
    ],
  },
  {
    title: "Peníze",
    items: [
      { href: "/admin/objednavky", label: "Platby", icon: Receipt },
      { href: "/admin/prispevky", label: "Příspěvky", icon: BadgeCheck },
      { href: "/admin/poukazy", label: "Poukazy", icon: Gift },
      { href: "/admin/darky", label: "Dárky členům", icon: PartyPopper },
      { href: "/admin/statistiky", label: "Statistiky", icon: BarChart3 },
    ],
  },
  {
    title: "Komunikace",
    items: [
      { href: "/admin/zpravy", label: "Zprávy", icon: MessageSquare },
      { href: "/admin/aktuality", label: "Aktuality", icon: Megaphone },
      { href: "/admin/recenze", label: "Recenze", icon: Star },
      { href: "/admin/karticky", label: "Pošli to dál", icon: QrCode },
    ],
  },
  {
    title: "Nabídka a web",
    items: [
      { href: "/admin/cenik", label: "Ceník", icon: Tag },
      { href: "/admin/lekce", label: "Typy lekcí", icon: Sparkles },
      { href: "/admin/lektori", label: "Lektoři", icon: UserRound },
      { href: "/admin/obsah", label: "Obsah webu", icon: FileText },
    ],
  },
  {
    title: "Studio",
    items: [{ href: "/admin/nastaveni", label: "Nastavení", icon: Cog, also: ["/admin/emaily", "/admin/obrazky", "/admin/import"] }],
  },
];

/** Phones: the bottom bar – what reception opens all day; the rest is under "Více". */
const TABS = ["/admin", "/admin/rozvrh", "/admin/objednavky", "/admin/klienti"];
const TAB_LABEL: Record<string, string> = { "/admin/objednavky": "Platby" };

const under = (path: string, href: string) => (href === "/admin" ? path === href : path === href || path.startsWith(`${href}/`));
const isActive = (path: string, i: Item) => under(path, i.href) || !!i.also?.some((a) => under(path, a));

function Count({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return <span className={cx("rounded-full bg-[#e5372f] px-1.5 text-[11px] font-bold leading-[18px] text-white", className)}>{n}</span>;
}

/**
 * Admin menu. Computer: the sidebar by groups. Phone: a bottom bar with the everyday pages
 * (Platby with the number of unpaid lessons) and "Více" opening the whole menu.
 */
export function AdminNav({ admin, newWishes, unpaid = 0 }: { admin: boolean; newWishes: number; unpaid?: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const visible = groups.map((g) => ({ ...g, items: g.items.filter((i) => admin || i.staff) })).filter((g) => g.items.length);
  const all = visible.flatMap((g) => g.items);
  const count = (href: string) => (href === "/admin/schranka" ? newWishes : href === "/admin/objednavky" ? unpaid : 0);
  const tabs = admin ? TABS.flatMap((h) => all.filter((i) => i.href === h)) : all.slice(0, 4);
  const elsewhere = all.some((i) => !tabs.includes(i) && isActive(path, i));

  return (
    <>
      <nav className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:px-3 lg:pb-2">
        {visible.map((g) => (
          <div key={g.title} className="mb-3">
            {admin && <p className="eyebrow px-3 pb-1 pt-2 text-[10px] text-papir/40">{g.title}</p>}
            {g.items.map((i) => {
              const active = isActive(path, i);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-mech hover:text-papir",
                    active ? "bg-mech text-papir" : "text-papir/75",
                  )}
                >
                  <i.icon className="size-4 text-zlato" /> {i.label}
                  <Count n={count(i.href)} className="ml-auto" />
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* phones: bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-papir/10 bg-les pb-[env(safe-area-inset-bottom)] text-papir lg:hidden">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
          {tabs.map((i) => {
            const active = isActive(path, i);
            return (
              <Link
                key={i.href}
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cx("relative flex flex-col items-center gap-1 py-2.5 text-[11px]", active ? "text-papir" : "text-papir/60")}
              >
                <i.icon className={cx("size-5", active ? "text-zlato-light" : "text-zlato")} />
                {TAB_LABEL[i.href] ?? i.label}
                <Count n={count(i.href)} className="absolute left-1/2 top-1 ml-2" />
                {active && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-zlato" />}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            className={cx("relative flex flex-col items-center gap-1 py-2.5 text-[11px]", elsewhere ? "text-papir" : "text-papir/60")}
          >
            <Menu className="size-5 text-zlato" />
            Více
            {newWishes > 0 && <span className="absolute left-1/2 top-1.5 ml-2 size-2 rounded-full bg-[#e5372f]" />}
            {elsewhere && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-zlato" />}
          </button>
        </div>
      </nav>

      {/* phones: the whole menu */}
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-les px-4 pb-10 pt-4 text-papir lg:hidden" role="dialog" aria-label="Menu administrace">
          <div className="flex items-center justify-between">
            <p className="eyebrow text-zlato-light">Menu</p>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-mech" aria-label="Zavřít menu">
              <X className="size-6" />
            </button>
          </div>
          {visible.map((g) => (
            <section key={g.title} className="mt-5">
              {admin && <p className="eyebrow pb-2 text-[10px] text-papir/40">{g.title}</p>}
              <div className="grid grid-cols-2 gap-2">
                {g.items.map((i) => {
                  const active = isActive(path, i);
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cx("flex items-center gap-3 rounded-xl px-3 py-3 text-sm", active ? "bg-mech text-papir" : "bg-papir/5 text-papir/85")}
                    >
                      <i.icon className="size-5 shrink-0 text-zlato" />
                      <span className="min-w-0 flex-1 truncate">{i.label}</span>
                      <Count n={count(i.href)} />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
          <div className="mt-8 flex items-center justify-between border-t border-papir/10 pt-5 text-sm">
            <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2 text-papir/70"><ArrowLeft className="size-4" /> Zpět na web</Link>
            <form action={logoutAction}>
              <button className="flex items-center gap-2 text-papir/70"><LogOut className="size-4" /> Odhlásit</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
