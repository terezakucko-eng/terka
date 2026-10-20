import { eq } from "drizzle-orm";
import type { Executor } from "@/db";
import { settings } from "@/db/schema";

/** Business rules editable in Admin → Nastavení. */
export const defaultSettings = {
  /** Bezplatné storno nejpozději X hodin před lekcí */
  cancellationHours: 12,
  /** Kolik dní dopředu lze rezervovat */
  bookingWindowDays: 21,
  /** Členové (aktivní členství) mohou rezervovat dál dopředu */
  memberBookingWindowDays: 21,
  /** Rezervace po kalendářních týdnech: tento týden + X dalších (0 = platí dny výše) */
  bookingWindowWeeks: 1,
  /** …pro členy */
  memberBookingWindowWeeks: 2,
  /** Rezervace se uzavírá X minut před začátkem */
  bookingCutoffMinutes: 0,
  /** Vstupy zdarma pro nově registrované */
  welcomeFreeEntries: 1,
  welcomeFreeValidityDays: 30,
  /** Jak dlouho čeká neuhrazený jednorázový vstup (Stripe vyžaduje min. 30) */
  pendingPaymentMinutes: 30,
  /** Masáže: pauza mezi dvěma masážemi (úklid, převlečení) */
  massageBufferMinutes: 15,
  /** Masáže: po kolika minutách lze začít (30 = 9:00, 9:30, 10:00…) */
  massageStepMinutes: 30,
  /** Členství: kolik pozdních odhlášení/nepříchodů vede k pauze (0 = vypnuto) */
  memberStrikeLimit: 3,
  /** …za kolik dní */
  memberStrikeWindowDays: 30,
  /** Délka pauzy v přihlašování (dní) */
  memberPauseDays: 7,
  /** Měsíční členský příspěvek v Kč; 0 = automatické výzvy vypnuté */
  membershipMonthlyFee: 0,
  /** Kterého dne v měsíci odejdou výzvy k platbě za následující měsíc */
  membershipFeeNoticeDay: 20,
  /** Přání k narozeninám a svátku (1 = posílat, 0 = vypnuto) */
  birthdayGreetings: 1,
  /** Dárek k narozeninám – vstupy zdarma (0 = jen přání) */
  birthdayGiftEntries: 1,
  birthdayGiftValidityDays: 30,
  /** E-mail „Chybíš nám“ po X dnech bez lekce (0 = vypnuto) */
  winbackDays: 28,
  /** Pozvi kamarádku: lekcí zdarma pro tu, která pozvala, po prvním nákupu kamarádky (0 = vypnuto) */
  referralGiftEntries: 1,
  referralGiftValidityDays: 60,
  /** Dárkové poukazy: platnost od zaplacení (dní) */
  voucherValidityDays: 365,
  /** Poukaz na částku: kolik kreditů za každých 100 Kč (110 = jako dobití kreditu 1 000 Kč → 1 100 kreditů) */
  voucherCreditsPer100Kc: 110,
  /** Členství s lekcemi v ceně (Členství Reformer): na tyto lekce rezervuje o X týdnů dřív než ostatní členové */
  includedPriorityWeeks: 1,
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
