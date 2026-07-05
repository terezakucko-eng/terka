/*
 * Konfigurace: formáty, jazykové mutace, šablony.
 * Formáty jsou snadno rozšiřitelné — přidej položku do FORMATS.
 */
(function (global) {
  'use strict';

  // Rozměry bannerů (rozšiřitelné). id se používá v názvech souborů.
  const FORMATS = [
    { id: '300x250', label: 'Medium Rectangle', width: 300, height: 250 },
    { id: '728x90', label: 'Leaderboard', width: 728, height: 90 },
    { id: '970x250', label: 'Billboard', width: 970, height: 250 },
    { id: '300x600', label: 'Half Page', width: 300, height: 600 },
    { id: '320x100', label: 'Large Mobile Banner', width: 320, height: 100 },
  ];

  // Jazykové mutace. Každý má výchozí texty (uživatel může přepsat).
  const LANGUAGES = [
    {
      code: 'CZ',
      label: 'Čeština',
      defaults: { headline: 'Nová kolekce', subline: 'Sleva až 50 %', cta: 'Nakupovat' },
    },
    {
      code: 'SK',
      label: 'Slovenčina',
      defaults: { headline: 'Nová kolekcia', subline: 'Zľava až 50 %', cta: 'Nakupovať' },
    },
    {
      code: 'HU',
      label: 'Magyar',
      defaults: { headline: 'Új kollekció', subline: 'Akár 50% kedvezmény', cta: 'Vásárlás' },
    },
    {
      code: 'RO',
      label: 'Română',
      defaults: { headline: 'Colecție nouă', subline: 'Reduceri până la 50%', cta: 'Cumpără' },
    },
    {
      code: 'SI',
      label: 'Slovenščina',
      defaults: { headline: 'Nova kolekcija', subline: 'Popust do 50 %', cta: 'Nakupuj' },
    },
    {
      code: 'HR',
      label: 'Hrvatski',
      defaults: { headline: 'Nova kolekcija', subline: 'Popust do 50 %', cta: 'Kupuj' },
    },
    {
      code: 'BG',
      label: 'Български',
      defaults: { headline: 'Нова колекция', subline: 'Отстъпка до 50%', cta: 'Пазарувай' },
    },
  ];

  // Šablony určují rozvržení. Renderer se přizpůsobí poměru stran formátu.
  const TEMPLATES = [
    {
      id: 'overlay',
      label: 'Overlay (text přes vizuál)',
      description: 'Vizuál na celé ploše, texty přes tmavý přechod.',
    },
    {
      id: 'classic',
      label: 'Classic (vizuál + textový panel)',
      description: 'Vizuál na části plochy, texty na barevném panelu.',
    },
    {
      id: 'split',
      label: 'Split (vizuál vedle textu)',
      description: 'Vizuál a text vedle sebe (dle poměru stran).',
    },
    {
      id: 'minimal',
      label: 'Minimal (bez vizuálu)',
      description: 'Čistě barevné pozadí značky, jen texty a CTA.',
    },
  ];

  global.BannerConfig = { FORMATS, LANGUAGES, TEMPLATES };
})(window);
