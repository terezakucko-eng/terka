/*
 * Konfigurace: kanály + jejich formáty, jazykové mutace, šablony.
 *
 * Formáty jsou organizované podle KANÁLŮ (kam banner poletí). Nový rozměr
 * přidáš do příslušného kanálu v CHANNELS, nový kanál přidáš jako další
 * položku. FORMATS se z CHANNELS odvodí automaticky (ploché pole, které
 * používá zbytek aplikace).
 */
(function (global) {
  'use strict';

  // Kanály a jejich rozměry. note = volitelné upřesnění (desktop/mobil/feed…).
  // maxKB = doporučený limit velikosti souboru (JPG) daného kanálu; export ho
  // umí automaticky dodržet. null/neuvedeno = bez tvrdého limitu.
  // Rozměry potvrzené zadavatelem; kanály bez rozměrů čekají na doplnění.
  const CHANNELS = [
    {
      // Zdrojový „master" čtverec — tady navrhneš kompozici a těžiště,
      // ostatní rozměry se z toho generují (cover ořez dle těžiště).
      id: 'master',
      label: '⭐ Master (zdrojový čtverec)',
      formats: [{ w: 2400, h: 2400, note: 'master' }],
    },
    {
      id: 'web-hp',
      label: '1. Banner HP (web)',
      maxKB: 500,
      formats: [
        { w: 1350, h: 480, note: 'desktop' },
        { w: 599, h: 767, note: 'mobil' },
      ],
    },
    {
      id: 'kategorie',
      label: '2. Banner kategorie',
      maxKB: 300,
      transparent: true, // bez pozadí (průhledné PNG)
      formats: [{ w: 1144, h: 395 }],
    },
    {
      id: 'rozcestnik',
      label: '4. Banner rozcestník',
      maxKB: 250,
      transparent: true, // bez pozadí (průhledné PNG)
      formats: [{ w: 500, h: 500 }],
    },
    {
      id: 'newsletter',
      label: '5. Newsletter',
      maxKB: 400,
      formats: [
        { w: 1280, h: 1800, note: 'hlavní' },
        { w: 1280, h: 400, note: 'proužek' },
      ],
    },
    {
      // Návrh běžných affiliate/display rozměrů (upravitelné dle sítě).
      id: 'affiliate',
      label: '6. Affiliate (návrh)',
      maxKB: 150,
      formats: [
        { w: 300, h: 250 }, { w: 300, h: 600 }, { w: 728, h: 90 },
        { w: 970, h: 250 }, { w: 160, h: 600 }, { w: 320, h: 100 },
        { w: 250, h: 250 }, { w: 336, h: 280 },
      ],
    },
    {
      // Podporované rozměry bannerů Sklik (napoveda.sklik.cz).
      id: 'sklik',
      label: '7. PPC Sklik',
      maxKB: 150,
      formats: [
        { w: 300, h: 250 }, { w: 320, h: 100 }, { w: 480, h: 300 },
        { w: 728, h: 90 }, { w: 970, h: 210 }, { w: 970, h: 310 },
        { w: 500, h: 200 }, { w: 160, h: 600 }, { w: 300, h: 600 },
        { w: 300, h: 300 }, { w: 480, h: 480 },
      ],
    },
    {
      // Firmy.cz úvodní fotografie (na šířku, min 1200×800).
      id: 'firmy-reklama',
      label: '8. Firmy.cz – reklama',
      maxKB: 500,
      formats: [{ w: 1200, h: 800, note: 'úvodní foto' }],
    },
    {
      // Firmy.cz branding (hlavní sdělení v horních 1366×720).
      id: 'firmy-branding',
      label: '9. Firmy.cz – branding',
      maxKB: 500,
      formats: [
        {
          w: 2000, h: 1400, note: 'safe zóna 1366×720 nahoře',
          // Hlavní sdělení musí být v horním prostoru 1366×720 (vycentrováno).
          safeZone: { x: 317, y: 100, w: 1366, h: 720 },
        },
      ],
    },
    {
      // Google Business Profile (Google firmy).
      id: 'google-firmy',
      label: '10. Google firmy',
      maxKB: 150,
      formats: [
        { w: 1024, h: 575, note: 'cover' },
        { w: 720, h: 720, note: 'logo/foto' },
        { w: 1200, h: 900, note: 'příspěvek' },
      ],
    },
    {
      id: 'heureka',
      label: '11. Heureka display',
      maxKB: 150,
      formats: [
        { w: 120, h: 600 }, { w: 160, h: 600 }, { w: 200, h: 200 },
        { w: 250, h: 250 }, { w: 300, h: 50 }, { w: 300, h: 250 },
        { w: 300, h: 300 }, { w: 300, h: 600 }, { w: 320, h: 50 },
        { w: 320, h: 100 }, { w: 336, h: 280 }, { w: 480, h: 300 },
        { w: 480, h: 480 }, { w: 580, h: 400 }, { w: 930, h: 180 },
        { w: 970, h: 150 }, { w: 970, h: 210 }, { w: 970, h: 250 },
        { w: 970, h: 310 }, { w: 1200, h: 628 }, { w: 1200, h: 1200 },
      ],
    },
    {
      id: 'instagram',
      label: '12–13. Instagram',
      maxKB: 500,
      formats: [
        { w: 1080, h: 1080, note: 'feed' },
        { w: 1080, h: 1920, note: 'story' },
      ],
    },
    {
      id: 'prodejny',
      label: '15. Grafika pro prodejny',
      maxKB: 2000,
      formats: [
        { w: 1920, h: 1080 },
        { w: 4353, h: 4535 },
      ],
    },
  ];

  // Odvození plochého seznamu formátů. id je čisté (kanál-šířkaxvýška), bez
  // poznámky/diakritiky, aby fungovalo i v názvech souborů. Rozměr je v rámci
  // kanálu unikátní; případný duplicitní rozměr dostane pořadové číslo.
  const FORMATS = [];
  const seenIds = new Set();
  CHANNELS.forEach((ch) => {
    ch.formats.forEach((f) => {
      let id = `${ch.id}-${f.w}x${f.h}`;
      let n = 2;
      while (seenIds.has(id)) id = `${ch.id}-${f.w}x${f.h}-${n++}`;
      seenIds.add(id);
      FORMATS.push({
        id: id,
        channel: ch.id,
        channelLabel: ch.label,
        label: `${f.w}×${f.h}${f.note ? ' · ' + f.note : ''}`,
        width: f.w,
        height: f.h,
        safeZone: f.safeZone || null,
        maxKB: f.maxKB != null ? f.maxKB : (ch.maxKB != null ? ch.maxKB : null),
        transparent: f.transparent != null ? f.transparent : (ch.transparent != null ? ch.transparent : false),
      });
    });
  });

  // Jazykové mutace. Každý má výchozí texty (uživatel může přepsat).
  // Výchozí texty jsou prázdné — vlastní „výchozí" si uživatel nastaví přes
  // „Uložit jako výchozí" (stejně jako master obrázek). Žádné generické placeholdery.
  const _empty = { overline: '', headline: '', subline: '', cta: '' };
  const LANGUAGES = [
    { code: 'CZ', label: 'Čeština', defaults: Object.assign({}, _empty) },
    { code: 'SK', label: 'Slovenčina', defaults: Object.assign({}, _empty) },
    { code: 'HU', label: 'Magyar', defaults: Object.assign({}, _empty) },
    { code: 'RO', label: 'Română', defaults: Object.assign({}, _empty) },
    { code: 'SI', label: 'Slovenščina', defaults: Object.assign({}, _empty) },
    { code: 'HR', label: 'Hrvatski', defaults: Object.assign({}, _empty) },
    { code: 'BG', label: 'Български', defaults: Object.assign({}, _empty) },
  ];

  // Šablony určují rozvržení. Renderer se přizpůsobí poměru stran formátu.
  const TEMPLATES = [
    { id: 'overlay', label: 'Overlay (text přes vizuál)', description: 'Vizuál na celé ploše, texty přes tmavý přechod.' },
    { id: 'classic', label: 'Classic (vizuál + textový panel)', description: 'Vizuál na části plochy, texty na barevném panelu.' },
    { id: 'split', label: 'Split (vizuál vedle textu)', description: 'Vizuál a text vedle sebe (dle poměru stran).' },
    { id: 'minimal', label: 'Minimal (bez vizuálu)', description: 'Čistě barevné pozadí značky, jen texty a CTA.' },
  ];

  global.BannerConfig = { CHANNELS, FORMATS, LANGUAGES, TEMPLATES };
})(window);
