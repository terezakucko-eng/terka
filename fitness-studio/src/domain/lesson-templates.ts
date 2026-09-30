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
    name: "Zumba fitness",
    slug: "zumba-fitness",
    description:
      "Taneční fitness party na latinskoamerické a světové rytmy. Jednoduché kroky zvládne každý, spálíš spoustu energie a ani si toho nevšimneš. Žádné taneční zkušenosti nepotřebuješ.",
    keywords: "zumba Ostrava, zumba fitness, taneční fitness, tanec, taneční lekce, cvičení pro ženy",
    note: "Název Zumba smí používat jen lektor/ka s licencí ZIN.",
  },
  {
    name: "Zumba Toning",
    slug: "zumba-toning",
    description:
      "Zumba s lehkými činkami (toning sticks). Tančíš na stejně skvělou hudbu, ale navíc posiluješ paže, střed těla, hýždě a stehna. Ideální, když chceš spojit kardio se zpevněním postavy.",
    keywords: "zumba toning Ostrava, zumba s činkami, taneční posilování, zumba, zpevnění postavy",
    durationMin: 45,
    note: "Zumba Toning smí vést jen lektor/ka s licencí ZIN.",
  },
  {
    name: "Strong Nation",
    slug: "strong-nation",
    description:
      "Vysoce intenzivní intervalový trénink, kde každý pohyb sedí přesně na hudbu. Síla, kardio a výskoky s vlastní vahou – žádné taneční kroky, jen poctivá dřina, která ubíhá sama.",
    keywords: "Strong Nation Ostrava, STRONG by Zumba, HIIT Ostrava, intervalový trénink, kondiční trénink",
    level: "Mírně pokročilí",
    note: "STRONG Nation® je chráněná značka – jen s licencí instruktora.",
  },
  {
    name: "Reformer fusion",
    slug: "reformer-fusion",
    description:
      "Pilates na reformeru v kombinaci s prvky silového a funkčního tréninku. Pružiny stroje dávají odpor i oporu, takže posílíš hluboké svaly, zlepšíš držení těla a protáhneš se – šetrně ke kloubům. Malá skupina, individuální přístup.",
    keywords: "reformer Ostrava, pilates reformer Ostrava, reformer pilates, pilates, zpevnění středu těla",
    durationMin: 55,
  },
  {
    name: "Zdravé tělo | silový trénink",
    slug: "zdrave-telo-silovy-trenink",
    description:
      "Posilování s vlastní vahou, činkami a pomůckami se zaměřením na zdravý pohyb a správnou techniku. Zpevníš celé tělo, podpoříš záda a klouby a získáš sílu do běžného života.",
    keywords: "posilování Ostrava, silový trénink pro ženy, fitko pro ženy, posilování pro začátečníky, zdravá záda",
  },
  {
    name: "Zdravé tělo | cardio trénink",
    slug: "zdrave-telo-cardio-trenink",
    description:
      "Kondiční trénink pro zdravé srdce a lepší výdrž. Střídáme tempo i cviky tak, aby se zapotil každý – začátečník i pokročilý. Spálíš kalorie a odejdeš nabitá energií.",
    keywords: "cardio Ostrava, kardio trénink, spalování tuků, kondiční cvičení, cvičení pro ženy",
  },
  {
    name: "Individuální trénink",
    slug: "individualni-trenink",
    description:
      "Osobní trénink jeden na jednoho, celý čas jen pro tebe. Plán ušijeme na míru tvému cíli – zpevnění, síla, kondice, návrat po pauze nebo pomoc s technikou. Termín se domlouvá individuálně.",
    keywords: "osobní trenérka Ostrava, osobní trenér Ostrava, individuální trénink, trénink na míru",
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

/** "Zdravé tělo | silový trénink" → "zdravetelosilovytrenink" – names match however they're spelled. */
const key = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** The draft for an existing lesson – same web address or the same name. */
export const templateFor = (ct: { slug: string; name: string }) =>
  LESSON_TEMPLATES.find((t) => t.slug === ct.slug || key(t.name) === key(ct.name));
