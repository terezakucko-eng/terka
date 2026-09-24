import { eq } from "drizzle-orm";
import type { Executor } from "@/db";
import { settings } from "@/db/schema";

/** Business rules editable in Admin → Nastavení. */
export const defaultSettings = {
  /** Bezplatné storno nejpozději X hodin před lekcí */
  cancellationHours: 12,
  /** Kolik dní dopředu lze rezervovat */
  bookingWindowDays: 21,
  /** Rezervace se uzavírá X minut před začátkem */
  bookingCutoffMinutes: 0,
  /** Vstupy zdarma pro nově registrované */
  welcomeFreeEntries: 1,
  welcomeFreeValidityDays: 30,
  /** Jak dlouho čeká neuhrazený jednorázový vstup (Stripe vyžaduje min. 30) */
  pendingPaymentMinutes: 30,
};

export type Settings = typeof defaultSettings;

export async function getSettings(db: Executor): Promise<Settings> {
  const rows = await db.select().from(settings);
  const out: Settings = { ...defaultSettings };
  for (const r of rows) {
    if (r.key in out && typeof r.value === "number") {
      out[r.key as keyof Settings] = r.value;
    }
  }
  return out;
}

export async function saveSettings(db: Executor, values: Partial<Settings>) {
  for (const [key, value] of Object.entries(values)) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
}

export async function deleteSetting(db: Executor, key: string) {
  await db.delete(settings).where(eq(settings.key, key));
}
