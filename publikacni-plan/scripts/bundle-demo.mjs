// Packs the preview build (dist-demo, from `vite build --mode demo`) into one HTML fragment
// with the CSS and JS inlined, optionally embedding an export of the old app as the starting data.
//
//   node scripts/bundle-demo.mjs [old-app-export.json] [out.html]
//
// The export is { "campaigns": [...], "yearly": { "2026": {...} } } (documents of the old
// Firestore collections). It holds real plan data, so keep it out of the repo.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [dataPath, out = 'dist-demo/ukazka.html'] = process.argv.slice(2)
const dist = 'dist-demo'
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const js = /<script type="module" crossorigin src="\.?\/?([^"]+)"><\/script>/.exec(html)?.[1]
const css = /<link rel="stylesheet" crossorigin href="\.?\/?([^"]+)">/.exec(html)?.[1]
if (!js || !css) throw new Error('dist-demo/index.html: script or stylesheet tag not found')

// Keep "</script" sequences from closing the inline tags early.
const safe = (s) => s.replace(/<\/(script)/gi, '<\\/$1')

const parts = [
  '<title>Publikační plán</title>',
  `<style>${readFileSync(join(dist, css), 'utf8')}</style>`,
  '<div id="root"></div>',
]
if (dataPath) parts.push(`<script type="application/json" id="demo-data">${safe(readFileSync(dataPath, 'utf8'))}</script>`)
parts.push(`<script type="module">${safe(readFileSync(join(dist, js), 'utf8'))}</script>`)

writeFileSync(out, parts.join('\n'))
console.log(`${out}: ${(Buffer.byteLength(parts.join('\n')) / 1024).toFixed(0)} kB${dataPath ? ' (with data)' : ''}`)
