import { getDb } from "@/db";
import { expireStalePending } from "@/domain/booking";

/**
 * Housekeeping – call every ~10 minutes (Vercel Cron, see vercel.json).
 * Releases spots held by unpaid drop-in orders.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });
  const db = await getDb();
  const expired = await db.transaction((tx) => expireStalePending(tx, new Date()));
  return Response.json({ expired });
}
