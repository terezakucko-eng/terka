import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  Cog,
  Flower2,
  LayoutDashboard,
  Mail,
  FileText,
  Gift,
  Images,
  Inbox,
  Megaphone,
  Star,
  MessageSquare,
  Upload,
  Receipt,
  Sparkles,
  Tag,
  UserRound,
  Users,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Symbol } from "@/components/brand";
import { requireStaff } from "@/lib/auth";
import { getDb } from "@/db";
import { newWishCount } from "@/domain/wishes";

export const metadata: Metadata = { title: "Administrace", robots: { index: false } };

const items = [
  { href: "/admin", label: "Přehled", icon: LayoutDashboard, admin: false },
  { href: "/admin/statistiky", label: "Statistiky", icon: BarChart3, admin: true },
  { href: "/admin/rozvrh", label: "Rozvrh", icon: CalendarDays, admin: false },
  { href: "/admin/masaze", label: "Masáže", icon: Flower2, admin: false },
  { href: "/admin/klienti", label: "Klienti", icon: Users, admin: true },
  { href: "/admin/objednavky", label: "Platby", icon: Receipt, admin: true },
  { href: "/admin/prispevky", label: "Příspěvky", icon: BadgeCheck, admin: true },
  { href: "/admin/poukazy", label: "Poukazy", icon: Gift, admin: true },
  { href: "/admin/zpravy", label: "Zprávy", icon: MessageSquare, admin: true },
  { href: "/admin/emaily", label: "E-maily", icon: Mail, admin: true },
  { href: "/admin/obsah", label: "Obsah webu", icon: FileText, admin: true },
  { href: "/admin/obrazky", label: "Obrázky (AI)", icon: Images, admin: true },
  { href: "/admin/cenik", label: "Ceník", icon: Tag, admin: true },
  { href: "/admin/lekce", label: "Typy lekcí", icon: Sparkles, admin: true },
  { href: "/admin/lektori", label: "Lektoři", icon: UserRound, admin: true },
  { href: "/admin/aktuality", label: "Aktuality", icon: Megaphone, admin: true },
  { href: "/admin/schranka", label: "Schránka", icon: Inbox, admin: true },
  { href: "/admin/recenze", label: "Recenze", icon: Star, admin: true },
  { href: "/admin/import", label: "Import klientů", icon: Upload, admin: true },
  { href: "/admin/nastaveni", label: "Nastavení", icon: Cog, admin: true },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  const nav = items.filter((i) => !i.admin || user.role === "admin");
  const newWishes = user.role === "admin" ? await newWishCount(await getDb()) : 0;
  return (
    <div className="flex min-h-screen flex-col bg-papir lg:flex-row">
      <aside className="bg-les text-papir lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col">
        <div className="flex items-center justify-between px-5 py-4 lg:block lg:py-6">
          <Link href="/admin" className="flex items-center gap-3">
            <Symbol className="w-8" />
            <span className="eyebrow text-zlato-light">Recepce</span>
          </Link>
          <Link href="/" className="eyebrow text-papir/50 hover:text-zlato-light lg:mt-3 lg:block">← Web</Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:pb-2">
          {nav.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm text-papir/75 transition hover:bg-mech hover:text-papir"
            >
              <i.icon className="size-4 text-zlato" /> {i.label}
              {i.href === "/admin/schranka" && newWishes > 0 && (
                <span className="ml-auto rounded-full bg-[#e5372f] px-1.5 text-[11px] font-bold leading-[18px] text-white">{newWishes}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="hidden shrink-0 border-t border-papir/10 px-5 py-4 text-xs text-papir/50 lg:block">
          <p>{user.name}</p>
          <form action={logoutAction}>
            <button className="mt-1 underline hover:text-papir">Odhlásit</button>
          </form>
        </div>
      </aside>
      {/* grid cells may shrink – a wide table then scrolls inside its box instead of widening the page */}
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 [&_.grid>*]:min-w-0">{children}</main>
    </div>
  );
}
