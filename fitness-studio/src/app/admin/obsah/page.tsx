import Link from "next/link";
import { ExternalLink, Pencil } from "lucide-react";
import { AdminTitle } from "@/components/admin";
import { Card, cx } from "@/components/ui";
import { SECTIONS, type SectionDef } from "@/content/definitions";
import { getDb } from "@/db";
import { content } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

const pageNames: Record<string, string> = {
  "*": "Celý web",
  "/": "Úvodní stránka",
  "/rozvrh": "Rozvrh",
  "/lekce": "Lekce",
  "/lektori": "Lektoři",
  "/cenik": "Ceník",
  "/prihlaseni": "Přihlášení a registrace",
  "/obchodni-podminky": "Obchodní podmínky",
  "/ochrana-osobnich-udaju": "Ochrana osobních údajů",
};

export default async function ContentOverview({ searchParams }: PageProps<"/admin/obsah">) {
  await requireAdmin();
  const { stranka } = await searchParams;
  const rows = await (await getDb()).select({ key: content.key }).from(content);
  const edited = new Set(rows.map((r) => r.key.split(".")[0]));
  const sections = Object.entries(SECTIONS as Record<string, SectionDef>);
  const pages = [...new Set(sections.map(([, s]) => s.page))];

  return (
    <>
      <AdminTitle title="Obsah webu" />
      <p className="-mt-4 mb-8 max-w-3xl text-sm text-les/60">
        Všechny texty a fotky na webu. Změny jsou vidět hned po uložení. Ceník, lekce, lektory, rozvrh a aktuality upravuješ v jejich vlastních sekcích menu.
      </p>
      <div className="space-y-8">
        {pages.map((page) => (
          <section key={page}>
            <div className="mb-3 flex items-center gap-3">
              <h2 className={cx("text-lg font-semibold", stranka === page && "text-zeme")}>{pageNames[page] ?? page}</h2>
              {page !== "*" && (
                <Link href={page} target="_blank" className="inline-flex items-center gap-1 text-xs text-les/50 hover:text-les">
                  zobrazit <ExternalLink className="size-3" />
                </Link>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sections
                .filter(([, s]) => s.page === page)
                .map(([id, s]) => (
                  <Link key={id} href={`/admin/obsah/${id}`}>
                    <Card className={cx("flex items-center justify-between gap-3 p-4 transition hover:border-zlato", stranka === page && "border-zlato")}>
                      <span>
                        <span className="block font-semibold">{s.title}</span>
                        <span className="text-xs text-les/50">
                          {Object.keys(s.fields).length} polí{edited.has(id) ? " · upraveno" : ""}
                        </span>
                      </span>
                      <Pencil className="size-4 text-zeme" />
                    </Card>
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
