import { and, asc, eq, gte } from "drizzle-orm";
import type { DB } from "@/db";
import { classSessions, classTypes } from "@/db/schema";
import { formatDateTime } from "./dates";
import { activeClassTypes } from "./queries";

/** Select options for the campaign audience (class types, upcoming/recent sessions). */
export async function audienceOptions(db: DB) {
  const types = await activeClassTypes(db);
  const rows = await db
    .select({ id: classSessions.id, startsAt: classSessions.startsAt, name: classTypes.name })
    .from(classSessions)
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .where(and(gte(classSessions.startsAt, new Date(Date.now() - 7 * 86_400_000))))
    .orderBy(asc(classSessions.startsAt))
    .limit(150);
  return {
    classTypes: types.map((t) => ({ id: t.id, label: t.name })),
    sessions: rows.map((s) => ({ id: s.id, label: `${formatDateTime(s.startsAt)} · ${s.name}` })),
  };
}
