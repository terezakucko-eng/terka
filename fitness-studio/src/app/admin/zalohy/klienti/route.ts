import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { dateKey } from "@/lib/dates";
import { splitName } from "@/lib/client-list";

const cell = (v: unknown) => {
  const s = v instanceof Date ? dateKey(v) : v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Clients as CSV for Excel (semicolons, UTF-8 BOM). */
export async function GET() {
  await requireAdmin();
  const list = await (await getDb()).select().from(users).orderBy(asc(users.name));
  const head = ["Příjmení", "Jméno", "E-mail", "Telefon", "Role", "Kredit", "Kredit platí do", "Narozeniny", "Registrace"];
  const rows = list.map((u) => {
    const { first, last } = splitName(u.name);
    return [last, first, u.email, u.phone, u.role, u.creditBalance, u.creditExpiresAt, u.birthDate, u.createdAt];
  });
  const csv = "﻿" + [head, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="octopush-klienti-${dateKey(new Date())}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
