# Publikační plán

Plán kampaní a publikací pro Růžový Slon, Kondomshop a Flagranti. Nahrazuje starou appku na
rs-publikacni-plan.netlify.app.

- **Kalendář**: měsíc s publikacemi a akcemi z ročního plánu. Klik na den přidá publikaci,
  publikace jde přetáhnout na jiný den (a hned vrátit tlačítkem „Vrátit“).
- **Rok**: roční timeline. Roční plán po typech akcí, značkách nebo doménách, publikace po kanálech.
- **Seznam**: totéž jako tabulka po měsících, s exportem pro Excel.
- **Prodejny**: publikaci i akci jde přiřadit ke kamenným prodejnám Růžového slona; filtr v levém
  panelu a v ročním přehledu řádky po prodejnách.
- **Nastavení**: seznamy domén, kanálů, prodejen a typů akcí, významné dny na další rok, import ze
  staré appky a záloha.

Filtry (značka, země, kanál, hledání) i otevřený záznam jsou v adrese stránky, takže jde poslat
odkaz třeba přímo na „Kondomshop, únor 2027“ nebo na konkrétní publikaci.

## Jak to funguje

- Statická React appka (Vite) na Firebase Hosting, data ve Firebase (projekt `publikacni-plan`, Firestore).
  Server ani databázi tu není potřeba spravovat.
- Přihlášení firemním Google účtem. Kdo smí dovnitř, hlídají **pravidla ve Firestore**
  (`firestore.rules`), ne jen appka.
- Kolekce: `plan_akce` (roční plán), `plan_publikace`, `plan_settings`. Staré kolekce `campaigns` a
  `yearlyPlans` zůstávají, jak byly, dokud stará appka běží.
- Stav (V přípravě / Ke spuštění / Aktivní / Ukončená) se počítá z data. Ručně se nastavuje jen
  „Vše připraveno“.

## Spuštění (jednou)

Appka běží na **Firebase Hosting** ve stejném projektu jako data:
**https://publikacni-plan.web.app**. Tahle adresa je pro přihlášení povolená automaticky.

1. **Google přihlášení**: Firebase console → projekt *publikacni-plan* → Authentication →
   Sign-in method → Google → Enable.
2. **Nasazení appky i pravidel** (`firestore.rules`, firemní doména `ruzovyslon.cz`):
   - ručně z počítače: `npx firebase-tools@14 login` a pak `npm run deploy`,
   - nebo automaticky po každé změně v `main`: v GitHubu nastavit secret
     `FIREBASE_SERVICE_ACCOUNT` (JSON klíč servisního účtu s rolemi *Firebase Hosting Admin*
     a *Firebase Rules Admin*); workflow `deploy-publikacni-plan.yml` pak nasazuje sám.
3. **Data**: přihlásit se → Nastavení → *Import ze staré appky* → Importovat. Pak *Významné dny*
   → 2027 → Přidat. Import jde pustit znovu, nic nezdvojí.

Na Netlify jde appka nasadit taky (`netlify.toml`, Base directory `publikacni-plan`); pak je
potřeba přidat její adresu do Authentication → Settings → Authorized domains.

Po přechodu na nový plán přepnout v `firestore.rules` staré kolekce na „jen čtení pro tým“
(návod je přímo v souboru) a pravidla znovu nasadit.

### Víc firemních domén

Když se má přihlašovat i jiná doména (např. `kondomshop.cz`), přidej ji na obě místa:
- `firestore.rules`: `matches('.*@(ruzovyslon[.]cz|kondomshop[.]cz)$')`
- při buildu: `VITE_ALLOWED_DOMAINS=ruzovyslon.cz,kondomshop.cz`

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
