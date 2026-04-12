# CV — editovatelná šablona

Jednoduchá webová aplikace (React + Vite + Tailwind v4), která slouží jako editovatelná šablona CV
na míru pro Terezu Kuckovou.

## Co umí

- **Přímá editace** — klikni na libovolný text a piš. Změny se průběžně ukládají do `localStorage`
  prohlížeče, nic se nikam neposílá.
- **Vlastní foto** — tlačítko *Nahrát foto* nahoře v liště; foto se ukládá lokálně jako data URL.
- **Export do PDF** — tlačítko *Uložit jako PDF* spustí tisk prohlížeče. V dialogu zvol
  *Uložit jako PDF* a formát **A4**. Tiskové styly skryjí panel nástrojů a zarovnají stránku.
- **Reset** — tlačítko *Reset* obnoví výchozí text a smaže foto.

## Vývoj

```bash
cd cv-app
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Nasazení

Stejně jako ostatní projekty v monorepu — Netlify, base directory `cv-app`.
