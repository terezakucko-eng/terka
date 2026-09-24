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
- **Zprávy klientům** – newsletter (e-mail), SMS a WhatsApp: cílové skupiny (všichni, členové,
  permanentky, neaktivní X dní, noví, podle typu lekce, přihlášení na termín), personalizace
  `{{jmeno}}`, `{{kredit}}`, testovací zpráva, odesílání po dávkách s průběhem, přehled chyb
- souhlasy zvlášť pro e-mail / SMS / WhatsApp, odhlášení jedním klikem (i v e-mailovém klientovi)
- **Import klientů** z CSV (Excel, i starší české kódování) – jména, e-maily, telefony, kredit,
  zbývající vstupy, souhlasy; opakovatelný bez duplicit; pozvánka k nastavení hesla

## Obsah webu

Všechny texty a fotky webu (úvod, hodnoty značky, rozvrh, ceník, lekce, O mně, přihlášení,
menu, patička, kontakty, obchodní podmínky, GDPR, stránka 404) se upravují v **Admin → Obsah webu**.
Přihlášený admin vidí na každé stránce tlačítko **Upravit tuto stránku**. Fotky se nahrávají
z počítače/mobilu, server je zmenší (max. 2400 px, WebP) a uloží do databáze (`/media/…`).
Fotky typů lekcí se nahrávají v jejich sekci. Studio vede jedna lektorka – veřejně je stránka „O mně“ (`/lektori` přesměrovává), jména lektorů se na webu nezobrazují; interní seznam lektorů v adminu zůstává pro případ rozšíření. Seznam polí a výchozí texty:
`src/content/definitions.ts`; prázdné pole = návrat k výchozímu textu.

## Komunikace s klienty – co je potřeba založit

