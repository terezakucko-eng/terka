import { getDb } from "@/db";
import { backupFile } from "@/domain/backup";
import { requireAdmin } from "@/lib/auth";
import { dateKey } from "@/lib/dates";

/** Download of one backup (gzipped JSON of all tables). */
export async function GET(_: Request, { params }: RouteContext<"/admin/zalohy/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const b = await backupFile(await getDb(), id);
  if (!b) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(b.data), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="octopush-zaloha-${dateKey(b.createdAt)}.json.gz"`,
      "Cache-Control": "private, no-store",
    },
  });
}
