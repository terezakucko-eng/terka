import { sheetStamp, todayISO, toSheetDate } from '../lib/dates'
import {
  activityFromRow, activityToCells, calendarFromRow, competitorFromRow, competitorToCells, decisionFromRow, listsFromMatrix, monthlyFromRow,
  resultFromRow, resultToCells, CH, DH, H, KH, MH, RH, SHEET, STATUS,
  type Activity, type ActivityInput, type CalendarEntry, type CompetitorAction, type CompetitorInput, type Decision, type Lists, type MonthlyNumber,
  type Result, type ResultInput,
} from '../lib/model'
import { type Cell, newId, safeText } from '../lib/parse'
import { readMatrix, SheetError, Table, type SheetsApi } from './sheets'

export interface Data {
  lists: Lists
  activities: Activity[]
  results: Result[]
  calendar: CalendarEntry[]
  competitors: CompetitorAction[]
  decisions: Decision[]
  monthly: MonthlyNumber[]
  /** Things worth telling the person, e.g. rows the app could not read. */
  warnings: string[]
}

const REQUIRED = [H.name, H.from, H.markets, H.channel, H.owner, H.status, H.id]

/** Everything the app knows, read from and written to the spreadsheet. */
export class Store {
  private activities: Table
  private results: Table
  private calendar: Table
  private competitors: Table
  private decisions: Table
  private monthly: Table

  constructor(private api: SheetsApi, private who: () => string) {
    this.activities = new Table(api, SHEET.activities, { used: H.name, verify: H.id })
    this.results = new Table(api, SHEET.results, { used: RH.activityId, verify: RH.activityId })
    this.calendar = new Table(api, SHEET.calendar, { used: KH.name, verify: KH.name })
    this.competitors = new Table(api, SHEET.competitors, { used: CH.competitor, verify: CH.id })
    this.decisions = new Table(api, SHEET.decisions, { used: DH.key, verify: DH.key })
    this.monthly = new Table(api, SHEET.monthly, { used: MH.month, verify: MH.month })
  }

  async load(): Promise<Data> {
    // The first call is the one that asks the viewer for access, so it goes alone; the rest follow together.
    const matrix = await readMatrix(this.api, SHEET.lists)
    await Promise.all([
      this.activities.load(), this.results.load(), this.calendar.load(), this.competitors.load(), this.decisions.load(), this.monthly.load(),
    ])
    const missing = this.activities.missing(REQUIRED)
    if (missing.length) {
      throw new SheetError('missing_column', `V listu „${SHEET.activities}“ chybí ${missing.length === 1 ? 'sloupec' : 'sloupce'} ${missing.map((m) => `„${m}“`).join(', ')}. Vrať ${missing.length === 1 ? 'mu' : 'jim'} původní název a načti data znovu.`)
    }
    const warnings: string[] = []
    const lists = listsFromMatrix(matrix)
    if (!lists.markets.length || !lists.channels.length) {
      throw new SheetError('no_lists', `V listu „${SHEET.lists}“ se nepodařilo najít značky a země nebo kanály. Zkontroluj, že bloky mají v druhém řádku názvy sloupců „Kód“ a „Kanál“.`)
    }

    const withoutId = new Map<number, Cell>()
    const activities: Activity[] = []
    let unreadable = 0
    for (const row of this.activities.rows) {
      const a = activityFromRow(row)
      if (!a) { unreadable++; continue }
      a.row = Number(row.__row)
      if (!a.id) {
        a.id = newId('A')
        withoutId.set(a.row, a.id)
      }
      activities.push(a)
    }
    if (unreadable) warnings.push(`${unreadable} ${unreadable === 1 ? 'řádek v listu Aktivity nemá' : 'řádků v listu Aktivity nemá'} název nebo čitelné datum od, proto ${unreadable === 1 ? 'není' : 'nejsou'} v plánu vidět.`)
    if (withoutId.size) {
      // Rows typed straight into the sheet get their ID here, so results can refer to them.
      try { await this.activities.fillByRow(H.id, withoutId) } catch { warnings.push('Některé ručně přidané řádky ještě nemají ID. Doplní se při příštím načtení.') }
    }

    return {
      lists,
      activities,
      results: this.results.rows.map(resultFromRow).filter((r): r is Result => r !== null),
      calendar: this.calendar.rows.map(calendarFromRow).filter((c): c is CalendarEntry => c !== null),
      competitors: this.competitors.rows.map(competitorFromRow).filter((c): c is CompetitorAction => c !== null),
      decisions: this.decisions.rows.map(decisionFromRow).filter((d): d is Decision => d !== null),
      monthly: this.monthly.rows.map(monthlyFromRow).filter((m): m is MonthlyNumber => m !== null),
      warnings,
    }
  }

  async createActivities(inputs: ActivityInput[]): Promise<string[]> {
    const stamp = sheetStamp(), who = safeText(this.who())
    const ids = inputs.map(() => newId('A'))
    await this.activities.append(inputs.map((a, i) => ({ ...activityToCells(a), [H.id]: ids[i], [H.createdBy]: who, [H.createdAt]: stamp })))
    return ids
  }

  async updateActivity(id: string, input: ActivityInput): Promise<void> {
    const ok = await this.activities.update({ [H.id]: id }, { ...activityToCells(input), [H.updatedBy]: safeText(this.who()), [H.updatedAt]: sheetStamp() })
    if (!ok) throw new SheetError('row_gone', 'Tuhle aktivitu už v tabulce nevidím. Někdo ji nejspíš smazal; načti data znovu.')
  }

  /** One write for any number of activities. */
  async setStatus(ids: string[], status: string): Promise<void> {
    const changed = await this.activities.updateMany(H.id, H.status, new Map(ids.map((id) => [id, status])))
    if (changed < ids.length) throw new SheetError('row_gone', `Stav se podařilo změnit jen u ${changed} z ${ids.length} aktivit. Ostatní už v tabulce nejsou; načti data znovu.`)
  }

  /** Deleting keeps the row in the sheet with the status Smazáno, so nothing is lost for good. */
  remove(ids: string[]): Promise<void> {
    return this.setStatus(ids, STATUS.deleted)
  }

  /** Adds the result, or rewrites the one already there for the same activity and market. */
  async saveResult(activity: Activity, input: ResultInput): Promise<void> {
    const cells = { ...resultToCells(input, activity.name), [RH.by]: safeText(this.who()), [RH.at]: toSheetDate(todayISO()) }
    const updated = await this.results.update({ [RH.activityId]: input.activityId, [RH.market]: input.market }, cells)
    if (!updated) await this.results.append([cells])
  }

  async addCompetitorAction(input: CompetitorInput): Promise<void> {
    await this.competitors.append([{ ...competitorToCells(input), [CH.id]: newId('K'), [CH.by]: safeText(this.who()), [CH.at]: sheetStamp() }])
  }

  async decide(d: Decision): Promise<void> {
    await this.decisions.append([{
      [DH.key]: safeText(d.key), [DH.decision]: d.decision, [DH.reason]: safeText(d.reason), [DH.until]: d.until ? toSheetDate(d.until) : '',
      [DH.activityId]: d.activityId, [DH.who]: safeText(this.who()), [DH.when]: sheetStamp(),
    }])
  }
}