| Kanál | Služba | Co udělat |
|---|---|---|
| E-mail / newsletter | [Resend](https://resend.com) | ověřit doménu `octopush.fit` (DNS), klíč `RESEND_API_KEY` |
| SMS | [BulkGate](https://www.bulkgate.com) (CZ) | účet, dobít kredit, vytvořit API aplikaci → `BULKGATE_APP_ID`, `BULKGATE_APP_TOKEN`; schválit odesílatele „OCTOPUSH“ |
| WhatsApp | [WhatsApp Business Platform](https://business.whatsapp.com/products/business-platform) (Meta) | Meta Business účet + ověření firmy, telefonní číslo pro WhatsApp API, **schválit šablony zpráv**, trvalý token → `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` |

Hromadné zprávy přes WhatsApp jdou legálně **jen** přes oficiální API se schválenými šablonami
a jen klientům, kteří dali souhlas (opt-in). Rozesílání z běžné aplikace/WhatsApp Business
na telefonu porušuje podmínky a končí zablokováním čísla. Placené jsou za doručenou zprávu (Meta).

Bez klíčů se zprávy jen vypíšou do logu serveru – dá se vše vyzkoušet nanečisto.

**GDPR:** newsletter a marketingové SMS/WhatsApp jen se souhlasem. „Provozní“ zprávy (zrušená lekce,
zavřeno) smí jít i bez souhlasu – ne však reklama převlečená za provozní zprávu.

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

## Testovací verze (devel) zdarma – Vercel + Neon

1. [vercel.com](https://vercel.com) → **Add New… → Project** → vyber repozitář `terka`
   → **Root Directory: `fitness-studio`** → Deploy (první build může spadnout, chybí databáze – nevadí).
2. V projektu **Storage → Create Database → Neon** (Free) → připojit k projektu.
   `DATABASE_URL` se nastaví sám.
3. **Settings → Environment Variables** (pro Preview i Production):
   - `AUTH_SECRET` – libovolný dlouhý náhodný text (min. 32 znaků)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` – tvůj přístup do administrace
   - `SEED_DEMO` = `true` – naplní demo rozvrh a ceník (jen jednou, pokud je DB prázdná)
   - `ALLOW_TEST_PAYMENTS` = `true` – testovací platební brána místo Stripe
4. **Deployments → Redeploy.** Build sám založí tabulky (`scripts/prebuild.mts`).
5. Každý push do větve se nasadí automaticky; náhledové adresy chrání Vercel přihlášením
   (vidíš je jen ty) – dá se vypnout v *Settings → Deployment Protection*.

Bez klíčů Resend/BulkGate/WhatsApp se e-maily a zprávy jen vypisují do logu (Vercel → Logs).

**Náklady provozu (orientačně):** Vercel Hobby a Neon Free = 0 Kč, ale Hobby je podle podmínek
Vercelu jen pro nekomerční použití – na ostrý provoz s platbami je potřeba Vercel Pro
(~20 USD/měs.) nebo levnější VPS. Resend zdarma do 3 000 e-mailů/měs., Stripe bez měsíčního
poplatku (jen % z plateb), SMS/WhatsApp za kus, doména `.fit` ~26 USD/rok.

## Ostrý provoz nejlevněji – vlastní server (~170 Kč/měs.)

Celé studio běží na jednom malém virtuálním serveru: web, databáze PostgreSQL, HTTPS
certifikát (Caddy + Let's Encrypt), úklidový cron a noční zálohy databáze – `compose.yaml`.

**Doporučený server:** [Hetzner Cloud](https://www.hetzner.com/cloud) **CX23** (2 vCPU, 4 GB RAM,
40 GB disk, datacentrum v Německu/Finsku) – 5,49 € bez DPH měsíčně (cena od června 2026).

1. Hetzner Cloud → nový server **CX23**, obraz **Ubuntu 24.04**, přidej svůj SSH klíč.
   (Doporučeno zapnout i placené *Backups* – kopie celého serveru mimo něj.)
2. U registrátora domény nastav DNS: `A  @  <IP serveru>` a `A  www  <IP serveru>`.
3. Na serveru:
   ```bash
   curl -fsSL https://get.docker.com | sh
   git clone https://github.com/terezakucko-eng/terka.git && cd terka/fitness-studio
   cp .env.example .env && nano .env   # DOMAIN, POSTGRES_PASSWORD, AUTH_SECRET, CRON_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD…
   docker compose up -d --build
   ```
   Při startu se sama založí databáze i admin účet. Za minutu běží web na `https://<doména>`.
4. **Aktualizace:** `git pull && docker compose up -d --build`
5. **Zálohy:** každou noc do `fitness-studio/backups/` (14 dní). Jednou za čas si je stáhni
   i mimo server (`scp`), nebo zapni Hetzner Backups. Obnova:
   `docker compose exec -T db pg_restore -U octopush -d octopush --clean < backups/<soubor>.dump`

**Měsíční náklady ostrého provozu:**

| Položka | Cena |
|---|---|
| Server Hetzner CX23 | 5,49 € + DPH (~165 Kč) |
| Doména `.fit` | ~26 USD/rok (~50 Kč/měs.) |
| Databáze, HTTPS, zálohy na serveru | 0 Kč (součást serveru) |
| E-maily Resend | 0 Kč do 3 000/měs. a 100/den; newsletter pro víc lidí → placený tarif |
| Platby Stripe | bez paušálu; 1,5 % + 6,50 Kč z platby běžnou evropskou kartou |
| SMS / WhatsApp | jen za odeslané zprávy |

**Nejlevnější platby:** u permanentek a členství se vyplatí i platba převodem s QR kódem –
u Fio banky je API pro automatické párování plateb zdarma (zatím není implementováno).

## Nasazení do provozu přes Vercel (bez správy serveru)

1. **Doména** – zvolená **`octopush.fit`** (koupit např. u Cloudflare, Namecheap, Porkbun).
   Doporučeno přikoupit `octopushstudio.cz` jako přesměrování (`octopush.cz`/`.com` jsou obsazené).
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
8. **Texty** – v Admin → Obsah webu doplň adresu, IČO, kontakty, sítě a nech
   právníkovi zkontrolovat obchodní podmínky a GDPR.

## Struktura

```
src/config/site.ts       název a adresa webu (ostatní v src/content/definitions.ts)
src/db/schema.ts         datový model (Drizzle) → migrace v drizzle/
src/domain/              pravidla: rezervace, storno, pořadník, objednávky, kredit
src/lib/payments.ts      Stripe Checkout + webhooky
src/domain/campaigns.ts  cílové skupiny, souhlasy, dávkové odesílání
src/domain/import.ts     import klientů z CSV
src/lib/messaging.ts     poskytovatelé: Resend, BulkGate, WhatsApp Cloud API
src/app/(web)/           veřejný web a klientský účet
src/app/admin/           administrace
tests/                   testy rezervační logiky (vestavěný Postgres v paměti)
```

Změna schématu: uprav `schema.ts` → `npm run db:generate` → commit nové migrace.

## Značka

Barvy (moodboard „Vizuální směr“): Les `#151A13`, Šalvěj `#606350`, Země `#674329`,
Zlato `#D2A772`, Písek `#D1B89A`, Krém `#E2D1BD`, pozadí `#F3EBDE`.
Písmo: DM Sans (Regular pro běžný text, SemiBold pro nadpisy a názvy lekcí) + Allura pro claim. Nápis OCTOPUSH v logu zůstává vlastní vektorový (SVG v `public/brand`).
Logo v `public/brand/`. Fotky v `public/img/` jsou z moodboardu – nahraďte vlastními.
