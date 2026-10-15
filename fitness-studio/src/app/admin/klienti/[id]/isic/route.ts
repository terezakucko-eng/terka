import { getDb } from "@/db";
import { studentProofOf } from "@/domain/students";
import { requireAdmin } from "@/lib/auth";

/** The client's ISIC / confirmation photo – for the reception only, never cached. */
export async function GET(_: Request, { params }: RouteContext<"/admin/klienti/[id]/isic">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const p = await studentProofOf(await getDb(), id);
  if (!p) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(p.data), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" },
  });
}
