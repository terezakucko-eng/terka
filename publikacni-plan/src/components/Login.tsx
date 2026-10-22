import { useState } from 'react'
import { allowedDomains, useEmulators } from '../config'
import { signIn, signInTestUser } from '../data/store'
import { Logo } from './Sidebar'
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
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-8 shadow-panel ring-1 ring-line">
        <Logo />
        <h1 className="mt-6 font-display text-3xl font-semibold text-ink">Publikační plán</h1>
        <p className="mt-1 text-sm text-muted">Kampaně a publikace pro Růžový Slon, Kondomshop a Flagranti.</p>
        <Button variant="primary" className="mt-8 w-full py-3 text-base" onClick={() => go(signIn)} disabled={busy}>
          <svg className="size-5" viewBox="0 0 48 48" aria-hidden>
            <path fill="currentColor" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" />
          </svg>
          Přihlásit se Google účtem
        </Button>
        <p className="mt-3 text-center text-xs text-faint">Pro firemní účty @{allowedDomains.join(', @')}</p>
        {useEmulators && (
          <Button className="mt-4 w-full" onClick={() => go(() => signInTestUser())} disabled={busy}>
            Testovací přihlášení (emulátor)
          </Button>
        )}
        {(error || problem) && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error || problem}</p>}
      </div>
    </main>
  )
}
