# Publikační plán

Plán kampaní a publikací pro Růžový Slon, Kondomshop a Flagranti. Nahrazuje starou appku na
rs-publikacni-plan.netlify.app.

- **Kalendář**: měsíc s publikacemi a akcemi z ročního plánu. Klik na den přidá publikaci,
  publikace jde přetáhnout na jiný den (a hned vrátit tlačítkem „Vrátit“).
- **Rok**: roční timeline. Roční plán po typech akcí, značkách nebo doménách, publikace po kanálech.
- **Seznam**: totéž jako tabulka po měsících, s exportem pro Excel.
- **Nastavení**: seznamy domén, kanálů a typů akcí, významné dny na další rok, import ze staré
  appky a záloha.

Filtry (značka, země, kanál, hledání) i otevřený záznam jsou v adrese stránky, takže jde poslat
odkaz třeba přímo na „Kondomshop, únor 2027“ nebo na konkrétní publikaci.

## Jak to funguje

- Statická React appka (Vite) na Netlify, data ve Firebase (projekt `publikacni-plan`, Firestore).
  Server ani databázi tu není potřeba spravovat.
- Přihlášení firemním Google účtem. Kdo smí dovnitř, hlídají **pravidla ve Firestore**
  (`firestore.rules`), ne jen appka.
- Kolekce: `plan_akce` (roční plán), `plan_publikace`, `plan_settings`. Staré kolekce `campaigns` a
  `yearlyPlans` zůstávají, jak byly, dokud stará appka běží.
- Stav (V přípravě / Ke spuštění / Aktivní / Ukončená) se počítá z data. Ručně se nastavuje jen
  „Vše připraveno“.

## Spuštění (jednou)

1. **Google přihlášení**: Firebase console → projekt *publikacni-plan* → Authentication →
   Sign-in method → Google → Enable.
2. **Domény webu**: Authentication → Settings → Authorized domains → přidat adresu z Netlify
   (např. `rs-plan.netlify.app`).
3. **Pravidla**: v `firestore.rules` zkontrolovat firemní doménu (teď `ruzovyslon.cz`) a nasadit:
   ```
   npx firebase-tools@14 deploy --only firestore:rules --project publikacni-plan
   ```
   Nebo obsah souboru vložit ve Firebase console → Firestore → Rules → Publish.
4. **Netlify**: Add new site → z tohoto repa, *Base directory* `publikacni-plan`. Build a publish
   se vezmou z `netlify.toml`. Proměnná prostředí `VITE_ALLOWED_DOMAINS` = stejné domény jako
   v pravidlech (víc domén oddělit čárkou).
5. **Data**: přihlásit se → Nastavení → *Import ze staré appky* → Importovat. Pak *Významné dny*
   → 2027 → Přidat. Import jde pustit znovu, nic nezdvojí.

Po přechodu na nový plán přepnout v `firestore.rules` staré kolekce na „jen čtení pro tým“
(návod je přímo v souboru) a pravidla znovu nasadit.

### Víc firemních domén

Když se má přihlašovat i jiná doména (např. `kondomshop.cz`), přidej ji na obě místa:
- `firestore.rules`: `matches('.*@(ruzovyslon[.]cz|kondomshop[.]cz)$')`
- Netlify: `VITE_ALLOWED_DOMAINS=ruzovyslon.cz,kondomshop.cz`

## Vývoj

```
npm ci
npm run emulators        # Firebase emulátory (potřebuje Javu)
npm run dev:emulators    # appka proti emulátorům, s testovacím přihlášením
```

Ukázka bez Firebase (bez přihlášení, data jen v prohlížeči) jako jeden HTML soubor:

```
npm run build:demo                                        # prázdná ukázka
npx vite build --mode demo --outDir dist-demo && node scripts/bundle-demo.mjs export-stare-appky.json
```

Kontroly: `npm run lint`, `npm run typecheck`, `npm test` (logika: data, stavy, převod starých dat,
významné dny) a `npm run test:rules` (pravidla ve Firestore proti emulátoru).
