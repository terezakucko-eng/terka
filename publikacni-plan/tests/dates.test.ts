import { describe, expect, it } from 'vitest'
import { addDays, diffDays, easter, formatRange, monthWeeks, nthWeekday, todayISO, weekday } from '../src/lib/dates'

describe('dates', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28')
    expect(diffDays('2027-01-01', '2027-12-31')).toBe(364)
  })

  it('counts weekdays from Monday', () => {
    expect(weekday('2027-01-04')).toBe(0)
    expect(weekday('2027-01-03')).toBe(6)
  })

  it('builds Monday-first weeks covering the month', () => {
    const weeks = monthWeeks(2027, 1)
    expect(weeks[0][0]).toBe('2027-02-01')
    expect(weeks.at(-1)!.at(-1)).toBe('2027-02-28')
    expect(weeks).toHaveLength(4)
    expect(monthWeeks(2026, 10)[0][0]).toBe('2026-10-26')
  })

  it('knows Easter and moving holidays', () => {
    expect(easter(2026)).toBe('2026-04-05')
    expect(easter(2027)).toBe('2027-03-28')
    expect(easter(2028)).toBe('2028-04-16')
    expect(nthWeekday(2027, 4, 6, 2)).toBe('2027-05-09')
    expect(nthWeekday(2026, 4, 6, 2)).toBe('2026-05-10')
    expect(nthWeekday(2027, 5, 6, 3)).toBe('2027-06-20')
    expect(nthWeekday(2027, 10, 3, 4)).toBe('2027-11-25')
  })

  it('formats Czech dates', () => {
    expect(formatRange('2027-02-01', '2027-02-14')).toBe('1. 2. – 14. 2. 2027')
    expect(formatRange('2027-12-28', '2028-01-03')).toBe('28. 12. 2027 – 3. 1. 2028')
    expect(formatRange('2027-02-14', '2027-02-14')).toBe('14. 2. 2027')
  })

  it('takes today from the local calendar', () => {
    expect(todayISO(new Date(2027, 0, 1, 0, 30))).toBe('2027-01-01')
  })
})
