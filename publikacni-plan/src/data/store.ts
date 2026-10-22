import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithPopup, signOut, type User } from 'firebase/auth'
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, setDoc, updateDoc, where, writeBatch,
  type DocumentData, type QuerySnapshot,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { allowedDomains, isAllowedEmail, useEmulators } from '../config'
import { type Akce, type AkceInput, DEFAULT_LISTS, type Lists, type Person, type Publikace, type PublikaceInput, emptyLinks } from '../lib/model'
import { type Migrated } from '../lib/migrate'
import { auth, db } from './firebase'

export const COL = { akce: 'plan_akce', publikace: 'plan_publikace', settings: 'plan_settings', oldCampaigns: 'campaigns', oldYearly: 'yearlyPlans' }

// ---------- přihlášení ----------

export type AuthState =
  | { status: 'loading' }
  | { status: 'out'; error?: string }
  | { status: 'in'; user: User; person: Person }

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  useEffect(() => onAuthStateChanged(auth, (user) => {
    if (!user) return setState((s) => (s.status === 'out' ? s : { status: 'out' }))
    if (!isAllowedEmail(user.email)) {
      void signOut(auth)
      return setState({ status: 'out', error: `Účet ${user.email} nemá přístup. Přihlas se firemním účtem (@${allowedDomains.join(', @')}).` })
    }
    setState({ status: 'in', user, person: { uid: user.uid, name: user.displayName || user.email || '', email: user.email || '' } })
  }), [])
  return state
}

export async function signIn() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters(allowedDomains.length === 1 ? { hd: allowedDomains[0], prompt: 'select_account' } : { prompt: 'select_account' })
  await signInWithPopup(auth, provider)
}

/** Emulator only: a fake Google account, so the app can be tried without real sign-in. */
export async function signInTestUser(email = `test@${allowedDomains[0]}`) {
  if (!useEmulators) throw new Error('Testovací přihlášení funguje jen s emulátory.')
  const token = JSON.stringify({ sub: email, email, email_verified: true, name: 'Testovací uživatel' })
  await signInWithCredential(auth, GoogleAuthProvider.credential(token))
}

export const logOut = () => signOut(auth)

// ---------- čtení ----------

function withDefaults<T extends { links?: unknown }>(raw: DocumentData, id: string, base: T): T & { id: string } {
  return { ...base, ...raw, links: { ...emptyLinks(), ...(raw.links ?? {}) }, id } as T & { id: string }
}

const PUB_BASE = { name: '', dateFrom: '', dateTo: '', channels: [], domains: [], stores: [], akceId: null, description: '', ready: false, links: emptyLinks() }
const AKCE_BASE = { name: '', type: '', dateFrom: '', dateTo: '', domains: [], stores: [], benefit: '', info: '', links: emptyLinks() }

const toPublikace = (snap: QuerySnapshot) => snap.docs.map((d) => withDefaults(d.data(), d.id, PUB_BASE) as Publikace)
const toAkce = (snap: QuerySnapshot) => snap.docs.map((d) => withDefaults(d.data(), d.id, AKCE_BASE) as Akce)

export interface Live<T> {
  data: T | null
  error: string | null
}

