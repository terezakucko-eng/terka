import { getDb } from "@/db";
import { unsubscribe } from "@/domain/campaigns";

/** One-click unsubscribe from e-mail clients (List-Unsubscribe-Post). */
export async function POST(_: Request, ctx: RouteContext<"/api/unsubscribe/[token]">) {
  const { token } = await ctx.params;
  await unsubscribe(await getDb(), token, ["email"]);
  return new Response("OK");
}

export async function GET(req: Request, ctx: RouteContext<"/api/unsubscribe/[token]">) {
  const { token } = await ctx.params;
  return Response.redirect(new URL(`/o/${token}`, req.url), 303);
}
