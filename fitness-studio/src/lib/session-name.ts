import { sql } from "drizzle-orm";
import { classSessions, classTypes } from "@/db/schema";

/** A session's own title (e.g. „Dýňový brunch“) wins over the lesson name. */
export const sessionName = (s: { title: string | null }, ct: { name: string }) => s.title?.trim() || ct.name;

/** The same in SQL, for selects that join sessions with their lesson. */
export const sessionNameSql = sql<string>`coalesce(nullif(trim(${classSessions.title}), ''), ${classTypes.name})`;
