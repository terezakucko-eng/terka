/** Semicolon-separated with a BOM, so Czech Excel opens it with diacritics and columns intact. */
export function toCsv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n')
}
