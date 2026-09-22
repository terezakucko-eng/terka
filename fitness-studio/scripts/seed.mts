/**
 * Demo data: admin account, classes, instructors, price list and
 * a 3-week schedule. Safe to run repeatedly – skips if data exists.
 *   ADMIN_EMAIL / ADMIN_PASSWORD override the default admin login.
 */
import bcrypt from "bcryptjs";
import { createDb, runMigrations } from "../src/db";
import {
  announcements,
  classSessions,
  classTypes,
  instructors,
  products,
  users,
} from "../src/db/schema";
import { addDays, dateKey, pragueLocalToDate, weekdayOf } from "../src/lib/dates";

const h = createDb();
await runMigrations(h);
const db = h.db;

if ((await db.select({ id: users.id }).from(users).limit(1)).length) {
  console.log("Database already has data – seed skipped.");
  await h.close();
  process.exit(0);
}

const adminEmail = process.env.ADMIN_EMAIL ?? "admin@octopush.cz";
const adminPassword = process.env.ADMIN_PASSWORD ?? "octopush-admin";
await db.insert(users).values({
  email: adminEmail,
  name: "Recepce OCTOPUSH",
  role: "admin",
  passwordHash: await bcrypt.hash(adminPassword, 10),
});
await db.insert(users).values({
  email: "klient@octopush.cz",
  name: "Testovací Klientka",
  passwordHash: await bcrypt.hash("klient123", 10),
  creditBalance: 5,
});

// one instructor runs the studio; more can be added in Admin → Lektoři
const [anna] = await db
  .insert(instructors)
  .values({
    name: "Lektorka",
    slug: "lektorka",
    specialties: "Tanec · Pilates · Síla",
    bio: "Zakladatelka studia.",
    sortOrder: 1,
  })
  .returning();
const marek = anna;
const eva = anna;

const [tanec, pilates, sila, mobilita, funkcni] = await db
  .insert(classTypes)
  .values([
    {
      name: "Taneční lekce",
      slug: "tanecni-lekce",
      description: "Energie a radost. Choreografie pro všechny, bez nutnosti tanečních zkušeností.",
      durationMin: 60,
      color: "#D2A772",
      capacity: 16,
      dropInPrice: 25000,
      sortOrder: 1,
    },
    {
      name: "Pilates",
      slug: "pilates",
      description: "Síla v rovnováze. Hluboký střed těla, správné držení a kontrolovaný pohyb.",
      durationMin: 55,
      color: "#606350",
      capacity: 10,
      creditCost: 1,
      dropInPrice: 28000,
      sortOrder: 2,
    },
    {
      name: "Silový trénink",
      slug: "silovy-trenink",
      description: "Síla, vytrvalost, sebevědomí. Práce s činkami a vlastní vahou v malé skupině.",
      durationMin: 60,
      color: "#674329",
      capacity: 10,
      dropInPrice: 25000,
      level: "Mírně pokročilí",
      sortOrder: 3,
    },
    {
      name: "Mobilita & strečink",
      slug: "mobilita",
      description: "Tělo i mysl. Uvolnění, dech a rozsah pohybu – ideální doplněk k tréninku.",
      durationMin: 50,
      color: "#D1B89A",
      capacity: 14,
      dropInPrice: 20000,
      sortOrder: 4,
    },
    {
      name: "Funkční trénink",
      slug: "funkcni-trenink",
      description: "Kondice pro každý den. Kruhový trénink s Bosu, kettlebelly a TRX.",
      durationMin: 50,
      color: "#394330",
      capacity: 12,
      dropInPrice: 25000,
      sortOrder: 5,
    },
  ])
  .returning();

await db.insert(products).values([
  {
    kind: "credit_pack",
    name: "Kredit 5",
    description: "5 kreditů do peněženky. 1 kredit = 1 běžná lekce.",
    price: 110000,
    credits: 5,
    sortOrder: 1,
  },
  {
    kind: "credit_pack",
    name: "Kredit 10",
    description: "10 kreditů – nejvýhodnější dobití.",
    price: 200000,
    credits: 10,
    sortOrder: 2,
  },
  {
    kind: "pass",
    name: "Permanentka 10 vstupů",
    description: "10 lekcí dle výběru, platnost 3 měsíce.",
    price: 210000,
    entries: 10,
    validityDays: 90,
    highlight: true,
    sortOrder: 3,
  },
  {
    kind: "pass",
    name: "Permanentka 20 vstupů",
    description: "20 lekcí dle výběru, platnost 6 měsíců.",
    price: 380000,
    entries: 20,
    validityDays: 180,
    sortOrder: 4,
  },
  {
    kind: "membership",
    name: "Členství Unlimited",
    description: "Neomezeně lekcí. Automaticky se obnovuje každý měsíc, zrušíš kdykoliv.",
    price: 189000,
    validityDays: 30,
    recurring: true,
    highlight: true,
    sortOrder: 5,
  },
  {
    kind: "membership",
    name: "Členství 2× týdně",
    description: "Až 2 lekce týdně. Automaticky se obnovuje každý měsíc.",
    price: 139000,
    validityDays: 30,
    weeklyLimit: 2,
    recurring: true,
    sortOrder: 6,
  },
]);

// weekday (0 = Po) → [time, class, instructor]
const plan: [number, string, typeof tanec, typeof anna][] = [
  [0, "07:00", pilates, anna],
  [0, "18:00", sila, marek],
  [1, "17:00", tanec, eva],
  [1, "18:15", mobilita, anna],
  [2, "07:00", funkcni, marek],
  [2, "18:00", pilates, anna],
  [3, "17:00", tanec, eva],
  [3, "18:15", sila, marek],
  [4, "17:30", funkcni, marek],
  [5, "09:00", pilates, anna],
  [5, "10:30", tanec, eva],
  [6, "10:00", mobilita, anna],
];

const today = dateKey(new Date());
const rows: (typeof classSessions.$inferInsert)[] = [];
for (let i = 0; i < 21; i++) {
  const day = addDays(today, i);
  for (const [wd, time, ct, ins] of plan) {
    if (weekdayOf(day) !== wd) continue;
    rows.push({
      classTypeId: ct.id,
      instructorId: ins.id,
      startsAt: pragueLocalToDate(`${day}T${time}`),
      durationMin: ct.durationMin,
      capacity: ct.capacity,
      creditCost: ct.creditCost,
      dropInPrice: ct.dropInPrice,
      room: "Sál",
    });
  }
}
// one open class for everyone
const sat = rows.find((r) => weekdayOf(dateKey(r.startsAt as Date)) === 5);
if (sat) {
  sat.isFree = true;
  sat.note = "Den otevřených dveří – lekce zdarma pro všechny.";
}
await db.insert(classSessions).values(rows);

await db.insert(announcements).values({
  title: "Vítej v OCTOPUSH",
  body: "Každý má svou cestu. Po registraci máš první lekci zdarma – vyber si v rozvrhu, co tě láká.",
  isPinned: true,
});

console.log(`✓ seeded: ${rows.length} lessons, admin ${adminEmail} / ${adminPassword}`);
await h.close();
