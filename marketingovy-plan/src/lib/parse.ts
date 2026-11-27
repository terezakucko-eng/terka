/** Reading and writing cell values the way a Czech Google Sheet shows and accepts them. */

export type Cell = string | number | boolean | null

/**
 * '118 756 Kč', '64,4', '27,3 %', '−1 200', '1.234,5' → number. Empty or non-numeric → null.
 * Spaces of any kind are thousands separators; a comma is the decimal mark.
 */
export function parseNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw !== 'string') return null
  let s = raw.replace(/[−–]/g, '-').replace(/[^\d,.\-]/g, '')
  if (!/\d/.test(s)) return null
  const neg = s.startsWith('-')
  s = s.replace(/-/g, '')
  const comma = s.lastIndexOf(','), dot = s.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) {
    const dec = Math.max(comma, dot)
    s = s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1)
  } else if (comma >= 0) {
    s = s.replace(/,/g, (_, i: number) => (i === comma ? '.' : ''))
  } else if (dot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '')
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return neg ? -n : n
}

/** 'RS CZ, RS SK' → ['RS CZ', 'RS SK'] */
export function splitList(raw: unknown): string[] {
  if (typeof raw !== 'string') return []
  return raw.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)
}

export const joinList = (xs: string[]): string => xs.join(', ')

export const isYes = (raw: unknown): boolean => typeof raw === 'string' && /^(ano|a|yes|true|1|x)$/i.test(raw.trim())

/** Header and list values are compared without case, diacritics-sensitive, ignoring repeated spaces. */
export const norm = (s: unknown): string => (typeof s === 'string' ? s : '').replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * The sheet interprets what is typed into it, so free text that looks like a formula, number or date
 * gets a leading apostrophe, which the sheet keeps as plain text and never shows.
 */
export function safeText(raw: string): string {
  const s = raw.replace(/\r\n?/g, '\n').trim()
  if (s === '') return ''
  if (/^[=+\-@']/.test(s) || /^[\d\s.,:%/\-]+$/.test(s) || /^(true|false)$/i.test(s)) return `'${s}`
  return s
}

/** Number for a cell: empty instead of zero, because zeros are not shown in the sheet. */
export const numCell = (n: number | null | undefined): Cell => (n == null || n === 0 || !Number.isFinite(n) ? '' : Math.round(n * 100) / 100)

const nf0 = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Whole crowns; zero and missing values show as nothing. */
export function money(n: number | null | undefined, unit = true): string {
  if (n == null || !Number.isFinite(n) || Math.round(n) === 0) return ''
  return nf0.format(Math.round(n)) + (unit ? ' Kč' : '')
}

/** Short form for dense tables: 2,4 mil., 132 tis., 950 */
export function moneyShort(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || Math.round(n) === 0) return ''
  const a = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (a >= 1_000_000) return `${sign}${nf1.format(a / 1_000_000)} mil.`
  if (a >= 10_000) return `${sign}${nf0.format(a / 1000)} tis.`
  return sign + nf0.format(a)
}

export function signedMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || Math.round(n) === 0) return ''
  return (n > 0 ? '+' : '−') + nf0.format(Math.abs(Math.round(n))) + ' Kč'
}

export function count(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return ''
  return nf0.format(n)
}

export function percent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return ''
  return nf1.format(n) + ' %'
}

/** Column letters for a zero-based index: 0 → A, 26 → AA */
export function colLetter(index: number): string {
  let s = ''
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s
  return s
}

/** A sheet name as it must appear in a range. */
export const sheetRef = (name: string): string => `'${name.replace(/'/g, "''")}'`

export const uniq = <T,>(xs: Iterable<T>): T[] => [...new Set(xs)]

export function newId(prefix: string): string {
  const t = Date.now().toString(36).toUpperCase()
  const r = Math.floor(Math.random() * 36 ** 3).toString(36).toUpperCase().padStart(3, '0')
  return `${prefix}-${t}${r}`
}
