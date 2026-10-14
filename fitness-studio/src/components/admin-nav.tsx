"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Cog,
  FileText,
  Flower2,
  Gift,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Receipt,
  Sparkles,
  Star,
  Tag,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
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
      { href: "/admin/statistiky", label: "Statistiky", icon: BarChart3 },
    ],
  },
  {
    title: "Komunikace",
    items: [
      { href: "/admin/zpravy", label: "Zprávy", icon: MessageSquare },
      { href: "/admin/aktuality", label: "Aktuality", icon: Megaphone },
      { href: "/admin/recenze", label: "Recenze", icon: Star },
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

const under = (path: string, href: string) => (href === "/admin" ? path === href : path === href || path.startsWith(`${href}/`));

export function AdminNav({ admin, newWishes }: { admin: boolean; newWishes: number }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-0 lg:overflow-y-auto lg:pb-2">
      {groups.map((g) => {
        const items = g.items.filter((i) => admin || i.staff);
        if (!items.length) return null;
        return (
          // on phones the menu is one scrolling row – the groups melt into it
          <div key={g.title} className="contents lg:mb-3 lg:block">
            {admin && <p className="eyebrow hidden px-3 pb-1 pt-2 text-[10px] text-papir/40 lg:block">{g.title}</p>}
            {items.map((i) => {
              const active = under(path, i.href) || !!i.also?.some((a) => under(path, a));
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-mech hover:text-papir",
                    active ? "bg-mech text-papir" : "text-papir/75",
                  )}
                >
                  <i.icon className="size-4 text-zlato" /> {i.label}
                  {i.href === "/admin/schranka" && newWishes > 0 && (
                    <span className="ml-auto rounded-full bg-[#e5372f] px-1.5 text-[11px] font-bold leading-[18px] text-white">{newWishes}</span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
