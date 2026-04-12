export type CVData = {
  // Header
  name: string
  tagline: string
  email: string
  phone: string
  location: string

  // Facts strip (under header)
  facts: string[]

  // Left sidebar
  education: Array<{ title: string; school: string; period: string }>
  skills: string[]
  tools: string[][]
  languages: string[]
  personality: string[]
  gallup: string[]

  // Right column — philosophy
  philosophyTitle: string
  philosophyText: string

  // Right column — experience entries
  experience: Array<{
    role: string
    company: string
    period: string
    description: string
    bullets: Array<{ label: string; text: string }>
  }>

  // Earlier experience
  earlier: Array<{ role: string; period: string; note: string }>

  // Collaborations (free-form lines)
  collaborations: string[]

  // Expectations
  yes: string[]
  no: string[]

  // About me columns
  aboutBoxes: Array<{ title: string; color: 'green' | 'amber' | 'red' | 'teal' | 'pink' | 'indigo'; items: string[] }>
}

export const defaultCV: CVData = {
  name: 'Tereza Kucková',
  tagline: 'Marketingová ředitelka · 7 trhů · 8členný tým · MBA Marketing',
  email: 'tereza.kucko@gmail.com',
  phone: '724 443 766',
  location: 'Ostrava, ČR',

  facts: [
    'V marketingu od 2013',
    '7 trhů střední a východní Evropy',
    'Tým: 8 lidí',
    'MBA Marketing · Newton University',
    'ENFJ · CliftonStrengths: Activator, Maximizer, Strategic',
  ],

  education: [
    { title: 'MBA — Marketing (probíhá)', school: 'Newton University', period: '' },
    { title: 'Hotelnictví a turismus', school: 'SOU a HŠ Šilheřovice', period: 'maturita' },
    { title: 'Klasický tanec', school: 'Janáčkova konzervatoř Ostrava', period: '1998–2005' },
  ],

  skills: [
    'Značka & marketingová strategie',
    'Výkonnostní marketing',
    'E-shop & optimalizace konverzí',
    'Péče o zákazníky & jejich udržení',
    'Marketingová analytika & data',
    'Marketing tvůrčího obsahu & partnerský marketing',
    'Vedení týmu & procesů',
    'Umělá inteligence v marketingu',
  ],

  tools: [
    ['Google Ads', 'Meta Ads', 'Sklik'],
    ['Heureka', 'Zboží.cz', 'Árukereső', 'Glami'],
    ['Google Analytics', 'Looker Studio', 'PowerBI', 'SimilarWeb', 'Marketing Miner'],
    ['Targito'],
    ['AffilBox', 'Dognet'],
    ['Mergado', 'Google Search Console', 'Collabim'],
    ['Basecamp', 'ClickUp', 'Trello'],
    ['ABRA', 'Google Workspace'],
    ['ChatGPT', 'Gemini', 'Claude', 'Firefly', 'NotebookLM'],
    ['Canva', 'vlastní nástroje pomocí AI'],
  ],

  languages: [
    'Čeština — rodilý mluvčí',
    'Angličtina — pokročilá',
    'CZ · SK · HU · RO · HR · BG · SI',
  ],

  personality: ['ENFJ Protagonista'],

  gallup: ['Activator', 'Maximizer', 'Strategic', 'Relator', 'Empathy'],

  philosophyTitle: 'Filozofie a přístup',
  philosophyText:
    'Marketing mě baví proto, že v něm můžu propojovat data s empatií — čísla mi dávají směr, ale empatie mi pomáhá pochopit skutečné potřeby lidí. Věci dotahuji do konce, i když cesta k nim není vždy vyšlapaná. Věřím, že dobrý marketing nepotřebuje anglické zkratky — a dokážu prodat pouze to, čemu sama věřím. Jsem milovnice češtiny — preferuji české slovní spojení před anglickou zkratkou.',

  experience: [
    {
      role: 'Vedoucí marketingu',
      company: 'Růžový Slon s.r.o.',
      period: 'Leden 2024 — současnost',
      description: 'E-commerce, 7 trhů CEE · 8členný tým · segment erotiky',
      bullets: [
        { label: 'Procesy a kvalita', text: 'Analyzuji nefunkční procesy, přenastavuji je a dohlížím na udržení kvality tam, kde se nám dlouhodobě daří.' },
        { label: 'Kreativní strategie', text: 'Hledám nové cesty k zákazníkům v segmentu, kde nám legislativa hází klacky pod nohy — marketing musí být chytřejší než překážky.' },
        { label: 'Marketing s příběhem', text: 'Věřím, že každý produkt se dá prodat skrze emoci. Proto dospělým vyprávím příběhy, které dělají značku zapamatovatelnou.' },
        { label: 'Vedení týmu', text: 'Řídím 8 lidí napříč různými disciplínami a dbám na to, aby se plány skutečně naplnily.' },
        { label: 'Meziodborová spolupráce', text: 'Úzce spolupracuji s obchodním týmem, produktovým oddělením, IT, návrháři rozhraní a zákaznickou péčí.' },
        { label: 'Regionální přesah', text: 'Primárně český trh, podpora slovenského, dohled nad dalšími pěti trhy CEE.' },
      ],
    },
    {
      role: 'Marketingový specialista',
      company: 'Růžový Slon s.r.o.',
      period: 'Červen 2022 — prosinec 2023',
      description: '',
      bullets: [
        { label: '', text: 'Budování marketingové infrastruktury od nuly a expanze z CZ/SK na 5 dalších trhů.' },
        { label: '', text: 'Srovnávače, kampaňový kalendář, influencer spolupráce, partnerský program, spolupráce s vývojáři.' },
      ],
    },
  ],

  earlier: [
    { role: 'Vedoucí PPC specialistka · PPC specialistka', period: '2021–2022', note: 'Seznam.cz — tvrdá škola výkonnostního marketingu, role obchodníka i konzultanta, školení klientů' },
    { role: 'PPC specialistka (OSVČ) · Freelance', period: '2011–2022', note: 'Správa kampaní pro malé, střední i velké klienty — Google Ads, Sklik, Meta Ads' },
    { role: 'Majitelka pohybového studia · Lektorka', period: 'rok — současnost', note: 'MOVE IN ZONE s.r.o. — skupinové i individuální lekce, organizace sportovních a tanečních eventů' },
  ],

  collaborations: [
    'Radek Hudák — nadřízený v Růžovém Slonu',
    'Karel Rujzl — výkonnostní marketing · Jakub Rejnuš — SEO · Karel Novotný — strategie značky',
    'Motionhouse — grafika a design · CzechPromotion — výzkumy a data · Behavio — behaviorální výzkumy',
  ],

  yes: [
    'Lidskost a čeština na prvním místě',
    'Příběhy a emoce jako nástroje prodeje',
    'Tah na branku a dotahování věcí',
    'Selský rozum nad teorií',
  ],

  no: [
    'Anglické zkratky tam, kde existuje český výraz',
    'Prázdné fráze o dokonalosti',
    'Složité korporátní věty',
    'Procesy pro procesy',
  ],

  aboutBoxes: [
    {
      title: 'Co umím',
      color: 'teal',
      items: [
        'Strategicky myslet a dotahovat do konce',
        'Číst data i lidi a propojit oboje',
        'Postavit tým a kulturu, kde se lidem chce pracovat',
        'Prodat značku, které věřím',
        'Psát česky — jasně a bez balastu',
      ],
    },
    {
      title: 'Co neumím a chci se naučit',
      color: 'amber',
      items: [
        'Říkat ne bez pocitu viny',
        'Angličtinu na úrovni C1',
        'Delegovat bez potřeby kontrolovat výsledek',
        'Trpělivost s pomalým rozhodováním',
      ],
    },
    {
      title: 'Co neumím',
      color: 'red',
      items: [
        'Dělat věci napůl',
        'Pracovat bez smyslu a vize',
        'Prodávat značku, které nevěřím',
        'Mlčet, když vidím, že se dá dělat líp',
      ],
    },
    {
      title: 'Co mě baví',
      color: 'pink',
      items: [
        'Marketing s reálným dopadem na růst firmy',
        'Budovat věci od nuly',
        'Lidé s tahem na branku',
        'Česky napsaný text, který dává smysl',
        'Tanec, sport, pohyb',
      ],
    },
    {
      title: 'Co mě nebaví',
      color: 'indigo',
      items: [
        'Zbytečné porady místo rozhodnutí',
        'Anglické zkratky tam, kde stačí česky',
        'Marketing jako servisní oddělení',
        'Procesy pro procesy',
      ],
    },
    {
      title: 'Co se teď učím',
      color: 'green',
      items: [
        'MBA Marketing — Newton University',
        'Umělá inteligence v marketingu',
        'Strategické finanční myšlení',
        'Vedení na úrovni nejvyššího vedení firmy',
      ],
    },
  ],
}
