import { type ISODate } from '../lib/dates'
import { type Activity, type ActivityInput, type CompetitorAction, type Result } from '../lib/model'
import { type Data } from '../data/store'
import { type Filters } from '../lib/stats'

/** What every view gets: the loaded data, the filtered activities and the things a person can do. */
export interface Ctx {
  data: Data
  today: ISODate
  byId: Map<string, Result[]>
  /** Activities that pass the filters. */
  visible: Activity[]
  filters: Filters
  statusOf: (a: Activity) => string
  readOnly: boolean
  busy: boolean
  openActivity: (id: string) => void
  /** `suggestionKey` marks the recommendation that is accepted once the activity is created. */
  newActivity: (prefill?: Partial<ActivityInput>, suggestionKey?: string) => void
  evaluate: (ids: string[]) => void
  /** Repeats activities as ideas: shifted by a number of years, or moved to a given year. */
  duplicate: (ids: string[], to: { shift: number } | { year: number }, suggestionKey?: string) => void
  remove: (ids: string[]) => void
  newCompetitor: (date?: ISODate) => void
  go: (view: View, opts?: { year?: number; month?: number; date?: ISODate }) => void
  decide: (key: string, decision: string, extra?: { reason?: string; until?: ISODate; activityId?: string }) => void
  /** When the browser can save a file for the person. */
  saveFile?: (filename: string, content: string) => void
  competitors: CompetitorAction[]
}

export type View = 'kalendar' | 'seznam' | 'vyhodnoceni' | 'rocni-prehled' | 'doporuceni' | 'konkurence'

export const VIEWS: [View, string][] = [
  ['kalendar', 'Kalendář'], ['seznam', 'Seznam'], ['vyhodnoceni', 'Vyhodnocení'], ['rocni-prehled', 'Roční přehled'], ['doporuceni', 'Doporučení'], ['konkurence', 'Konkurence'],
]
