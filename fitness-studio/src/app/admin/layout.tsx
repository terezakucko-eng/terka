import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  Cog,
  LayoutDashboard,
  FileText,
  Megaphone,
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

export const metadata: Metadata = { title: "Administrace", robots: { index: false } };

const items = [
  { href: "/admin", label: "Přehled", icon: LayoutDashboard, admin: false },
  { href: "/admin/rozvrh", label: "Rozvrh", icon: CalendarDays, admin: false },
  { href: "/admin/klienti", label: "Klienti", icon: Users, admin: true },
  { href: "/admin/objednavky", label: "Platby", icon: Receipt, admin: true },
  { href: "/admin/zpravy", label: "Zprávy", icon: MessageSquare, admin: true },
  { href: "/admin/obsah", label: "Obsah webu", icon: FileText, admin: true },
  { href: "/admin/cenik", label: "Ceník", icon: Tag, admin: true },
  { href: "/admin/lekce", label: "Typy lekcí", icon: Sparkles, admin: true },
  { href: "/admin/lektori", label: "Lektoři", icon: UserRound, admin: true },
  { href: "/admin/aktuality", label: "Aktuality", icon: Megaphone, admin: true },
  { href: "/admin/import", label: "Import klientů", icon: Upload, admin: true },
  { href: "/admin/nastaveni", label: "Nastavení", icon: Cog, admin: true },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  const nav = items.filter((i) => !i.admin || user.role === "admin");
  return (
    <div className="flex min-h-screen flex-col bg-papir lg:flex-row">
      <aside className="bg-les text-papir lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0">
        <div className="flex items-center justify-between px-5 py-4 lg:block lg:py-6">
          <Link href="/admin" className="flex items-center gap-3">
            <Symbol className="w-8" />
            <span className="eyebrow text-zlato-light">Recepce</span>
          </Link>
          <Link href="/" className="eyebrow text-papir/50 hover:text-zlato-light lg:mt-3 lg:block">← Web</Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
          {nav.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm text-papir/75 transition hover:bg-mech hover:text-papir"
            >
              <i.icon className="size-4 text-zlato" /> {i.label}
            </Link>
          ))}
        </nav>
        <div className="hidden px-5 py-6 text-xs text-papir/50 lg:absolute lg:bottom-0 lg:block">
          <p>{user.name}</p>
          <form action={logoutAction}>
            <button className="mt-1 underline hover:text-papir">Odhlásit</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
