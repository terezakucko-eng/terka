import { type Row } from '../lib/model'
import { type Cell, colLetter, norm, sheetRef } from '../lib/parse'

/** The three spreadsheet operations the app needs. Values come back as the sheet displays them. */
export interface SheetsApi {
  getValues(range: string): Promise<string[][]>
  /**
   * `null` cells are left as they are. Writing into a range keeps the formats, drop-down lists and formulas of the
   * sheet; adding rows with the connector's append would insert rows that lose them, so the app never appends.
   */
  updateValues(range: string, values: Cell[][]): Promise<void>
}

export class SheetError extends Error {
  constructor(readonly code: string, message: string, readonly retryable = false) {
    super(message)
  }
}

const CHUNK = 1500
const LAST_ROW = 20000

/**
 * One sheet read as a table: a header row and records below it. Columns are addressed by header text,
 * never by position, so people can reorder or add columns in the sheet without breaking the app.
 */
export class Table {
  headers: string[] = []
  rows: Row[] = []
  private index = new Map<string, number>()

  /**
   * `used` is a column that is filled in every row someone has started (rows typed by hand included), so the first
   * free row can be found. `verify` is a column the app fills with a value that is its own, to confirm a write landed.
   */
  constructor(private api: SheetsApi, readonly sheet: string, private cols: { used: string; verify: string }, private headerRow = 1, private lastCol = 'AZ') {}

  private ref(range: string): string {
    return `${sheetRef(this.sheet)}!${range}`
  }

  async load(): Promise<void> {
    const all: string[][] = []
    for (let start = this.headerRow; start < LAST_ROW; start += CHUNK) {
      const part = await this.api.getValues(this.ref(`A${start}:${this.lastCol}${start + CHUNK - 1}`))
      all.push(...part)
      if (part.length < CHUNK) break
    }
    this.headers = (all[0] ?? []).map((h) => String(h ?? ''))
    this.index = new Map()
    this.headers.forEach((h, i) => { if (norm(h) && !this.index.has(norm(h))) this.index.set(norm(h), i) })
    this.rows = []
    all.slice(1).forEach((cells, i) => {
      if (!cells.some((c) => String(c ?? '').trim() !== '')) return
      const row: Row = { __row: String(this.headerRow + 1 + i) }
      for (const [h, c] of this.index) row[h] = String(cells[c] ?? '')
      this.rows.push(row)
    })
  }

  has(header: string): boolean {
    return this.index.has(norm(header))
  }

  missing(required: string[]): string[] {
    return required.filter((h) => !this.has(h))
  }

  private toRow(cells: Record<string, Cell>): Cell[] {
    const row: Cell[] = Array(this.headers.length).fill(null)
    for (const [header, value] of Object.entries(cells)) {
      const col = this.index.get(norm(header))
      if (col != null) row[col] = value
    }
    return row
  }

  private get width(): string {
    return colLetter(Math.max(this.headers.length - 1, 0))
  }

