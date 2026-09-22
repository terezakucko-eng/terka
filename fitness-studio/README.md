# OCTOPUSH – web a rezervační systém

**Každý má svou cestu.** Web studia s online rezervacemi, kreditem, permanentkami,
členstvím, jednorázovými vstupy, vstupy zdarma a administrací pro recepci.

Stack: Next.js 16 (App Router, Server Actions) · PostgreSQL + Drizzle ORM ·
Tailwind CSS 4 · Stripe (platby kartou, Apple/Google Pay, předplatné) · Resend (e-maily).

## Co umí

**Klient**
- rozvrh po týdnech s filtrem lekcí, obsazenost v reálném čase
- rezervace jedním klikem – platba **kreditem**, **permanentkou**, **členstvím**,
  **vstupem zdarma** nebo **jednorázově kartou** (místo se drží 30 min během platby)
- **lekce zdarma** pro všechny (den otevřených dveří)
- **pořadník** – při uvolnění místa se klient přihlásí automaticky a strhne se mu vstup
- storno zdarma do X hodin, pak vstup propadá
- úvodní lekce zdarma po registraci
- nákup kreditu, permanentek a členství online (členství se obnovuje měsíčně)
- účet: kredit, permanentky, nadcházející lekce, historie, platby, pohyby kreditu, profil
- e-maily: potvrzení, storno, přesun z pořadníku, zrušení lekce, obnova hesla

**Recepce / admin (`/admin`)**
- přehled: dnešní lekce, tržby, členové, obsazenost
- rozvrh: jednorázové i opakované lekce (generátor „každé Út a Čt do …“), úprava, zrušení lekce s vrácením všem
- docházka (přišel / nepřišel), přidání klienta i nad kapacitu, odhlášení s vrácením / bez
- klienti: hledání, prodej na recepci, úprava kreditu, přidělení vstupů zdarma / permanentky / členství, role
- ceník, typy lekcí, lektoři, aktuality na úvodní stránce, pravidla (storno, okno rezervací…)
- role **Lektor** vidí jen rozvrh a docházku

## Lokální spuštění

```bash
npm install
npm run db:seed   # demo data do vestavěné databáze (.data/)
npm run dev       # http://localhost:3000
```

Bez `DATABASE_URL` běží vestavěný Postgres (PGlite), bez Stripe klíčů testovací platební brána.

Demo účty: `admin@octopush.cz` / `octopush-admin`, `klient@octopush.cz` / `klient123`.

```bash
npm test          # testy rezervační logiky
npm run lint && npm run typecheck
```

## Nasazení do provozu (krok za krokem)

1. **Doména** – `octopush.cz` a `octopush.com` jsou obsazené. Volné byly např.
   `octopushstudio.cz`, `octopush-studio.cz`, `octopush-ostrava.cz`
   (ověřit a koupit u registrátora, např. Wedos, Forpsi, Active24).
2. **Databáze** – založ projekt na [Neon](https://neon.tech) (region Frankfurt), zkopíruj connection string.
3. **Hosting** – na [Vercel](https://vercel.com) importuj repozitář, *Root Directory* = `fitness-studio`.
   Nastav proměnné z `.env.example`.
4. **Migrace a první admin** – lokálně s produkční `DATABASE_URL`:
   ```bash
   DATABASE_URL=… ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run db:seed
   ```
   (vytvoří tabulky, admina a demo ceník/rozvrh – v administraci je uprav nebo skryj).
   Pro čisté migrace bez dat: `npm run db:migrate`.
5. **Doména → Vercel** – v nastavení projektu přidej doménu, u registrátora nastav DNS
   (`A @ 76.76.21.21`, `CNAME www cname.vercel-dns.com`). HTTPS se zapne samo.
6. **Stripe** – účet na [stripe.com](https://stripe.com), aktivovat CZK výplaty.
   Webhook: `https://<doména>/api/webhooks/stripe` s událostmi
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.expired`, `invoice.paid`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Klíče do `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`.
7. **E-maily** – [Resend](https://resend.com): ověř doménu (DNS záznamy), klíč do `RESEND_API_KEY`.
8. **Texty** – zkontroluj `src/config/site.ts` (adresa, IČO, kontakty, sítě) a nech
   právníkovi zkontrolovat obchodní podmínky a GDPR.

## Struktura

```
src/config/site.ts       značka, kontakty, hodnoty z moodboardu
src/db/schema.ts         datový model (Drizzle) → migrace v drizzle/
src/domain/              pravidla: rezervace, storno, pořadník, objednávky, kredit
src/lib/payments.ts      Stripe Checkout + webhooky
src/app/(web)/           veřejný web a klientský účet
src/app/admin/           administrace
tests/                   testy rezervační logiky (vestavěný Postgres v paměti)
```

Změna schématu: uprav `schema.ts` → `npm run db:generate` → commit nové migrace.

## Značka

Barvy (moodboard „Vizuální směr“): Les `#151A13`, Šalvěj `#606350`, Země `#674329`,
Zlato `#D2A772`, Písek `#D1B89A`, Krém `#E2D1BD`, pozadí `#F3EBDE`.
Písmo: Inter (náhrada Nimbus Sans / Helvetica z moodboardu) + Allura pro claim.
Logo v `public/brand/`. Fotky v `public/img/` jsou z moodboardu – nahraďte vlastními.