/** Live query; results of a previous subscription (another year) are never returned for the current one. */
function useLive<T>(subscribe: (ok: (v: T) => void, fail: (e: Error) => void) => () => void, deps: unknown[]): Live<T> {
  const key = JSON.stringify(deps)
  const [state, setState] = useState<Live<T> & { key: string }>({ key: '', data: null, error: null })
  useEffect(() => {
    return subscribe((data) => setState({ key, data, error: null }), (e) => setState({ key, data: null, error: e.message }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state.key === key ? state : { data: null, error: null }
}

/**
 * Publications of one year plus a margin before it, so a campaign running across New Year
 * still shows. Loading by year keeps reads low as the history grows.
 */
export function usePublikace(year: number, enabled: boolean): Live<Publikace[]> {
  return useLive<Publikace[]>((ok, fail) => {
    if (!enabled) return () => {}
    const q = query(collection(db, COL.publikace), where('dateFrom', '>=', `${year - 1}-09-01`), where('dateFrom', '<=', `${year}-12-31`), orderBy('dateFrom'))
    return onSnapshot(q, (s) => ok(toPublikace(s)), fail)
  }, [year, enabled])
}

export function useAkce(enabled: boolean): Live<Akce[]> {
  return useLive<Akce[]>((ok, fail) => {
    if (!enabled) return () => {}
    return onSnapshot(query(collection(db, COL.akce), orderBy('dateFrom')), (s) => ok(toAkce(s)), fail)
  }, [enabled])
}

export function useLists(enabled: boolean): Lists {
  const live = useLive<Lists>((ok, fail) => {
    if (!enabled) return () => {}
    return onSnapshot(doc(db, COL.settings, 'lists'), (s) => ok({ ...DEFAULT_LISTS, ...(s.data() as Partial<Lists> | undefined) }), fail)
  }, [enabled])
  return live.data ?? DEFAULT_LISTS
}

// ---------- zápis ----------

const stamp = (by: Person) => ({ updatedAt: Date.now(), updatedBy: by })

export async function savePublikace(data: PublikaceInput, id: string | null, by: Person): Promise<string> {
  if (id) {
    await updateDoc(doc(db, COL.publikace, id), { ...data, ...stamp(by) })
    return id
  }
  const ref = await addDoc(collection(db, COL.publikace), { ...data, createdAt: Date.now(), createdBy: by, ...stamp(by) })
  return ref.id
}

export async function movePublikace(id: string, dateFrom: string, dateTo: string, by: Person) {
  await updateDoc(doc(db, COL.publikace, id), { dateFrom, dateTo, ...stamp(by) })
}

export const deletePublikace = (id: string) => deleteDoc(doc(db, COL.publikace, id))

export async function saveAkce(data: AkceInput, id: string | null, by: Person): Promise<string> {
  if (id) {
    await updateDoc(doc(db, COL.akce, id), { ...data, ...stamp(by) })
    return id
  }
  const ref = await addDoc(collection(db, COL.akce), { ...data, createdAt: Date.now(), createdBy: by, ...stamp(by) })
  return ref.id
}

export async function moveAkce(id: string, dateFrom: string, dateTo: string, by: Person) {
  await updateDoc(doc(db, COL.akce, id), { dateFrom, dateTo, ...stamp(by) })
}

/** Publications of a deleted plan item stay, they only lose the link. */
export async function deleteAkce(id: string, by: Person) {
  const linked = await getDocs(query(collection(db, COL.publikace), where('akceId', '==', id)))
  const batch = writeBatch(db)
  linked.docs.forEach((d) => batch.update(d.ref, { akceId: null, ...stamp(by) }))
  batch.delete(doc(db, COL.akce, id))
  await batch.commit()
}

export const saveLists = (lists: Lists) => setDoc(doc(db, COL.settings, 'lists'), lists)

/** Creates only documents that do not exist yet, in batches within Firestore's 500-write limit. */
export async function createMissing<T extends object>(col: 'akce' | 'publikace', items: Migrated<T>[], by: Person): Promise<number> {
  const existing = new Set((await getDocs(collection(db, COL[col]))).docs.map((d) => d.id))
  const todo = items.filter((m) => !existing.has(m.id))
  for (let i = 0; i < todo.length; i += 400) {
    const batch = writeBatch(db)
    for (const m of todo.slice(i, i + 400)) {
      batch.set(doc(db, COL[col], m.id), { ...m.data, createdAt: Date.now(), createdBy: by, ...stamp(by) })
    }
    await batch.commit()
  }
  return todo.length
}

export async function readOldApp() {
  const [campaigns, yearly] = await Promise.all([getDocs(collection(db, COL.oldCampaigns)), getDocs(collection(db, COL.oldYearly))])
  return {
    campaigns: campaigns.docs.map((d) => ({ id: d.id, ...d.data() })),
    yearly: Object.fromEntries(yearly.docs.map((d) => [d.id, d.data()])),
  }
}

/** Only the preview build (demoStore) has demo data to reset. */
export function resetDemo() {}

export async function readEverything() {
  const [akce, publikace, settings] = await Promise.all([
    getDocs(collection(db, COL.akce)), getDocs(collection(db, COL.publikace)), getDocs(collection(db, COL.settings)),
  ])
  const all = (s: QuerySnapshot) => s.docs.map((d) => ({ id: d.id, ...d.data() }))
  return { exportedAt: new Date().toISOString(), akce: all(akce), publikace: all(publikace), settings: all(settings) }
}
