# Marketingový dashboard (Power BI + GA4)

Dashboard, který na jednom místě spojuje data z **Google Analytics 4** a **Power BI**.
Běží lokálně (React + Vite + Tailwind), bez Netlify a bez backendu.

## Spuštění

```bash
cd dashboard-app
npm install
npm run dev
```

Otevři adresu, kterou Vite vypíše (obvykle http://localhost:5173).

Dokud nejsou napojená data, dashboard ukazuje **ukázková (mock) data** a v panelech
GA4/Power BI návod, jak napojení dokončit.

---

## Jak napojit reálná data

Veškeré napojení se dělá v jednom souboru: [`src/config.ts`](src/config.ts).
Žádné tajné klíče se nikam neukládají — používá se bezpečný **embed** publikovaných reportů.

### 1) Google Analytics 4 → přes Looker Studio (doporučeno, zdarma)

1. Otevři <https://lookerstudio.google.com>.
2. **Create → Report**, jako zdroj zvol **Google Analytics** a vyber svou GA4 property.
   Postav si v reportu metriky, které chceš (uživatelé, sessions, konverze, kanály…).
3. Vpravo nahoře **Share → Embed report** a zapni **„Enable embedding"**.
4. Zkopíruj URL z `src="…"` ve vygenerovaném `<iframe>` a vlož ji do:

   ```ts
   ga4: { lookerStudioEmbedUrl: 'https://lookerstudio.google.com/embed/reporting/...' }
   ```

### 2) Power BI → přes Embed

**Varianta A – Publish to web (veřejná data):**
1. V Power BI Service otevři report → **File → Embed report → Publish to web (public)**.
2. Zkopíruj URL z `src="…"` v iframe a vlož ji do:

   ```ts
   powerbi: { embedUrl: 'https://app.powerbi.com/view?r=...' }
   ```

> ⚠️ **Publish to web je veřejně přístupné komukoli s odkazem.** Nepoužívej pro citlivá/interní data.

**Varianta B – interní data (Embed for your organization):**
Vyžaduje Azure AD App registration + Power BI Embedded a backend, který generuje
*embed token* (token NESMÍ být ve frontendu). To je větší kapitola — když budeš chtít
jít touto cestou, napiš a doplníme malý lokální proxy server.

---

## Pokročilé: živá GA4/Power BI data ve vlastních KPI kartách

KPI karty a grafy nahoře teď používají ukázková data z [`src/data.ts`](src/data.ts).
Pro reálné hodnoty ve vlastních vizualizacích (ne jen embed) je potřeba malý
backend/proxy, protože:

- **GA4 Data API** vyžaduje service account (JSON klíč) — ten nesmí do prohlížeče.
- **Power BI REST API** vyžaduje OAuth token — taktéž serverová záležitost.

Doporučený postup: malý Node/Express (nebo Vite middleware) proxy, který klíče čte
z `.env`, volá obě API a frontendu vrací jen čistá čísla. Řekni a připravím ho.

---

## Struktura

```
src/
├─ config.ts              # ← SEM se vkládají odkazy na reporty
├─ data.ts                # ukázková data pro KPI karty a grafy
├─ App.tsx                # layout dashboardu
└─ components/
   ├─ KpiCard.tsx         # KPI karta
   ├─ LineChart.tsx       # SVG spojnicový graf návštěvnosti
   ├─ ChannelBars.tsx     # akviziční kanály
   ├─ EmbedPanel.tsx      # iframe s reportem / návod když chybí
   └─ Icons.tsx           # inline SVG ikony
```
