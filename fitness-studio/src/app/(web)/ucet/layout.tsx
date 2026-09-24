import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { Container, Eyebrow } from "@/components/ui";
import { requireUser } from "@/lib/auth";

const tabs = [
  { href: "/ucet", label: "Přehled" },
  { href: "/ucet/historie", label: "Historie a platby" },
  { href: "/ucet/profil", label: "Profil" },
];

export default async function AccountLayout({ children }: LayoutProps<"/ucet">) {
  const user = await requireUser("/ucet");
  return (
    <>
      <section className="border-b border-linka/60">
        <Container className="pt-10">
          <Eyebrow className="text-zeme">Můj účet</Eyebrow>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-4xl font-semibold tracking-tight">Ahoj, {user.name.split(" ")[0]}.</h1>
            <form action={logoutAction}>
              <button className="eyebrow text-les/60 underline underline-offset-4 hover:text-les">Odhlásit</button>
            </form>
          </div>
          <nav className="mt-8 flex gap-6 overflow-x-auto">
            {tabs.map((t) => (
              <Link key={t.href} href={t.href} className="eyebrow whitespace-nowrap border-b-2 border-transparent pb-3 text-les/70 hover:border-zlato hover:text-les">
                {t.label}
              </Link>
            ))}
            {user.role !== "client" && (
              <Link href="/admin" className="eyebrow whitespace-nowrap pb-3 text-zeme">Administrace →</Link>
            )}
          </nav>
        </Container>
      </section>
      <Container className="py-10">{children}</Container>
    </>
  );
}
