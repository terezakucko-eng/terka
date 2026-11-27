import { type ISODate } from './dates'
import { STATUS, type Activity } from './model'
import { norm } from './parse'

const is = (a: string, b: string): boolean => norm(a) === norm(b)

/**
 * People set Nápad → V přípravě → Schváleno (or Zrušeno). From there the dates decide: an approved
 * activity runs between its dates and is done after them; filling in a result makes it evaluated.
 * An activity that was never approved keeps its manual status even after its dates pass.
 */
export function effectiveStatus(a: Pick<Activity, 'from' | 'to' | 'status'>, hasResult: boolean, today: ISODate): string {
  if (is(a.status, STATUS.deleted)) return STATUS.deleted
  if (is(a.status, STATUS.cancelled)) return STATUS.cancelled
  if (hasResult) return STATUS.evaluated
  if (is(a.status, STATUS.idea)) return STATUS.idea
  if (is(a.status, STATUS.prep)) return STATUS.prep
  if (today < a.from) return STATUS.approved
  if (today <= a.to) return STATUS.running
  return STATUS.done
}

/** Finished and approved, but nobody has filled in a result yet. */
export const awaitsResult = (a: Pick<Activity, 'from' | 'to' | 'status'>, hasResult: boolean, today: ISODate): boolean =>
  effectiveStatus(a, hasResult, today) === STATUS.done

/** Its dates have passed while it was still only an idea or in preparation. */
export const overdue = (a: Pick<Activity, 'from' | 'to' | 'status'>, today: ISODate): boolean =>
  (is(a.status, STATUS.idea) || is(a.status, STATUS.prep)) && today > a.to

export const isLive = (status: string): boolean => !is(status, STATUS.deleted)

export const STATUS_TONE: Record<string, string> = {
  [STATUS.idea]: 'faint', [STATUS.prep]: 'warn', [STATUS.approved]: 'info', [STATUS.running]: 'ok', [STATUS.done]: 'muted',
  [STATUS.evaluated]: 'accent', [STATUS.cancelled]: 'danger',
}
