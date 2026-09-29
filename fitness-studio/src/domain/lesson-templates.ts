/**
 * Ready-made lessons the studio may add later. Admin → Lekce creates one as
 * inactive (its page is prepared but hidden) – switching it to "Aktivní"
 * publishes the page, adds it to the sitemap and lets it into the schedule.
 */
export type LessonTemplate = {
  name: string;
  slug: string;
  description: string;
  keywords: string;
  level?: string;
  durationMin?: number;
  /** Shown to the admin – brand names need a licence before they go public. */
  note?: string;
};

export const LESSON_TEMPLATES: LessonTemplate[] = [
  {
    name: "Zumba",
    slug: "zumba",
    description:
      "Taneční fitness party na latinskoamerické a světové rytmy. Jednoduché kroky zvládne každý, spálíš spoustu energie a ani si toho nevšimneš. Žádné taneční zkušenosti nepotřebuješ.",
    keywords: "zumba Ostrava, zumba fitness, taneční fitness, tanec, taneční lekce, cvičení pro ženy",
    note: "Název Zumba smí používat jen lektor/ka s licencí ZIN.",
  },
  {
    name: "BODYPUMP",
    slug: "bodypump",
    description:
      "Posilování s činkou na hudbu podle programu LES MILLS. Hodně opakování s menší zátěží zpevní celé tělo a zlepší vytrvalost. Váhu si nastavuješ sama podle sebe.",
    keywords: "Les Mills Ostrava, lesmills, bodypump, body pump, posilování s činkou, skupinové posilování",
    level: "Pro všechny",
    note: "LES MILLS a BODYPUMP jsou chráněné značky – jen s licencí Les Mills.",
  },
  {
    name: "Pilates",
    slug: "pilates",
    description:
      "Kontrolovaný pohyb, dech a hluboký střed těla. Pilates posílí břicho a záda, zlepší držení těla a uleví od bolesti. Vhodné i pro začátečnice.",
    keywords: "pilates Ostrava, pilates pro začátečníky, zdravá záda, zpevnění středu těla",
    durationMin: 55,
  },
  {
    name: "Barre",
    slug: "barre",
    description:
      "Spojení baletu, pilates a posilování u tyče. Drobné přesné pohyby zpevní hýždě, stehna a střed těla a vytvarují postavu. Baletní průprava není potřeba.",
    keywords: "barre Ostrava, barre workout, balet fitness, tvarování postavy",
    durationMin: 55,
  },
  {
    name: "Piloxing",
    slug: "piloxing",
    description:
      "Kombinace pilates, boxu a tance. Intervalová lekce naplno spaluje, posiluje a zlepšuje kondici – a u toho se vybiješ.",
    keywords: "piloxing Ostrava, box fitness, pilates a box, kardio",
    note: "Piloxing je chráněná značka – jen s licencí instruktora.",
  },
  {
    name: "BOSU",
    slug: "bosu",
    description:
      "Trénink na balanční podložce BOSU. Posiluje hluboké svaly, zlepšuje rovnováhu a stabilitu kloubů – a pořádně rozproudí krev.",
    keywords: "bosu Ostrava, balanční trénink, stabilita, kruhový trénink",
  },
  {
    name: "TRX",
    slug: "trx",
    description:
      "Posilování s vlastní vahou v závěsném systému TRX. Obtížnost si měníš jen úhlem těla, takže trénink sedí začátečnicím i pokročilým.",
    keywords: "TRX Ostrava, závěsný trénink, posilování vlastní vahou, funkční trénink",
    durationMin: 50,
  },
  {
    name: "HYROX trénink",
    slug: "hyrox",
    description:
      "Příprava na závody HYROX i pro radost z kondice: běh, veslo, sáňky, výpady, wall-balls. Funkční trénink, který tě posune – ať závodit chceš, nebo ne.",
    keywords: "hyrox Ostrava, hyrox trénink, funkční trénink, kondiční trénink",
    level: "Mírně pokročilí",
    note: "HYROX je chráněná značka – „HYROX trénink“ jen jako příprava, oficiální „HYROX Training Club“ vyžaduje partnerství.",
  },
  {
    name: "Cross trénink",
    slug: "cross-trenink",
    description:
      "Vysoce intenzivní funkční trénink: vzpírání, gymnastické prvky a kondice v krátkých blocích. Cvičení se přizpůsobí tvé úrovni.",
    keywords: "cross trénink Ostrava, crossfit, funkční trénink, HIIT",
    level: "Mírně pokročilí",
    note: "Název CrossFit smí používat jen oficiální afiliace – proto „Cross trénink“.",
  },
  {
    name: "Tabata",
    slug: "tabata",
    description:
      "Intervalový trénink 20 sekund naplno, 10 sekund pauza. Krátké, intenzivní a velmi účinné na spalování i kondici.",
    keywords: "tabata Ostrava, HIIT, intervalový trénink, spalování tuků",
    durationMin: 45,
  },
  {
    name: "Jóga",
    slug: "joga",
    description:
      "Protažení, dech a klid v hlavě. Jóga zlepší pohyblivost a držení těla a pomůže odplavit stres. Pro začátečníky i pokročilé.",
    keywords: "jóga Ostrava, yoga Ostrava, joga, jóga pro začátečníky, protažení",
  },
  {
    name: "Taneční lekce",
    slug: "tanecni-lekce",
    description: "Energie a radost z pohybu. Choreografie pro všechny, bez nutnosti tanečních zkušeností.",
    keywords: "tanec Ostrava, taneční lekce, taneční kurz pro dospělé, taneční fitness",
  },
  {
    name: "Silový trénink",
    slug: "silovy-trenink",
    description:
      "Posilování s činkami, kettlebelly a vlastní vahou v malé skupině. Síla, pevné tělo a sebevědomí – s dohledem na správnou techniku.",
    keywords: "posilování Ostrava, fitko pro ženy, silový trénink, posilování pro ženy, kettlebell",
  },
  {
    name: "Zdravá záda",
    slug: "zdrava-zada",
    description:
      "Klidná lekce pro pevný střed těla, uvolněnou šíji a záda bez bolesti. Ideální při sedavé práci i jako doplněk k jinému tréninku.",
    keywords: "zdravá záda Ostrava, cvičení na záda, bolest zad, protažení",
    durationMin: 50,
  },
];