  /**
   * Writes records into the first free rows below the last used one, then reads the key column back to make sure
   * nobody else wrote there at the same moment. If somebody did, the write is repeated in the next free rows.
   */
  async append(records: Record<string, Cell>[]): Promise<void> {
    if (!records.length) return
    if (!this.headers.length) throw new SheetError('no_headers', `List „${this.sheet}“ nemá řádek s názvy sloupců.`)
    const rows = records.map((r) => this.toRow(r))
    const expected = records.map((r) => String(r[this.cols.verify] ?? '').replace(/^'/, '').trim())
    for (let attempt = 0; attempt < 3; attempt++) {
      const used = await this.column(this.cols.used)
      let last = used.length - 1
      while (last > 0 && used[last] === '') last--
      const first = this.headerRow + last + 1
      await this.api.updateValues(this.ref(`A${first}:${this.width}${first + rows.length - 1}`), rows)
      const check = await this.column(this.cols.verify)
      if (expected.every((value, i) => (check[first - this.headerRow + i] ?? '') === value)) return
    }
    throw new SheetError('write_conflict', 'Do tabulky právě zapisoval ještě někdo další a zápis se nepodařilo potvrdit. Načti data znovu, zkontroluj, jestli se aktivita uložila, a případně ji založ znovu.')
  }

  private async column(header: string): Promise<string[]> {
    const col = this.index.get(norm(header))
    if (col == null) throw new SheetError('missing_column', `V listu „${this.sheet}“ chybí sloupec „${header}“.`)
    const letter = colLetter(col)
    const values = await this.api.getValues(this.ref(`${letter}${this.headerRow}:${letter}${LAST_ROW}`))
    if (norm(values[0]?.[0]) !== norm(header)) {
      throw new SheetError('columns_moved', `Sloupce v listu „${this.sheet}“ se mezitím změnily. Načti data znovu a akci zopakuj.`)
    }
    return values.map((r) => String(r[0] ?? '').trim())
  }

  /** The sheet row that holds these key values right now; rows may have moved since the table was loaded. */
  async findRow(keys: Record<string, string>): Promise<number | null> {
    const entries = Object.entries(keys)
    const columns = await Promise.all(entries.map(([header]) => this.column(header)))
    const length = Math.max(...columns.map((c) => c.length))
    for (let i = 1; i < length; i++) {
      if (entries.every(([, value], k) => (columns[k][i] ?? '') === value.trim())) return this.headerRow + i
    }
    return null
  }

  /** Writes the given columns of the row found by key; other cells of the row stay untouched. */
  async update(keys: Record<string, string>, cells: Record<string, Cell>): Promise<boolean> {
    const row = await this.findRow(keys)
    if (row == null) return false
    await this.api.updateValues(this.ref(`A${row}:${this.width}${row}`), [this.toRow(cells)])
    return true
  }

  /** Sets one column for many rows in a single write. `byKey` maps the key column's value to the new cell. */
  async updateMany(keyHeader: string, header: string, byKey: Map<string, Cell>): Promise<number> {
    if (!byKey.size) return 0
    const col = this.index.get(norm(header))
    if (col == null) throw new SheetError('missing_column', `V listu „${this.sheet}“ chybí sloupec „${header}“.`)
    const keysNow = await this.column(keyHeader)
    const hits: { row: number; value: Cell }[] = []
    keysNow.forEach((k, i) => { if (i > 0 && byKey.has(k)) hits.push({ row: this.headerRow + i, value: byKey.get(k)! }) })
    if (!hits.length) return 0
    const first = Math.min(...hits.map((h) => h.row)), last = Math.max(...hits.map((h) => h.row))
    const values: Cell[][] = Array.from({ length: last - first + 1 }, () => [null])
    for (const h of hits) values[h.row - first] = [h.value]
    const letter = colLetter(col)
    await this.api.updateValues(this.ref(`${letter}${first}:${letter}${last}`), values)
    return hits.length
  }

  /** Fills one column for rows addressed by the row numbers of the load that just finished. */
  async fillByRow(header: string, byRow: Map<number, Cell>): Promise<void> {
    if (!byRow.size) return
    const col = this.index.get(norm(header))
    if (col == null) return
    const first = Math.min(...byRow.keys()), last = Math.max(...byRow.keys())
    const values: Cell[][] = Array.from({ length: last - first + 1 }, (_, i) => [byRow.get(first + i) ?? null])
    const letter = colLetter(col)
    await this.api.updateValues(this.ref(`${letter}${first}:${letter}${last}`), values)
  }
}

/** A whole sheet as a grid of displayed values, for sheets that are not a single table. */
export async function readMatrix(api: SheetsApi, sheet: string, range = 'A1:AZ400'): Promise<string[][]> {
  const values = await api.getValues(`${sheetRef(sheet)}!${range}`)
  return values.map((r) => r.map((c) => String(c ?? '')))
}
