/**
 * Every brand, channel and plan type has one hue. Tints are mixed with the current surface,
 * so the same hue reads well in the light and the dark theme.
 */
const HUES = ['#4f46e5', '#0891b2', '#059669', '#65a30d', '#d97706', '#ea580c', '#dc2626', '#db2777', '#9333ea', '#0d9488', '#2563eb', '#a16207']

const FIXED: Record<string, string> = {
  // značky
  'Růžový Slon': '#e0077d',
  Kondomshop: '#2563eb',
  Flagranti: '#8a817d',
  // typy akcí
  'Hlavní kampaň': '#e0077d',
  'Sekundární kampaň': '#8b5cf6',
  Vendor: '#d97706',
  'Kupon do objednávek': '#059669',
  'Významný den': '#0284c7',
  // nejčastější kanály
  Newsletter: '#4f46e5',
  'HP Banner': '#ea580c',
  SMS: '#059669',
  'Doprava zdarma': '#65a30d',
  'IG - post': '#db2777',
  'IG - reels': '#9333ea',
  'IG - stories': '#c026d3',
  'IG - Influenceři': '#e11d48',
  'Magazín - články': '#0891b2',
}

function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return h >>> 0
}

/** Lightened in the dark theme (--lift) so dots and rails stay visible on a dark surface. */
const vivid = (h: string): string => `color-mix(in oklab, ${h}, #fff var(--lift))`

export const NEUTRAL_HUE = vivid('#8a817d')

export const hue = (key: string): string => (key ? vivid(FIXED[key] ?? HUES[hash(key) % HUES.length]) : NEUTRAL_HUE)

/** The hue mixed into the surface; 100 is the pure hue. */
export const tint = (h: string, pct: number): string => `color-mix(in oklab, ${h} ${pct}%, var(--surface))`
