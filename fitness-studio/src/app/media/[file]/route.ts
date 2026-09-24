import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { media } from "@/db/schema";

/** Serves uploaded images; ids never change content, so cache forever. */
export async function GET(_: Request, ctx: RouteContext<"/media/[file]">) {
  const { file } = await ctx.params;
  const id = file.replace(/\.webp$/, "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [m] = await (await getDb()).select().from(media).where(eq(media.id, id));
  if (!m) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(m.data), {
    headers: {
      "Content-Type": m.mime,
      "Content-Length": String(m.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
