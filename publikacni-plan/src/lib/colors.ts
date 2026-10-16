export interface Swatch {
  bg: string
  fg: string
  border: string
}

const PALETTE: Swatch[] = [
  { bg: '#fce7f3', fg: '#9d174d', border: '#f9a8d4' },
  { bg: '#e0e7ff', fg: '#3730a3', border: '#a5b4fc' },
  { bg: '#dcfce7', fg: '#166534', border: '#86efac' },
  { bg: '#fef3c7', fg: '#92400e', border: '#fcd34d' },
  { bg: '#cffafe', fg: '#155e75', border: '#67e8f9' },
  { bg: '#f3e8ff', fg: '#6b21a8', border: '#d8b4fe' },
  { bg: '#ffedd5', fg: '#9a3412', border: '#fdba74' },
  { bg: '#e0f2fe', fg: '#075985', border: '#7dd3fc' },
  { bg: '#ecfccb', fg: '#3f6212', border: '#bef264' },
  { bg: '#fee2e2', fg: '#991b1b', border: '#fca5a5' },
  { bg: '#ccfbf1', fg: '#115e59', border: '#5eead4' },
  { bg: '#fae8ff', fg: '#86198f', border: '#f0abfc' },
]

const FIXED: Record<string, Swatch> = {
  'Růžový Slon': { bg: '#fbcfe8', fg: '#831843', border: '#ec4899' },
  Kondomshop: { bg: '#dbeafe', fg: '#1e3a8a', border: '#60a5fa' },
  Flagranti: { bg: '#e5e7eb', fg: '#111827', border: '#6b7280' },
  'Hlavní kampaň': { bg: '#fbcfe8', fg: '#831843', border: '#ec4899' },
  'Sekundární kampaň': { bg: '#ede9fe', fg: '#4c1d95', border: '#a78bfa' },
  Vendor: { bg: '#fef3c7', fg: '#78350f', border: '#f59e0b' },
  'Kupon do objednávek': { bg: '#d1fae5', fg: '#064e3b', border: '#34d399' },
  'Významný den': { bg: '#e0f2fe', fg: '#0c4a6e', border: '#38bdf8' },
}

function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return h >>> 0
}

export const swatch = (key: string): Swatch => FIXED[key] ?? PALETTE[hash(key) % PALETTE.length]

export const NEUTRAL: Swatch = { bg: '#f1f5f9', fg: '#334155', border: '#cbd5e1' }
