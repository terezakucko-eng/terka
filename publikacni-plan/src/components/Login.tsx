import { useState } from 'react'
import { allowedDomains, useEmulators } from '../config'
import { signIn, signInTestUser } from '../data/store'
import { Button } from './ui'

export function Login({ error }: { error?: string }) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const go = async (fn: () => Promise<void>) => {
    setBusy(true)
    setProblem(null)
    try {
      await fn()
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') setProblem((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-50 via-white to-sky-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl ring-1 ring-slate-200">
        <div className="mb-6 flex items-center justify-center gap-3 text-3xl" aria-hidden>🐘</div>
        <h1 className="text-2xl font-bold text-slate-900">Publikační plán</h1>
        <p className="mt-1 text-sm text-slate-600">Růžový Slon · Kondomshop · Flagranti</p>
        <Button variant="primary" className="mt-8 w-full py-3 text-base" onClick={() => go(signIn)} disabled={busy}>
          <svg className="size-5" viewBox="0 0 48 48" aria-hidden>
            <path fill="#fff" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" />
          </svg>
          Přihlásit se firemním Google účtem
        </Button>
        <p className="mt-3 text-xs text-slate-500">Přístup mají účty @{allowedDomains.join(', @')}</p>
        {useEmulators && (
          <Button className="mt-4 w-full" onClick={() => go(() => signInTestUser())} disabled={busy}>
            Testovací přihlášení (emulátor)
          </Button>
        )}
        {(error || problem) && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error || problem}</p>}
      </div>
    </main>
  )
}
