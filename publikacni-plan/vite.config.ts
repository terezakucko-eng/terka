/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // The preview build (npm run build:demo) swaps the Firebase data layer for an in-browser one.
  resolve: { alias: mode === 'demo' ? [{ find: /^(.*)\/data\/store$/, replacement: '$1/data/demoStore' }] : [] },
  // Firebase (auth + firestore) is most of the bundle; ~270 kB gzipped is fine for an internal tool.
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    include: ['tests/**/*.test.ts'],
  },
}))
