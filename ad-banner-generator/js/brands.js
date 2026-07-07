/*
 * Značky (firmy) dostupné v generátoru. Přepínač „Firma" v horní liště mění
 * aktivní značku — barvy, fonty, logo (dle jazyka) i paletu vzorků.
 *
 * Nová firma = přidat další objekt do pole. `id` musí být unikátní.
 * Barvy „Kondomshop.sk" jsou odvozené z jejich webu (kondomshop.sk).
 */
(function (global) {
  'use strict';

  var FONTS = {
    heading: { family: "Montserrat, 'Segoe UI', Arial, sans-serif", weight: 800, url: 'fonts/fonts.css' },
    body: { family: "Roboto, 'Segoe UI', Arial, sans-serif", weight: 400, url: 'fonts/fonts.css' },
  };

  var RUZOVY_SLON = {
    id: 'ruzovy-slon',
    name: 'Růžový Slon',
    source: 'Design manual Růžový Slon (V1.0)',
    colors: {
      primary: '#DC004E',
      secondary: '#1F0F36',
      accent: '#985FA3',
      background: '#FFFFFF',
      surface: '#FCEAEA',
      text: '#1F0F36',
      textMuted: '#6E647A',
      ctaBackground: '#DC004E',
      ctaText: '#FFFFFF',
    },
    fonts: FONTS,
    badgeShape: 'pusinka', // slevový odznak = pusinka (dle manuálu)
    logoText: 'Růžový Slon',
    logoByLang: { CZ: 'Růžový Slon', SK: 'Ružový slon', default: 'Sexy Elephant' },
    palette: {
      primaryPink: '#DC004E', darkViolet: '#1F0F36', lightPink: '#F8C7C8',
      lightestPink: '#FCEAEA', pink: '#F29BA8', white: '#FFFFFF', teal: '#11AAAA',
      yellow: '#F4B945', violet: '#985FA3', blue: '#114CAA', green: '#2FB773',
    },
  };

  // Odvozeno z kondomshop.sk: hlavní tlačítka #AE0289 (magenta), tmavá #1F0F36,
  // světlé růžové #F4D1ED / #E493D6, zelená #2FB773, světle modrá #DCF3FF.
  var KONDOMSHOP = {
    id: 'kondomshop',
    name: 'KondomShop',
    source: 'Odvozeno z webu kondomshop.sk',
    langs: ['CZ', 'SK'], // kondomshop používá jen češtinu a slovenštinu
    colors: {
      primary: '#AE0289',
      secondary: '#1F0F36',
      accent: '#E493D6',
      background: '#FFFFFF',
      surface: '#F4D1ED',
      text: '#1F0F36',
      textMuted: '#6E647A',
      ctaBackground: '#AE0289',
      ctaText: '#FFFFFF',
    },
    fonts: FONTS,
    badgeShape: 'circle', // slevový odznak = kolečko
    logoText: 'KondomShop',
    logoByLang: { CZ: 'KondomShop', SK: 'KondomShop', default: 'KondomShop' },
    palette: {
      magenta: '#AE0289', darkMagenta: '#62014D', pinkRed: '#AA003C',
      darkViolet: '#1F0F36', slate: '#34495E', blue: '#114CAA',
      lightPink: '#F4D1ED', pink: '#E493D6', lightBlue: '#DCF3FF',
      blushPink: '#FEDFE4', yellow: '#FFF3CC', green: '#2FB773', white: '#FFFFFF',
    },
  };

  global.BANNER_BRANDS = [RUZOVY_SLON, KONDOMSHOP];
})(window);
