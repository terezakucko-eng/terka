import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { firebaseConfig, useEmulators } from '../config'

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

// The local cache makes reopening the plan instant and saves reads against the free quota.
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  ...(useEmulators ? {} : { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }),
})

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
