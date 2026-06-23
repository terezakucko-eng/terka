// ============================================================================
//  NAPOJENÍ DAT — sem vlož odkazy na své reporty.
//  Dokud jsou pole prázdná (''), dashboard zobrazuje UKÁZKOVÁ data
//  a místo embedů návod, jak odkaz získat.
// ============================================================================

export const config = {
  // Název firmy/klienta v hlavičce dashboardu.
  brandName: 'Růžový Slon',

  // --- Google Analytics 4 -------------------------------------------------
  // Nejjednodušší cesta bez backendu a bez tajných klíčů:
  //   1. Otevři https://lookerstudio.google.com a vytvoř report nad svou
  //      GA4 property (Create > Report > Google Analytics > vyber property).
  //   2. Vpravo nahoře: Share (Sdílet) > Embed report > zapni "Enable embedding".
  //   3. Zkopíruj URL z atributu src="..." a vlož ji sem.
  ga4: {
    lookerStudioEmbedUrl: '', // např. 'https://lookerstudio.google.com/embed/reporting/XXXX/page/YYYY'
    // GA4 property ID (formát 'properties/123456789') — využije se až
    // v pokročilém režimu s vlastním API proxy (viz README).
    propertyId: '',
  },

  // --- Power BI -----------------------------------------------------------
  // Nejjednodušší cesta (veřejná data): Publish to web.
  //   1. V Power BI Service otevři report > File > Embed report >
  //      Publish to web (public).
  //   2. Zkopíruj URL z atributu src="..." vygenerovaného iframe a vlož sem.
  //   POZOR: Publish to web je VEŘEJNÉ. Pro interní data použij
  //   "Embed for your organization" + embed token (viz README).
  powerbi: {
    embedUrl: '', // např. 'https://app.powerbi.com/view?r=XXXXXXXX'
  },
} as const
