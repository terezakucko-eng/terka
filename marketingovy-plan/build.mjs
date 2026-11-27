import { build, context } from 'esbuild'
import fs from 'node:fs'

const common = { bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none', jsx: 'transform', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning' }
const text = (r) => r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')

const app = text(await build({ ...common, entryPoints: ['src/index.tsx'] }))
const stub = text(await build({ ...common, entryPoints: ['src/preview-stub.ts'] }))
const css = fs.readFileSync('src/styles.css', 'utf8')

const head = `<title>Marketingový plán</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Figtree:wght@400;500;600;700&display=swap">
<style>${css}</style>`

fs.mkdirSync('dist', { recursive: true })
// the page as the Artifact tool wants it: no document skeleton of its own
fs.writeFileSync('dist/page.html', `${head}\n<div id="app"></div>\n<script>${app}</script>\n`)
// a full document with the stand-in for Claude, for trying the page in a browser
fs.writeFileSync('dist/preview.html', `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${head}</head><body><div id="app"></div><script>${stub}</script><script>${app}</script></body></html>\n`)
// the same page without the stand-in: what a person sees when the page cannot reach their spreadsheet
fs.writeFileSync('dist/demo.html', `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${head}</head><body><div id="app"></div><script>${app}</script></body></html>\n`)
console.log('page.html', (fs.statSync('dist/page.html').size / 1024).toFixed(0), 'kB')
