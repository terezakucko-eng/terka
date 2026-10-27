import { aiImageAction } from "@/app/admin/image-actions";
import { AdminTitle } from "@/components/admin";
import { AiMark } from "@/components/content-image";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Card } from "@/components/ui";
import { getContent } from "@/content";
import { SECTIONS, type SectionDef } from "@/content/definitions";
import { getDb } from "@/db";
import { classTypes, massageServices } from "@/db/schema";
import { aiImageList } from "@/lib/ai-images";
import { requireAdmin } from "@/lib/auth";

/** Every picture the web shows, with where it is used. */
async function usedImages() {
  const [c, db] = await Promise.all([getContent(), getDb()]);
  const used = new Map<string, string[]>();
  const add = (src: string | null, where: string) => {
    const s = src?.trim();
    if (s) used.set(s, [...(used.get(s) ?? []), where]);
  };
  for (const [id, section] of Object.entries(SECTIONS as Record<string, SectionDef>))
    for (const [key, def] of Object.entries(section.fields))
      if (def.type === "image") add(c.raw(`${id}.${key}`), `${section.title} – ${def.label}`);
  const [types, massages] = await Promise.all([
    db.select({ name: classTypes.name, imageUrl: classTypes.imageUrl }).from(classTypes),
    db.select({ name: massageServices.name, imageUrl: massageServices.imageUrl }).from(massageServices),
  ]);
  for (const t of types) add(t.imageUrl, `Lekce – ${t.name}`);
  for (const m of massages) add(m.imageUrl, `Masáž – ${m.name}`);
  return [...used.entries()].map(([src, where]) => ({ src, where }));
}

export default async function AiImagesPage() {
  await requireAdmin();
  const [images, marked] = await Promise.all([usedImages(), aiImageList(await getDb())]);
  const ai = new Set(marked);
  const unmarked = images.filter((i) => !ai.has(i.src));

  return (
    <>
      <AdminTitle title="Obrázky (AI)" />
      <p className="-mt-4 mb-6 max-w-3xl text-sm text-les/60">
        Obrázky vytvořené nebo upravené pomocí AI je potřeba označit (evropský AI Act). Označeným se na webu ukáže v rohu vodoznak –
        chobotnice s „AI“ v hlavě. Skutečné fotky ze studia neoznačuj. Nový obrázek nahraný jinde v adminu se tu objeví sám.
      </p>
      {unmarked.length > 1 && (
        <ActionForm action={aiImageAction} className="mb-6" confirm={`Označit všech ${unmarked.length} neoznačených obrázků jako AI?`}>
          {unmarked.map((i) => <input key={i.src} type="hidden" name="src" value={i.src} />)}
          <input type="hidden" name="on" value="true" />
          <SubmitButton variant="outline">Označit všechny jako AI</SubmitButton>
        </ActionForm>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((i) => {
          const isAi = ai.has(i.src);
          return (
            <Card key={i.src} className="p-4">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-linka/30">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail, any URL */}
                <img src={i.src} alt="" className="size-full object-cover" />
                {isAi && <AiMark className="w-14 sm:w-14" />}
              </div>
              <ActionForm action={aiImageAction} className="mt-3">
                <input type="hidden" name="src" value={i.src} />
                <input type="hidden" name="on" value={isAi ? "false" : "true"} />
                <div className="flex items-center justify-between gap-3">
                  {isAi ? <Badge tone="gold">AI</Badge> : <Badge>Skutečná fotka</Badge>}
                  <SubmitButton variant={isAi ? "ghost" : "outline"} className="px-3 py-2 text-[0.65rem]">
                    {isAi ? "Zrušit označení" : "Označit jako AI"}
                  </SubmitButton>
                </div>
              </ActionForm>
              <ul className="mt-2 space-y-0.5 text-xs text-les/60">
                {i.where.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </Card>
          );
        })}
      </div>
    </>
  );
}
