export type DataViewType = 'yoy' | 'plan' | 'real';

export interface MonthlyData {
  yoy: number[];    // Year over Year (previous year actuals)
  plan: number[];   // Planned values for 2026
  real: number[];   // Actual values for 2026
}

export interface BudgetItem {
  id: string;
  project?: string;            // Projekt
  country?: string;            // Země
  accountCode: string;         // Účet
  name: string;                // Popis
  note?: string;
  monthly: number[];           // Default/current view
  monthlyData?: MonthlyData;   // All three data types
  total: number;
  totalYoy?: number;
  totalPlan?: number;
  totalReal?: number;
  percentage?: number;
  isCategory?: boolean;
  isSubItem?: boolean;
}

export interface BudgetCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  items: BudgetItem[];
  total: number;
  percentage: number;
}

export const months = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

export const budgetData: BudgetCategory[] = [
  {
    id: 'darky',
    name: 'MARKETING - DÁRKY',
    color: '#ec4899',
    icon: '',
    total: 2980335,
    percentage: 0.93,
    items: [
      {
        id: 'darky-1',
        accountCode: '50402',
        name: 'Poskytnuté dárky - neslíbené',
        note: '0,40%',
        monthly: [341262, 353167, 266064, 84386, 84971, 85935, 106861, 110997, 90340, 91872, 110153, 154326],
        total: 1880335,
      },
      {
        id: 'darky-2',
        accountCode: '51301',
        name: 'Poskytnuté dary - zásoby',
        note: 'kategorie 1',
        monthly: [0, 0, 0, 0, 0, 0, 0, 1100000, 0, 0, 0, 0],
        total: 1100000,
      },
    ],
  },
  {
    id: 'tv-radio',
    name: 'MARKETING - TV + RÁDIO, billboardy',
    color: '#8b5cf6',
    icon: '',
    total: 24220000,
    percentage: 7.52,
    items: [
      {
        id: 'tv-1',
        accountCode: '518301',
        name: 'TV Nova',
        note: '3,6 by se mělo vyčerpat v Q1',
        monthly: [850000, 850000, 850000, 850000, 850000, 850000, 850000, 850000, 850000, 850000, 850000, 850000],
        total: 10200000,
      },
      {
        id: 'tv-2',
        accountCode: '518303',
        name: 'Markíza',
        monthly: [283333, 283333, 283333, 283333, 283333, 283333, 283333, 283333, 283333, 283333, 283333, 283333],
        total: 3400000,
      },
      {
        id: 'tv-3',
        accountCode: '518304',
        name: 'Rádio',
        note: 'dle odhadu MQI + brandboost objem ekondomy',
        monthly: [750000, 750000, 750000, 750000, 750000, 750000, 750000, 750000, 750000, 750000, 750000, 750000],
        total: 9000000,
      },
      {
        id: 'tv-4',
        accountCode: '518332',
        name: 'Náklady na výrobu TV/rádio spotů',
        note: 'sníženo kvůli sponzoringu',
        monthly: [25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000],
        total: 300000,
      },
      {
        id: 'tv-5',
        accountCode: '518503',
        name: 'Billboardy',
        monthly: [110000, 110000, 110000, 110000, 110000, 110000, 110000, 110000, 110000, 110000, 110000, 110000],
        total: 1320000,
      },
    ],
  },
  {
    id: 'ppc',
    name: 'MARKETING - PPC + výkonnostní MKG',
    color: '#3b82f6',
    icon: '',
    total: 28143393,
    percentage: 8.74,
    items: [
      {
        id: 'ppc-1',
        accountCode: '518401',
        name: 'PPC Google CZ',
        note: 'sjednoceno do jednoho řádku PNO dle plánu',
        monthly: [1948054, 2280544, 1440746, 1446030, 1548534, 1545730, 2080052, 2284504, 1732631, 1725180, 2336795, 3408563],
        total: 23777362,
      },
      {
        id: 'ppc-2',
        accountCode: '518407',
        name: 'Externí služby - PPC',
        note: 'Lukáš Gvužď',
        monthly: [57600, 57600, 57600, 57600, 57600, 57600, 57600, 57600, 57600, 57600, 57600, 57600],
        total: 691200,
      },
      {
        id: 'ppc-3',
        accountCode: '518408',
        name: 'SMS',
        note: '0,5 % k tržbám (netto)',
        monthly: [114525, 132145, 82746, 84378, 90576, 89215, 120462, 133417, 99965, 98840, 137129, 194286],
        total: 1377685,
      },
      {
        id: 'ppc-4',
        accountCode: '518411',
        name: 'Emailing',
        monthly: [55000, 55000, 55000, 55000, 55000, 55000, 55000, 55000, 55000, 55000, 55000, 55000],
        total: 660000,
      },
      {
        id: 'ppc-5',
        accountCode: '518412',
        name: 'Externí služby - Emailing',
        note: 'Tomáš Vaculík',
        monthly: [26985, 24623, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        total: 51608,
      },
      {
        id: 'ppc-6',
        accountCode: '518413',
        name: 'Sociální sítě - kampaně',
        note: 'Facebook, Instagram',
        monthly: [30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000],
        total: 360000,
      },
      {
        id: 'ppc-7',
        accountCode: '518414',
        name: 'Influenceři',
        monthly: [50000, 100000, 50000, 50000, 50000, 50000, 100000, 100000, 50000, 50000, 100000, 100000],
        total: 850000,
      },
      {
        id: 'ppc-8',
        accountCode: '518501',
        name: 'Affiliate provize',
        note: 'zrušit aktuální PNO úroveň k 50 %',
        monthly: [22905, 26429, 16549, 16876, 18115, 17843, 24092, 26683, 19993, 19768, 27426, 38857],
        total: 275537,
      },
      {
        id: 'ppc-9',
        accountCode: '518444',
        name: 'Ostatní MKG - PPC + výkonnostní MKG',
        note: 'INT emailing',
        monthly: [50000, 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        total: 100000,
      },
    ],
  },
  {
    id: 'ostatni',
    name: 'MARKETING - ostatní',
    color: '#10b981',
    icon: '',
    total: 2465659,
    percentage: 0.77,
    items: [
      {
        id: 'ostatni-1',
        accountCode: '518502',
        name: 'Tiskoviny',
        note: 'služby (Commarec)',
        monthly: [12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000],
        total: 144000,
      },
      {
        id: 'ostatni-2',
        accountCode: '518505',
        name: 'Ostatní reklama',
        note: 'ona dnes, Dny Marianne apod.',
        monthly: [10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000],
        total: 120000,
      },
      {
        id: 'ostatni-3',
        accountCode: '518506',
        name: 'Mergado',
        note: 'roční platba',
        monthly: [50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        total: 50000,
      },
      {
        id: 'ostatni-4',
        accountCode: '518507',
        name: 'PR',
        note: 'Lenka Rudišová, PR BONUS - stáhnout na 50k měsíčně',
        monthly: [30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000],
        total: 360000,
      },
      {
        id: 'ostatni-5',
        accountCode: '518508',
        name: 'Konference',
        note: 'pořadatelé konferencí, sponzoring',
        monthly: [0, 300000, 0, 0, 0, 0, 300000, 0, 0, 0, 0, 0],
        total: 600000,
      },
      {
        id: 'ostatni-6',
        accountCode: '518511',
        name: 'Ostatní',
        monthly: [125061, 111761, 163975, 110000, 110000, 110000, 142203, 156697, 131962, 10000, 10000, 10000],
        total: 1191659,
      },
    ],
  },
  {
    id: 'externi',
    name: 'EXTERNÍ SLUŽBY',
    color: '#f59e0b',
    icon: '',
    total: 2359500,
    percentage: 0.73,
    items: [
      {
        id: 'externi-1',
        accountCode: '518605',
        name: 'Zpracování dat',
        note: 'Mamata, M.Merglevský, PowerBI',
        monthly: [60000, 60000, 60000, 60000, 60000, 60000, 60000, 60000, 60000, 60000, 60000, 60000],
        total: 720000,
      },
      {
        id: 'externi-2',
        accountCode: '518607',
        name: 'Grafické služby',
        note: 'M.Mito - nahradit za grafika?',
        monthly: [45000, 45000, 45000, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        total: 135000,
      },
      {
        id: 'externi-3',
        accountCode: '518608',
        name: 'Online marketing / SEO',
        note: 'J. Rejnuš',
        monthly: [50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000],
        total: 600000,
      },
      {
        id: 'externi-4',
        accountCode: '518609',
        name: 'Překlady a korektury',
        monthly: [6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000],
        total: 72000,
      },
      {
        id: 'externi-5',
        accountCode: '518610',
        name: 'Focení',
        note: 'vše související s focením a natáčením',
        monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 7500, 7500, 7500],
        total: 22500,
      },
      {
        id: 'externi-6',
        accountCode: '518611',
        name: 'Externistí služby - brand',
        note: 'K.Novotný',
        monthly: [60000, 60000, 60000, 60000, 60000, 60000, 60000, 60000, 60000, 50000, 50000, 50000],
        total: 690000,
      },
      {
        id: 'externi-7',
        accountCode: '518666',
        name: 'Ostatní',
        monthly: [10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000],
        total: 120000,
      },
    ],
  },
  {
    id: 'it',
    name: 'IT',
    color: '#6366f1',
    icon: '',
    total: 51970,
    percentage: 0.02,
    items: [
      {
        id: 'it-1',
        accountCode: '518777',
        name: 'Ostatní',
        note: 'Foxentry, Overlook, GetWebCraft',
        monthly: [16492, 500, 3259, 7183, 3468, 3978, 3415, 4081, 3594, 2000, 2000, 2000],
        total: 51970,
      },
    ],
  },
  {
    id: 'sluzby',
    name: 'SLUŽBY, REŽIJNÍ NÁKLADY',
    color: '#14b8a6',
    icon: '',
    total: 188545,
    percentage: 0.06,
    items: [
      {
        id: 'sluzby-1',
        accountCode: '51200',
        name: 'Cestovné',
        monthly: [2211, 6180, 14923, 29032, 14730, 18987, 1886, 80, 1318, 3000, 3000, 3000],
        total: 98347,
      },
      {
        id: 'sluzby-2',
        accountCode: '518806',
        name: 'Operativní leasing',
        note: 'operativní leasing',
        monthly: [0, 0, 0, 0, 0, 0, 7000, 7000, 7000, 7000, 7000, 7000],
        total: 42000,
      },
      {
        id: 'sluzby-3',
        accountCode: '501802',
        name: 'Auta - benzin, provozní kapaliny',
        note: 'benzin, pomocné tekutiny',
        monthly: [0, 0, 0, 0, 0, 0, 2000, 2000, 2000, 2000, 2000, 2000],
        total: 12000,
      },
      {
        id: 'sluzby-4',
        accountCode: '518809',
        name: 'Konference, školení, kurzy',
        note: 'vstupenky',
        monthly: [11198, 0, 10000, 0, 0, 0, 0, 0, 0, 5000, 5000, 5000],
        total: 36198,
      },
    ],
  },
  {
    id: 'mzdy',
    name: 'MZDY',
    color: '#ef4444',
    icon: '',
    total: 4529736,
    percentage: 1.41,
    items: [
      {
        id: 'mzdy-1',
        accountCode: '52100',
        name: 'Mzdové náklady - HPP',
        monthly: [377478, 377478, 377478, 377478, 377478, 377478, 377478, 377478, 377478, 377478, 377478, 377478],
        total: 4529736,
      },
    ],
  },
];

export const grandTotal = {
  monthly: [5580106, 6206761, 4869675, 4604296, 4696806, 4698099, 5664383, 6701871, 4915214, 4788572, 5514414, 6698943],
  total: 64939138,
  percentage: 20.17,
};
