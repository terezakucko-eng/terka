import { diffDays, type ISODate } from './dates'

export interface Placed<T> {
  item: T
  /** zero-based day (or column) where the bar starts and ends inside the window */
  start: number
  end: number
  lane: number
  /** the item began before / goes on after the visible window */
  cutStart: boolean
  cutEnd: boolean
}

/**
 * Lays out date ranges over a window of `length` days that starts at `from`, each in the first lane where it
 * does not overlap anything. Longer items go first so they stay in the upper lanes.
 */
export function layoutLanes<T extends { from: ISODate; to: ISODate }>(items: T[], from: ISODate, length: number): { placed: Placed<T>[]; lanes: number } {
  const visible = items
    .map((item) => ({ item, s: diffDays(from, item.from), e: diffDays(from, item.to) }))
    .filter(({ s, e }) => e >= 0 && s < length)
    .map(({ item, s, e }) => ({ item, start: Math.max(0, s), end: Math.min(length - 1, e), cutStart: s < 0, cutEnd: e > length - 1 }))
    .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
  const laneEnds: number[] = []
  const placed = visible.map((v) => {
    let lane = laneEnds.findIndex((end) => end < v.start)
    if (lane < 0) lane = laneEnds.length
    laneEnds[lane] = v.end
    return { ...v, lane }
  })
  return { placed, lanes: laneEnds.length }
}
