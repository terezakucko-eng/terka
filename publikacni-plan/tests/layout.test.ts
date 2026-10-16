import { describe, expect, it } from 'vitest'
import { layoutLanes } from '../src/lib/layout'

const it_ = (id: string, dateFrom: string, dateTo: string) => ({ id, dateFrom, dateTo })

describe('layoutLanes', () => {
  it('stacks overlaps and reuses free lanes', () => {
    const { placed, lanes } = layoutLanes(
      [it_('a', '2027-02-01', '2027-02-03'), it_('b', '2027-02-02', '2027-02-02'), it_('c', '2027-02-04', '2027-02-05')],
      '2027-02-01', 7,
    )
    expect(lanes).toBe(2)
    expect(Object.fromEntries(placed.map((p) => [p.item.id, p.lane]))).toEqual({ a: 0, b: 1, c: 0 })
  })

  it('clips to the window and marks the cut ends', () => {
    const { placed } = layoutLanes([it_('a', '2027-01-25', '2027-02-10'), it_('x', '2027-03-01', '2027-03-02')], '2027-02-01', 7)
    expect(placed).toHaveLength(1)
    expect(placed[0]).toMatchObject({ start: 0, end: 6, cutStart: true, cutEnd: true })
  })

  it('reserves room for labels wider than the item', () => {
    const { lanes } = layoutLanes([it_('a', '2027-02-01', '2027-02-01'), it_('b', '2027-02-03', '2027-02-03')], '2027-02-01', 7, () => 5)
    expect(lanes).toBe(2)
  })
})
