/**
 * Security rules against the Firestore emulator. Runs via `npm run test:rules`
 * (firebase emulators:exec); without the emulator the suite is skipped.
 */
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const host = process.env.FIRESTORE_EMULATOR_HOST
const pub = { name: 'Newsletter', dateFrom: '2027-02-01', dateTo: '2027-02-01', domains: [], channels: ['Newsletter'] }
const akce = { name: 'Valentýn', type: 'Hlavní kampaň', dateFrom: '2027-02-01', dateTo: '2027-02-14', domains: [] }

describe.skipIf(!host)('firestore.rules', () => {
  let env: RulesTestEnvironment
  const team = () => env.authenticatedContext('tereza', { email: 'tereza@ruzovyslon.cz', email_verified: true }).firestore()

  beforeAll(async () => {
    const [h, port] = host!.split(':')
    env = await initializeTestEnvironment({ projectId: 'demo-rules', firestore: { host: h, port: Number(port), rules: readFileSync('firestore.rules', 'utf8') } })
  })
  afterAll(() => env?.cleanup())
  beforeEach(() => env.clearFirestore())

  it('lets the team read and write the plan', async () => {
    const db = team()
    await assertSucceeds(setDoc(doc(db, 'plan_publikace/p1'), pub))
    await assertSucceeds(getDoc(doc(db, 'plan_publikace/p1')))
    await assertSucceeds(setDoc(doc(db, 'plan_akce/a1'), akce))
    await assertSucceeds(setDoc(doc(db, 'plan_settings/lists'), { domains: [], channels: [], akceTypes: [] }))
    await assertSucceeds(deleteDoc(doc(db, 'plan_publikace/p1')))
  })

  it('accepts the company domain in any letter case', async () => {
    const db = env.authenticatedContext('x', { email: 'Tereza@RuzovySlon.cz', email_verified: true }).firestore()
    await assertSucceeds(getDoc(doc(db, 'plan_akce/a1')))
  })

  it('keeps out visitors, other domains and unverified e-mails', async () => {
    const outsiders = [
      env.unauthenticatedContext().firestore(),
      env.authenticatedContext('g', { email: 'someone@gmail.com', email_verified: true }).firestore(),
      env.authenticatedContext('u', { email: 'tereza@ruzovyslon.cz', email_verified: false }).firestore(),
      env.authenticatedContext('f', { email: 'tereza@ruzovyslon.cz.evil.com', email_verified: true }).firestore(),
    ]
    for (const db of outsiders) {
      await assertFails(getDoc(doc(db, 'plan_publikace/p1')))
      await assertFails(setDoc(doc(db, 'plan_publikace/p2'), pub))
      await assertFails(setDoc(doc(db, 'plan_akce/a2'), akce))
      await assertFails(getDoc(doc(db, 'plan_settings/lists')))
    }
  })

  it('rejects broken records', async () => {
    const db = team()
    await assertFails(setDoc(doc(db, 'plan_publikace/p'), { ...pub, name: '' }))
    await assertFails(setDoc(doc(db, 'plan_publikace/p'), { ...pub, dateFrom: '1. 2. 2027' }))
    await assertFails(setDoc(doc(db, 'plan_publikace/p'), { ...pub, dateFrom: '2027-02-10', dateTo: '2027-02-01' }))
    await assertFails(setDoc(doc(db, 'plan_publikace/p'), { ...pub, channels: 'Newsletter' }))
    await assertFails(setDoc(doc(db, 'plan_akce/a'), { ...akce, type: 5 }))
  })

  it('leaves the old app collections as they were until the switch', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertSucceeds(setDoc(doc(db, 'campaigns/c1'), { name: 'x' }))
    await assertSucceeds(getDoc(doc(db, 'yearlyPlans/2026')))
  })
})
