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

### Netlify / Vercel

Base directory / Root directory: `cv-app`. Build command `npm run build`, output `dist`.
Žádné extra proměnné. Stránka běží v rootu domény.

### GitHub Pages

V repu je workflow `.github/workflows/pages-cv-app.yml`, který build nasadí při každém pushi do
`main` měnícím `cv-app/`. Jednorázově v Settings repa → **Pages → Source: GitHub Actions**.

Workflow staví s `BASE_PATH=/terka/`, protože project page žije na
`https://<uživatel>.github.io/terka/`. Pokud repo přejmenuješ, uprav `BASE_PATH` v workflow.
