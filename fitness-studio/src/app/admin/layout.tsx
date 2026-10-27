import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { AdminNav } from "@/components/admin-nav";
import { Symbol } from "@/components/brand";
import { requireStaff } from "@/lib/auth";
import { getDb } from "@/db";
import { newWishCount } from "@/domain/wishes";
import { unpaidBookings } from "@/domain/booking";

export const metadata: Metadata = { title: "Administrace", robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  const admin = user.role === "admin";
  const db = admin ? await getDb() : null;
  // the menu shows what waits: new wishes, unpaid lessons (drop-ins, surcharges)
  const [newWishes, unpaid] = db ? await Promise.all([newWishCount(db), unpaidBookings(db).then((r) => r.length)]) : [0, 0];
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
        <AdminNav admin={admin} newWishes={newWishes} unpaid={unpaid} />
        <div className="hidden shrink-0 border-t border-papir/10 px-5 py-4 text-xs text-papir/50 lg:block">
          <p>{user.name}</p>
          <form action={logoutAction}>
            <button className="mt-1 underline hover:text-papir">Odhlásit</button>
          </form>
        </div>
      </aside>
      {/* grid cells may shrink – a wide table then scrolls inside its box instead of widening the page */}
      <main className="min-w-0 flex-1 px-4 pb-28 pt-8 sm:px-8 lg:pb-8 [&_.grid>*]:min-w-0">{children}</main>
    </div>
  );
}
