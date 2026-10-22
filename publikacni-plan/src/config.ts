const env = import.meta.env

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'AIzaSyBNK4BLdITsJYfaW9zzUzK51knZfvuZIRw',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'publikacni-plan.firebaseapp.com',
  projectId: env.VITE_USE_EMULATORS === 'true' ? 'demo-publikacni-plan' : env.VITE_FIREBASE_PROJECT_ID ?? 'publikacni-plan',
  appId: env.VITE_FIREBASE_APP_ID ?? '1:181178329527:web:a85dd1e9a542f03ec16032',
}

export const useEmulators = env.VITE_USE_EMULATORS === 'true'

/** Preview build without Firebase: no sign-in, data kept in this browser only (npm run build:demo). */
export const isDemo = env.VITE_DEMO === 'true'

export const allowedDomains: string[] = (env.VITE_ALLOWED_DOMAINS ?? 'ruzovyslon.cz')
  .split(',')
  .map((d: string) => d.trim().toLowerCase())
  .filter(Boolean)

export const isAllowedEmail = (email: string | null | undefined): boolean =>
  !!email && allowedDomains.some((d) => email.toLowerCase().endsWith(`@${d}`))
