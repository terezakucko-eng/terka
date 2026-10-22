/**
 * Stand-in for ./store in the preview build (vite --mode demo): the same API, no Firebase.
 * Data starts from the old app's export embedded in the page (#demo-data) and is kept in
 * this browser's localStorage, so every viewer has their own sandbox.
 */
import type { User } from 'firebase/auth'
import { useMemo, useSyncExternalStore } from 'react'
import { significantDayId, significantDays } from '../lib/holidays'
import { type Migrated, migrateCampaign, migrateYearly, type OldCampaign, type OldYearDoc } from '../lib/migrate'
import { type Akce, type AkceInput, DEFAULT_LISTS, type Lists, type Person, type Publikace, type PublikaceInput } from '../lib/model'
import type { AuthState, Live } from './store'

export const COL = { akce: 'plan_akce', publikace: 'plan_publikace', settings: 'plan_settings', oldCampaigns: 'campaigns', oldYearly: 'yearlyPlans' }

const KEY = 'publikacni-plan-ukazka-v1'
const DEMO_PERSON: Person = { uid: 'ukazka', name: 'Ukázkový uživatel', email: 'ukazka@ruzovyslon.cz' }

interface Old {
  campaigns: OldCampaign[]
  yearly: Record<string, OldYearDoc>
}

interface DB {
  akce: Akce[]
  publikace: Publikace[]
  lists: Lists | null
}

function readOld(): Old {
  try {
    const raw = typeof document === 'undefined' ? null : document.getElementById('demo-data')?.textContent
    if (raw) return JSON.parse(raw) as Old
  } catch {
    // no embedded data: the preview starts empty
  }
  return { campaigns: [], yearly: {} }
}

const tracked = (by: Person, at: number) => ({ createdAt: at, createdBy: by, updatedAt: at, updatedBy: by })

function seed(): DB {
  const old = readOld()
  const at = Date.now()
  const days = significantDays(new Date().getFullYear() + 1).map((d) => ({ id: significantDayId(d), ...d, ...tracked(DEMO_PERSON, at) }))
  return {
    akce: [...migrateYearly(old.yearly).map((m) => ({ id: m.id, ...m.data, ...tracked(DEMO_PERSON, at) })), ...days],
    publikace: old.campaigns.map(migrateCampaign).filter((m) => m !== null).map((m) => ({ id: m.id, ...m.data, ...tracked(DEMO_PERSON, at) })),
    lists: null,
  }
}

function load(): DB | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as DB
    // Saved before stores existed: fill in the field, keep the viewer's edits.
    return {
      ...saved,
      akce: saved.akce.map((a) => ({ ...a, stores: a.stores ?? [] })),
      publikace: saved.publikace.map((p) => ({ ...p, stores: p.stores ?? [] })),
    }
  } catch {
    return null
  }
}

let db: DB = load() ?? seed()
const listeners = new Set<() => void>()

function commit(next: DB) {
  db = next
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // storage blocked or full: keep working in memory
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

const useDb = () => useSyncExternalStore(subscribe, () => db)

/** Back to the data the preview started with. */
export function resetDemo() {
  commit(seed())
}

const newId = () => `ukazka-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
const byDate = <T extends { dateFrom: string }>(a: T, b: T) => a.dateFrom.localeCompare(b.dateFrom)

// ---------- přihlášení ----------

const DEMO_USER = { uid: DEMO_PERSON.uid, email: DEMO_PERSON.email, displayName: DEMO_PERSON.name, photoURL: null } as User

export function useAuth(): AuthState {
  return { status: 'in', user: DEMO_USER, person: DEMO_PERSON }
}

export async function signIn() {}
export async function signInTestUser() {}
export async function logOut() {}

// ---------- čtení ----------

export function usePublikace(year: number, enabled: boolean): Live<Publikace[]> {
  const { publikace } = useDb()
  return useMemo(() => {
    if (!enabled) return { data: null, error: null }
    const from = `${year - 1}-09-01`
    const to = `${year}-12-31`
    return { data: publikace.filter((p) => p.dateFrom >= from && p.dateFrom <= to).sort(byDate), error: null }
  }, [publikace, year, enabled])
}

export function useAkce(enabled: boolean): Live<Akce[]> {
  const { akce } = useDb()
  return useMemo(() => ({ data: enabled ? [...akce].sort(byDate) : null, error: null }), [akce, enabled])
}

export function useLists(enabled: boolean): Lists {
  const { lists } = useDb()
  return enabled && lists ? { ...DEFAULT_LISTS, ...lists } : DEFAULT_LISTS
}

// ---------- zápis ----------

const stamp = (by: Person) => ({ updatedAt: Date.now(), updatedBy: by })

export async function savePublikace(data: PublikaceInput, id: string | null, by: Person): Promise<string> {
  if (id) {
    commit({ ...db, publikace: db.publikace.map((p) => (p.id === id ? { ...p, ...data, ...stamp(by) } : p)) })
    return id
  }
  const created = { id: newId(), ...data, createdAt: Date.now(), createdBy: by, ...stamp(by) }
  commit({ ...db, publikace: [...db.publikace, created] })
  return created.id
}

export async function movePublikace(id: string, dateFrom: string, dateTo: string, by: Person) {
  commit({ ...db, publikace: db.publikace.map((p) => (p.id === id ? { ...p, dateFrom, dateTo, ...stamp(by) } : p)) })
}

export async function deletePublikace(id: string) {
  commit({ ...db, publikace: db.publikace.filter((p) => p.id !== id) })
}

export async function saveAkce(data: AkceInput, id: string | null, by: Person): Promise<string> {
  if (id) {
    commit({ ...db, akce: db.akce.map((a) => (a.id === id ? { ...a, ...data, ...stamp(by) } : a)) })
    return id
  }
  const created = { id: newId(), ...data, createdAt: Date.now(), createdBy: by, ...stamp(by) }
  commit({ ...db, akce: [...db.akce, created] })
  return created.id
}

export async function moveAkce(id: string, dateFrom: string, dateTo: string, by: Person) {
  commit({ ...db, akce: db.akce.map((a) => (a.id === id ? { ...a, dateFrom, dateTo, ...stamp(by) } : a)) })
}

export async function deleteAkce(id: string, by: Person) {
  commit({
    ...db,
    akce: db.akce.filter((a) => a.id !== id),
    publikace: db.publikace.map((p) => (p.akceId === id ? { ...p, akceId: null, ...stamp(by) } : p)),
  })
}

export async function saveLists(lists: Lists) {
  commit({ ...db, lists })
}

export async function createMissing<T extends object>(col: 'akce' | 'publikace', items: Migrated<T>[], by: Person): Promise<number> {
  const existing = new Set(db[col].map((x) => x.id))
  const todo = items.filter((m) => !existing.has(m.id)).map((m) => ({ id: m.id, ...m.data, createdAt: Date.now(), createdBy: by, ...stamp(by) }))
  commit({ ...db, [col]: [...db[col], ...todo] } as DB)
  return todo.length
}

export async function readOldApp() {
  const old = readOld()
  return { campaigns: old.campaigns as { id: string }[], yearly: old.yearly as Record<string, Record<string, unknown>> }
}

export async function readEverything() {
  return { exportedAt: new Date().toISOString(), akce: db.akce, publikace: db.publikace, settings: db.lists ? [{ id: 'lists', ...db.lists }] : [] }
}
