import { diffDays, type ISODate } from './dates'

export interface Placed<T> {
  item: T
  start: number
  end: number
  lane: number
  /** the item began before / goes on after the visible range */
  cutStart: boolean
  cutEnd: boolean
}

/**
 * Lays out date ranges over a window of `length` days starting at `from`, each in the first lane
 * where it does not overlap anything. Longer items go first so they stay in the upper lanes.
 */
export function layoutLanes<T extends { dateFrom: ISODate; dateTo: ISODate }>(
  items: T[],
  from: ISODate,
  length: number,
  width: (item: T, start: number, end: number) => number = (_, s, e) => e - s + 1,
): { placed: Placed<T>[]; lanes: number } {
  const visible = items
    .map((item) => ({ item, s: diffDays(from, item.dateFrom), e: diffDays(from, item.dateTo) }))
    .filter(({ s, e }) => e >= 0 && s < length)
    .map(({ item, s, e }) => ({ item, start: Math.max(0, s), end: Math.min(length - 1, e), cutStart: s < 0, cutEnd: e > length - 1 }))
    .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
  const laneEnds: number[] = []
  const placed = visible.map((v) => {
    const occupiedTo = v.start + Math.max(width(v.item, v.start, v.end), 1) - 1
    let lane = laneEnds.findIndex((end) => end < v.start)
    if (lane < 0) lane = laneEnds.length
    laneEnds[lane] = occupiedTo
    return { ...v, lane }
  })
  return { placed, lanes: laneEnds.length }
}
