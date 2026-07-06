/*
 * Ad Banner Generator — hlavní logika.
 * Čisté HTML/JS/CSS, bez backendu. Vše běží v prohlížeči.
 */
(function () {
  'use strict';

  const { CHANNELS, FORMATS, LANGUAGES, TEMPLATES } = window.BannerConfig;
  const { renderBanner } = window.BannerRenderer;

  const STORAGE_PREFIX = 'abg:project:';
  const AUTOSAVE_KEY = 'abg:autosave';
  const DEFAULT_KEY = 'abg:default';

  // ---------- stav ----------
  const state = {
    brand: null,
    activeFormat: FORMATS[0].id,
    activeLang: 'CZ',
    template: 'overlay',
    image: null, // jediný nahraný vizuál (dataURL, plné rozlišení v paměti)
    imageStore: null, // zmenšená kopie pro uložení do localStorage
    imageAvg: null, // průměrná barva vizuálu (dotónování panelu)
    imageFocus: { x: 0.5, y: 0.45 }, // těžiště motivu (master framing pro všechny rozměry)
    texts: {}, // per jazyk: { CZ:{headline,subline,cta}, ... }

    // styl prvků (globální)
    ctaColor: '#2FB773', // zelená z palety manuálu
    ctaArrow: true, // malá šipka v CTA (jako „CHCI SLEVU ▸")
    ctaHidden: false, // úplně skrýt CTA tlačítko
    textColor: 'auto', // 'auto' | 'light' | 'dark'
    textScale: 1, // globální násobič velikosti textů (master)
    // per-prvek styl textu (jako v Canvě): velikost, řádkování, zarovnání
    textStyle: {
      headline: { size: 1, lineHeight: 1.15, align: 'left' },
      subline: { size: 1, lineHeight: 1.3, align: 'left' },
      cta: { size: 1, align: 'left' },
    },
    selectedEl: 'headline', // prvek editovaný horní lištou
    logoScale: 1, // velikost loga (násobič)
    logoColorMode: 'auto', // 'auto' | 'white' | 'black' | 'pink'
    logoDefaultHidden: false, // skrýt logo u všech (globální výchozí)
    showGuides: false, // vodicí středové lišty v náhledu
    showGrid: false, // jemná vodicí mřížka v náhledu
    discount: { show: false, text: '-20 %', size: 1 },
    badgeColor: null, // null = primární barva značky
    badgeTextColor: '#FFFFFF', // barva textu v pusince
    highlightColor: '#DC004E', // barva zvýrazněné části textu (*slovo*)
    highlightScale: 1.35, // násobič velikosti zvýrazněné části
    autoKB: true, // kB limit automaticky dle formátu (jinak ruční globální)

    // rozvržení per formát: { manual, image:{scale,offsetX,offsetY},
    //                         headline:{x,y}, subline:{x,y}, cta:{x,y}, badge:{x,y} }
    overrides: {},
  };

  // poslední spočítané rozvržení aktivního náhledu (pro chytání myší)
  let lastLayout = { boxes: {}, imageRect: null };

  const imageCache = new Map();

  // ---------- pomůcky ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const formatById = (id) => FORMATS.find((f) => f.id === id);
  const langByCode = (code) => LANGUAGES.find((l) => l.code === code);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function loadImage(dataURL) {
    if (!dataURL) return Promise.resolve(null);
    if (imageCache.has(dataURL)) return Promise.resolve(imageCache.get(dataURL));
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        imageCache.set(dataURL, img);
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = dataURL;
    });
  }

  function currentImageDataURL() {
    return state.image || null;
  }

  // Průměrná barva vizuálu (pro dotónování panelu).
  function computeAvgColor(img) {
    try {
      const c = document.createElement('canvas');
      c.width = 24;
      c.height = 24;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, 24, 24);
      const d = x.getImageData(0, 0, 24, 24).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n++;
      }
      return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    } catch (e) {
      return null;
    }
  }

  // Zmenšená JPEG kopie pro uložení do localStorage (base64 originál bývá moc velký).
  function downscaleToDataURL(img, maxDim, quality) {
    const s = Math.min(1, maxDim / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * s));
    c.height = Math.max(1, Math.round(img.height * s));
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality || 0.85);
  }

  function textsFor(lang) {
    if (!state.texts[lang]) {
      const d = langByCode(lang).defaults;
      state.texts[lang] = { headline: d.headline, subline: d.subline, cta: d.cta };
    }
    return state.texts[lang];
  }

  // ----- texty PER FORMÁT -----
  // Texty jsou standardně společné (per jazyk). Rozměr ale může mít vlastní
  // textaci (overrides[fmt].texts[lang]). effectiveTexts = co se vykreslí,
  // textScope/textTarget = kam se zapisuje při editaci aktivního rozměru.
  function hasFormatText(fmt) {
    const ov = state.overrides[fmt];
    return !!(ov && ov.texts);
  }
  function effectiveTexts(fmt, lang) {
    const ov = state.overrides[fmt];
    if (ov && ov.texts && ov.texts[lang]) return ov.texts[lang];
    return textsFor(lang);
  }
  function textScope() {
    const ov = state.overrides[state.activeFormat];
    return (ov && ov.texts) ? ov.texts : state.texts;
  }
  function textTarget(lang) {
    const scope = textScope();
    if (!scope[lang]) {
      const s = textsFor(lang);
      scope[lang] = { headline: s.headline, subline: s.subline, cta: s.cta };
    }
    return scope[lang];
  }

  // ----- šablona PER FORMÁT -----
  function effectiveTemplate(fmt) {
    const ov = state.overrides[fmt];
    return (ov && ov.template) ? ov.template : state.template;
  }

  // ----- zobrazení CTA PER FORMÁT ----- (lze skrýt u jednotlivých rozměrů)
  function effectiveCtaHidden(fmt) {
    const ov = state.overrides[fmt];
    return (ov && ov.ctaHidden != null) ? ov.ctaHidden : !!state.ctaHidden;
  }

  // ----- univerzální skrytí PRVKŮ per formát -----
  // Každý prvek (headline, subline, cta, logo, pusinka) jde na každém rozměru
  // samostatně zobrazit/skrýt, nezávisle na společném (master) zadání.
  function isElHidden(fmt, el) {
    const ov = state.overrides[fmt] || {};
    if (el === 'logo') return ov.logoHidden !== undefined ? ov.logoHidden : !!state.logoDefaultHidden;
    if (el === 'cta') return effectiveCtaHidden(fmt);
    if (el === 'badge') return ov.badgeHidden === true;
    return ov[el + 'Hidden'] === true; // headline, subline, image
  }
  function setElHidden(fmt, el, hidden) {
    const ov = ensureOverride(fmt);
    if (el === 'logo') ov.logoHidden = hidden;
    else if (el === 'cta') ov.ctaHidden = hidden;
    else if (el === 'badge') ov.badgeHidden = hidden;
    else ov[el + 'Hidden'] = hidden;
  }

  // ----- velikost loga a pusinky PER FORMÁT -----
  // Globální state.logoScale / state.discount.size jsou jen výchozí hodnoty.
  function effectiveLogoScale(fmt) {
    const ov = state.overrides[fmt];
    return (ov && ov.logoScale != null) ? ov.logoScale : state.logoScale;
  }
  function effectiveBadgeSize(fmt) {
    const ov = state.overrides[fmt];
    return (ov && ov.badgeSize != null) ? ov.badgeSize : (state.discount.size || 1);
  }

  // Logo se liší podle země: CZ = Růžový Slon, SK = Ružový slon,
  // ostatní (zahraničí) = Sexy Elephant. Řízeno brand.logoByLang.
  function logoFor(lang) {
    const map = (state.brand && state.brand.logoByLang) || {};
    return map[lang] || map.default || (state.brand && state.brand.logoText) || '';
  }

  function specFor(lang, fmtId) {
    const t = fmtId ? effectiveTexts(fmtId, lang) : textsFor(lang);
    const hdn = (el) => (fmtId ? isElHidden(fmtId, el) : false);
    return {
      headline: hdn('headline') ? '' : t.headline,
      subline: hdn('subline') ? '' : t.subline,
      cta: hdn('cta') ? '' : t.cta,
      template: fmtId ? effectiveTemplate(fmtId) : state.template,
      discount: {
        show: state.discount.show && !hdn('badge'),
        text: state.discount.text,
        size: fmtId ? effectiveBadgeSize(fmtId) : (state.discount.size || 1),
      },
      logoText: logoFor(lang),
      ctaArrow: state.ctaArrow,
    };
  }

  function ensureOverride(fmt) {
    if (!state.overrides[fmt]) {
      state.overrides[fmt] = { image: { scale: 1, offsetX: 0, offsetY: 0 } };
    }
    if (!state.overrides[fmt].image) {
      state.overrides[fmt].image = { scale: 1, offsetX: 0, offsetY: 0 };
    }
    return state.overrides[fmt];
  }

  // Styl textu (velikost/řádkování/zarovnání) je PER FORMÁT. Globální
  // state.textStyle slouží jen jako výchozí šablona pro formáty bez vlastního
  // nastavení. effectiveTextStyle vrátí platný styl pro daný rozměr.
  function effectiveTextStyle(fmt) {
    const base = state.textStyle;
    const ov = state.overrides[fmt];
    if (!ov || !ov.textStyle) return base;
    const out = {};
    ['headline', 'subline', 'cta'].forEach((el) => {
      out[el] = Object.assign({}, base[el], ov.textStyle[el] || {});
    });
    return out;
  }

  // Vrátí (a v případě potřeby založí) styl textu konkrétního rozměru pro zápis.
  // Nasadí se z aktuálně platných hodnot, aby se náhled při první úpravě neposunul.
  function activeTextStyle() {
    const fmt = state.activeFormat;
    const ov = ensureOverride(fmt);
    if (!ov.textStyle) {
      const eff = effectiveTextStyle(fmt);
      ov.textStyle = {
        headline: Object.assign({}, eff.headline),
        subline: Object.assign({}, eff.subline),
        cta: Object.assign({}, eff.cta),
      };
    }
    return ov.textStyle;
  }

  function optsFor(fmt) {
    return {
      override: state.overrides[fmt] || null,
      ctaColor: state.ctaColor,
      textColor: state.textColor,
      textScale: state.textScale,
      textStyle: effectiveTextStyle(fmt),
      logoDefaultHidden: state.logoDefaultHidden,
      logoScale: effectiveLogoScale(fmt),
      logoColorMode: state.logoColorMode,
      imageFocus: state.imageFocus,
      imageAvg: state.imageAvg,
      badgeColor: state.badgeColor || (state.brand && state.brand.colors.primary),
      badgeTextColor: state.badgeTextColor,
      highlightColor: state.highlightColor,
      highlightScale: state.highlightScale,
      transparent: !!(formatById(fmt) && formatById(fmt).transparent),
      extra: extraFor(fmt),
    };
  }

  // Další obrázek daného rozměru (pokud je nahraný a načtený v paměti).
  function extraFor(fmt) {
    const ov = state.overrides[fmt];
    if (ov && ov.extra && ov.extra.src) {
      const img = imageCache.get(ov.extra.src);
      if (img) return { img: img, x: ov.extra.x, y: ov.extra.y, scale: ov.extra.scale };
    }
    return null;
  }

  // ---------- načtení brandu ----------
  async function loadBrand() {
    try {
      if (window.__BRAND__) {
        state.brand = window.__BRAND__;
      } else {
        const res = await fetch('brand.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        state.brand = await res.json();
      }
    } catch (e) {
      console.warn('brand.json se nepodařilo načíst, používám výchozí.', e);
      state.brand = {
        name: 'Brand',
        colors: {
          primary: '#0B5FFF', secondary: '#0A2540', accent: '#FF7A00',
          background: '#FFFFFF', surface: '#F4F7FB', text: '#0A2540',
          textMuted: '#5A6B82', ctaBackground: '#FF7A00', ctaText: '#FFFFFF',
        },
        fonts: {
          heading: { family: "'Segoe UI', Arial, sans-serif", weight: 700 },
          body: { family: "'Segoe UI', Arial, sans-serif", weight: 400 },
        },
        logoText: 'BRAND',
      };
    }
    if (!state.badgeColor) state.badgeColor = state.brand.colors.primary;
    await loadBrandFonts();
    applyBrandToUI();
  }

  async function loadBrandFonts() {
    const fonts = state.brand.fonts || {};
    const urls = new Set();
    Object.values(fonts).forEach((f) => f && f.url && urls.add(f.url));

    const linkPromises = [];
    urls.forEach((url) => {
      if (document.querySelector(`link[href="${url}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      linkPromises.push(
        new Promise((resolve) => {
          link.onload = resolve;
          link.onerror = resolve;
        })
      );
      document.head.appendChild(link);
    });

    const probeText = 'AaĚěŘříé Ббгд 0123';
    const weights = [400, 500, 600, 700, 800];

    try {
      await Promise.race([
        Promise.all(linkPromises),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
      const probes = [];
      Object.values(fonts).forEach((f) => {
        if (!f || !f.family) return;
        const fam = f.family.split(',')[0].replace(/['"]/g, '').trim();
        weights.forEach((w) =>
          probes.push(document.fonts.load(`${w} 20px ${fam}`, probeText))
        );
      });
      await Promise.race([
        Promise.all(probes).then(() => document.fonts.ready),
        new Promise((r) => setTimeout(r, 3000)),
      ]);
    } catch (e) {
      /* ignore */
    }
  }

  function applyBrandToUI() {
    const c = state.brand.colors;
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', c.primary);
    root.style.setProperty('--brand-secondary', c.secondary);
    root.style.setProperty('--brand-accent', c.accent);
    root.style.setProperty('--brand-cta', state.ctaColor);
    $('#brandName').textContent = state.brand.name || 'Brand';
    const swatches = $('#brandSwatches');
    swatches.innerHTML = '';
    // Zobraz kompletní barevnou paletu z manuálu (vč. světlých růžových),
    // ne jen funkční barvy. Fallback na colors, pokud palette chybí.
    const palette = state.brand.palette
      ? Object.entries(state.brand.palette)
      : Object.entries(c);
    palette.forEach(([key, val]) => {
      const chip = document.createElement('div');
      chip.className = 'swatch';
      chip.title = key + ' — ' + val;
      chip.style.background = val;
      swatches.appendChild(chip);
    });
    $('#brandFonts').textContent =
      state.brand.fonts.heading.family.split(',')[0].replace(/['"]/g, '') +
      ' / ' +
      state.brand.fonts.body.family.split(',')[0].replace(/['"]/g, '');
  }

  // ---------- render offscreen ----------
  async function renderToCanvas(formatId, lang) {
    const format = formatById(formatId);
    const canvas = document.createElement('canvas');
    canvas.width = format.width;
    canvas.height = format.height;
    const ctx = canvas.getContext('2d');
    const img = await loadImage(state.image);
    const ov = state.overrides[formatId];
    if (ov && ov.extra && ov.extra.src) await loadImage(ov.extra.src);
    const mainImg = isElHidden(formatId, 'image') ? null : img;
    renderBanner(ctx, format, specFor(lang, formatId), state.brand, mainImg, optsFor(formatId));
    return canvas;
  }

  // ---------- UI: sestavení ovládacích prvků ----------
  function buildFormatSelect() {
    const sel = $('#formatSelect');
    sel.innerHTML = '';
    CHANNELS.forEach((ch) => {
      const og = document.createElement('optgroup');
      og.label = ch.label;
      FORMATS.filter((f) => f.channel === ch.id).forEach((f) => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.label;
        og.appendChild(opt);
      });
      sel.appendChild(og);
    });
    sel.value = state.activeFormat;
  }

  function buildTemplateSelect() {
    const sel = $('#templateSelect');
    sel.innerHTML = '';
    TEMPLATES.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.label;
      sel.appendChild(opt);
    });
    sel.value = state.template;
    $('#templateDesc').textContent = TEMPLATES.find((t) => t.id === state.template).description;
  }

  function buildLangTabs() {
    const wrap = $('#langTabs');
    wrap.innerHTML = '';
    LANGUAGES.forEach((l) => {
      const btn = document.createElement('button');
      btn.className = 'lang-tab' + (l.code === state.activeLang ? ' active' : '');
      btn.textContent = l.code;
      btn.title = l.label;
      btn.addEventListener('click', () => {
        state.activeLang = l.code;
        syncTextInputs();
        buildLangTabs();
        renderPreview();
      });
      wrap.appendChild(btn);
    });
  }

  function buildExportCheckboxes() {
    const fWrap = $('#exportFormats');
    fWrap.innerHTML = '';
    CHANNELS.forEach((ch) => {
      const grp = document.createElement('div');
      grp.className = 'exp-channel';
      const head = document.createElement('div');
      head.className = 'exp-channel-head';
      head.textContent = ch.label;
      grp.appendChild(head);
      const row = document.createElement('div');
      row.className = 'chk-grid';
      FORMATS.filter((f) => f.channel === ch.id).forEach((f) => {
        const label = document.createElement('label');
        label.className = 'chk';
        label.innerHTML = `<input type="checkbox" value="${f.id}" checked> ${f.width}×${f.height}`;
        row.appendChild(label);
      });
      grp.appendChild(row);
      fWrap.appendChild(grp);
    });
    const lWrap = $('#exportLangs');
    lWrap.innerHTML = '';
    LANGUAGES.forEach((l) => {
      const label = document.createElement('label');
      label.className = 'chk';
      label.innerHTML = `<input type="checkbox" value="${l.code}" checked> ${l.code}`;
      lWrap.appendChild(label);
    });
  }

  function syncTextInputs() {
    const t = textTarget(state.activeLang);
    $('#inHeadline').value = t.headline || '';
    $('#inSubline').value = t.subline || '';
    $('#inCta').value = t.cta || '';
    $('#activeLangLabel').textContent = langByCode(state.activeLang).label;
    const tfl = $('#translateFromLabel');
    if (tfl) tfl.textContent = state.activeLang;
    syncPerFormatUI();
    if (typeof refreshHighlightControls === 'function') refreshHighlightControls();
  }

  // Ovládací prvky, které jsou PER FORMÁT (šablona, přepínač vlastní textace).
  function syncPerFormatUI() {
    const tpl = effectiveTemplate(state.activeFormat);
    $('#templateSelect').value = tpl;
    const desc = TEMPLATES.find((t) => t.id === tpl);
    if (desc) $('#templateDesc').textContent = desc.description;
    const cb = $('#perFormatText');
    if (cb) cb.checked = hasFormatText(state.activeFormat);
  }

  function syncLayoutControls() {
    const ov = state.overrides[state.activeFormat];
    const img = (ov && ov.image) || { scale: 1, offsetX: 0, offsetY: 0 };
    $('#imgZoom').value = Math.round((img.scale || 1) * 100);
    $('#zoomVal').textContent = $('#imgZoom').value + '%';
    $('#imgX').value = Math.round((img.offsetX || 0) * 100);
    $('#imgY').value = Math.round((img.offsetY || 0) * 100);
    $('#imgFmtLabel').textContent = state.activeFormat;
    $('#layoutMode').textContent = ov && ov.manual ? 'ruční' : 'automatické';
    const logoHidden = ov && ov.logoHidden !== undefined ? ov.logoHidden : state.logoDefaultHidden;
    $('#showLogo').checked = !logoHidden;
    const ls = effectiveLogoScale(state.activeFormat);
    $('#logoScale').value = Math.round(ls * 100);
    $('#logoScaleVal').textContent = Math.round(ls * 100) + '%';
    $('#logoColorMode').value = state.logoColorMode;
    const bs = effectiveBadgeSize(state.activeFormat);
    $('#discountSize').value = Math.round(bs * 100);
    $('#discountSizeVal').textContent = Math.round(bs * 100) + '%';
    $('#ctaShow').checked = !effectiveCtaHidden(state.activeFormat);
    const extra = ov && ov.extra;
    $('#extraSizeWrap').classList.toggle('hidden', !extra);
    $('#btnRemoveExtra').classList.toggle('hidden', !extra);
    if (extra) {
      $('#extraSize').value = Math.round((extra.scale || 1) * 100);
      $('#extraSizeVal').textContent = Math.round((extra.scale || 1) * 100) + '%';
    }
  }

  function syncTextToolbar() {
    const el = state.selectedEl;
    $$('#ttElements button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-sel') === el));
    // univerzální „Zobrazit" pro vybraný prvek (per formát)
    $('#ttShow').checked = !isElHidden(state.activeFormat, el);
    $('#ttSizeWrap').classList.remove('hidden');
    if (el === 'image') {
      // master obrázek: v liště jen zobrazit/skrýt (zoom/posun je v sekci 2)
      $('#ttAlign').classList.add('hidden');
      $('#ttLhWrap').classList.add('hidden');
      $('#ttLogoColorWrap').classList.add('hidden');
      $('#ttBadgeColors').classList.add('hidden');
      $('#ttCtaControls').classList.add('hidden');
      $('#ttSizeWrap').classList.add('hidden');
      return;
    }
    if (el === 'logo' || el === 'badge') {
      // Logo i pusinka: skryj zarovnání/řádkování; velikost = jejich měřítko.
      $('#ttAlign').classList.add('hidden');
      $('#ttLhWrap').classList.add('hidden');
      $('#ttLogoColorWrap').classList.toggle('hidden', el !== 'logo');
      $('#ttBadgeColors').classList.toggle('hidden', el !== 'badge');
      $('#ttCtaControls').classList.add('hidden');
      const val = el === 'logo' ? effectiveLogoScale(state.activeFormat) : effectiveBadgeSize(state.activeFormat);
      $('#ttSize').value = Math.round(val * 100);
      $('#ttSizeVal').textContent = Math.round(val * 100) + '%';
      if (el === 'logo') $('#ttLogoColor').value = state.logoColorMode;
      if (el === 'badge') syncBadgeSwatches();
      return;
    }
    $('#ttAlign').classList.remove('hidden');
    $('#ttLogoColorWrap').classList.add('hidden');
    $('#ttBadgeColors').classList.add('hidden');
    // CTA má navíc: zobrazit/skrýt, barvu (dle manuálu) a šipku
    $('#ttCtaControls').classList.toggle('hidden', el !== 'cta');
    if (el === 'cta') syncCtaControls();
    const s = effectiveTextStyle(state.activeFormat)[el];
    $$('#ttAlign button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-align') === (s.align || 'left')));
    $('#ttSize').value = Math.round((s.size || 1) * 100);
    $('#ttSizeVal').textContent = Math.round((s.size || 1) * 100) + '%';
    const lh = s.lineHeight || (el === 'headline' ? 1.15 : 1.3);
    $('#ttLineHeight').value = Math.round(lh * 100);
    $('#ttLhVal').textContent = lh.toFixed(2);
    $('#ttLhWrap').classList.toggle('hidden', el === 'cta');
  }

  function selectElement(el) {
    state.selectedEl = el;
    syncTextToolbar();
  }

  function wireTextToolbar() {
    $$('#ttElements button').forEach((b) =>
      b.addEventListener('click', () => selectElement(b.getAttribute('data-sel')))
    );
    $$('#ttAlign button').forEach((b) =>
      b.addEventListener('click', () => {
        if (['logo', 'badge', 'image'].indexOf(state.selectedEl) !== -1) return;
        activeTextStyle()[state.selectedEl].align = b.getAttribute('data-align');
        syncTextToolbar();
        scheduleRender();
      })
    );
    $('#ttSize').addEventListener('input', (e) => {
      if (state.selectedEl === 'image') return;
      const v = (+e.target.value) / 100;
      if (state.selectedEl === 'logo') {
        ensureOverride(state.activeFormat).logoScale = v;
        $('#logoScale').value = e.target.value;
        $('#logoScaleVal').textContent = e.target.value + '%';
      } else if (state.selectedEl === 'badge') {
        ensureOverride(state.activeFormat).badgeSize = v;
        $('#discountSize').value = e.target.value;
        $('#discountSizeVal').textContent = e.target.value + '%';
      } else {
        activeTextStyle()[state.selectedEl].size = v;
      }
      $('#ttSizeVal').textContent = e.target.value + '%';
      scheduleRender();
    });
    $('#ttLogoColor').addEventListener('change', (e) => {
      state.logoColorMode = e.target.value;
      $('#logoColorMode').value = e.target.value;
      scheduleRender();
    });
    $('#ttShow').addEventListener('change', (e) => {
      const el = state.selectedEl;
      const show = e.target.checked;
      setElHidden(state.activeFormat, el, !show);
      // zrcadli do levého panelu (logo/CTA mají vlastní přepínače)
      if (el === 'logo') $('#showLogo').checked = show;
      if (el === 'cta') $('#ctaShow').checked = show;
      // zapnutí pusinky na rozměru zapne i společný slevový odznak, ať je vidět
      if (el === 'badge' && show && !state.discount.show) {
        state.discount.show = true;
        $('#discountShow').checked = true;
      }
      renderPreview();
    });
    $('#ttCtaArrow').addEventListener('change', (e) => {
      state.ctaArrow = e.target.checked;
      $('#ctaArrow').checked = e.target.checked;
      scheduleRender();
    });
    $('#ttLineHeight').addEventListener('input', (e) => {
      if (state.selectedEl === 'logo' || state.selectedEl === 'image' || state.selectedEl === 'badge') return;
      activeTextStyle()[state.selectedEl].lineHeight = (+e.target.value) / 100;
      $('#ttLhVal').textContent = ((+e.target.value) / 100).toFixed(2);
      scheduleRender();
    });
  }

  // Když je kB automaticky dle formátu, pole ukazuje limit aktivního rozměru
  // a je zamčené; jinak je editovatelné (ruční globální hodnota).
  function syncKBField() {
    const auto = state.autoKB;
    const inp = $('#exportMaxKB');
    $('#autoKB').checked = auto;
    inp.disabled = auto;
    if (auto) {
      const f = formatById(state.activeFormat);
      if (f && f.maxKB) inp.value = f.maxKB;
      $('#autoKbHint').textContent =
        `Aktivní rozměr „${state.activeFormat}" má limit ${f && f.maxKB ? f.maxKB + ' kB' : '(bez limitu)'}. Při hromadném exportu má každý rozměr ten svůj. Platí pro JPG.`;
    } else {
      $('#autoKbHint').textContent = 'Ruční limit — stejná hodnota pro všechny rozměry. Platí pro JPG.';
    }
  }

  function syncStyleControls() {
    $('#ctaColor').value = state.ctaColor;
    $('#textColor').value = state.textColor;
    $('#textScale').value = Math.round(state.textScale * 100);
    $('#textScaleVal').textContent = Math.round(state.textScale * 100) + '%';
    $('#ctaArrow').checked = state.ctaArrow;
    $('#ctaShow').checked = !effectiveCtaHidden(state.activeFormat);
    $('#hideLogoAll').checked = state.logoDefaultHidden;
    $('#showGuides').checked = state.showGuides;
    $('#showGrid').checked = state.showGrid;
    $('#discountShow').checked = state.discount.show;
    $('#discountText').value = state.discount.text;
    $('#discountColor').value = state.badgeColor || (state.brand && state.brand.colors.primary) || '#DC004E';
    $('#discountTextColor').value = state.badgeTextColor || '#FFFFFF';
    const bs = effectiveBadgeSize(state.activeFormat);
    $('#discountSize').value = Math.round(bs * 100);
    $('#discountSizeVal').textContent = Math.round(bs * 100) + '%';
    $('#highlightColor').value = state.highlightColor || '#DC004E';
    $('#highlightScale').value = Math.round((state.highlightScale || 1.35) * 100);
    $('#highlightScaleVal').textContent = Math.round((state.highlightScale || 1.35) * 100) + '%';
    $('#focusX').value = Math.round(state.imageFocus.x * 100);
    $('#focusXVal').textContent = Math.round(state.imageFocus.x * 100) + '%';
    $('#focusY').value = Math.round(state.imageFocus.y * 100);
    $('#focusYVal').textContent = Math.round(state.imageFocus.y * 100) + '%';
  }

  // ---------- náhled ----------
  let renderScheduled = false;
  function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      renderPreview();
    });
  }

  // Vykreslí do canvasu s kapnutým rozlišením (kvůli velmi velkým formátům),
  // ale layout počítá v reálných rozměrech → náhled odpovídá exportu.
  function renderIntoCanvas(canvas, format, lang, img, maxDim, overlay) {
    const k = Math.min(1, maxDim / Math.max(format.width, format.height));
    canvas.width = Math.round(format.width * k);
    canvas.height = Math.round(format.height * k);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(k, 0, 0, k, 0, 0);
    // U formátů „bez pozadí" ukaž v NÁHLEDU šachovnici (průhlednost) — do exportu nejde.
    if (format.transparent) drawCheckerboard(ctx, format);
    const mainImg = isElHidden(format.id, 'image') ? null : img;
    const layout = renderBanner(ctx, format, specFor(lang, format.id), state.brand, mainImg, optsFor(format.id));
    // vodítka — jen v náhledu, NIKDY se neexportují
    if (overlay) {
      if (overlay.grid) drawGrid(ctx, format);
      if (overlay.safeZone && format.safeZone) drawSafeZone(ctx, format.safeZone);
      if (overlay.centerGuides || overlay.snapX || overlay.snapY) {
        drawCenterGuides(ctx, format, overlay, layout.region);
      }
    }
    return layout;
  }

  // Šachovnice = průhlednost (jen náhled u formátů „bez pozadí").
  function drawCheckerboard(ctx, format) {
    const W = format.width, H = format.height;
    const cell = Math.max(8, Math.round(Math.min(W, H) / 20));
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e6e9ef';
    for (let y = 0; y < H; y += cell) {
      for (let x = 0; x < W; x += cell) {
        if (((x / cell) + (y / cell)) % 2 === 0) ctx.fillRect(x, y, cell, cell);
      }
    }
    ctx.restore();
  }

  // Jemná vodicí mřížka (jen náhled). Čtvercové buňky ~1/8 kratší strany.
  function drawGrid(ctx, format) {
    const W = format.width, H = format.height;
    const cell = Math.max(16, Math.min(W, H) / 8);
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(127,127,127,0.28)';
    ctx.lineWidth = 1;
    for (let x = cell; x < W - 0.5; x += cell) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = cell; y < H - 0.5; y += cell) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  // Vodicí lišty se řídí TEXTOVOU OBLASTÍ (u panelu = uvnitř panelu).
  function drawCenterGuides(ctx, format, o, region) {
    const r = region || { x: 0, y: 0, w: format.width, h: format.height };
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    ctx.save();
    ctx.strokeStyle = o.snapX ? 'rgba(17,170,170,1)' : 'rgba(17,170,170,0.45)';
    ctx.lineWidth = o.snapX ? 3 : 1.5;
    ctx.setLineDash(o.snapX ? [] : [9, 8]);
    ctx.beginPath(); ctx.moveTo(cx, r.y); ctx.lineTo(cx, r.y + r.h); ctx.stroke();
    ctx.strokeStyle = o.snapY ? 'rgba(17,170,170,1)' : 'rgba(17,170,170,0.45)';
    ctx.lineWidth = o.snapY ? 3 : 1.5;
    ctx.setLineDash(o.snapY ? [] : [9, 8]);
    ctx.beginPath(); ctx.moveTo(r.x, cy); ctx.lineTo(r.x + r.w, cy); ctx.stroke();
    ctx.restore();
  }

  function drawSafeZone(ctx, s) {
    ctx.save();
    // tmavý podklad linky (kontrast na světlém pozadí)
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 5;
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    // světlá čárkovaná linka navrch (kontrast na tmavém pozadí)
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([14, 9]);
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    ctx.setLineDash([]);
    // štítek
    const label = 'SAFE ZÓNA – hlavní sdělení (1366×720)';
    ctx.font = '700 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(s.x, s.y, tw + 20, 34);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(label, s.x + 10, s.y + 7);
    ctx.restore();
  }

  // Načte do cache všechny „další obrázky" (per formát), ať je galerie i export vykreslí.
  async function preloadExtras() {
    const srcs = new Set();
    Object.values(state.overrides).forEach((o) => { if (o && o.extra && o.extra.src) srcs.add(o.extra.src); });
    await Promise.all(Array.from(srcs).map((s) => loadImage(s)));
  }

  async function renderPreview() {
    const format = formatById(state.activeFormat);
    const mainCanvas = $('#mainPreview');
    const img = await loadImage(currentImageDataURL());
    await preloadExtras();
    if (img && !state.imageAvg) state.imageAvg = computeAvgColor(img);
    if (!img) state.imageAvg = null;
    const overlay = {
      grid: state.showGrid,
      safeZone: true,
      centerGuides: state.showGuides || !!drag,
      snapX: !!(drag && drag.snapX),
      snapY: !!(drag && drag.snapY),
    };
    lastLayout = renderIntoCanvas(mainCanvas, format, state.activeLang, img, 1600, overlay);
    $('#previewMeta').textContent =
      `${format.id} · ${format.label} · ${state.activeLang}`;
    syncLayoutControls();
    syncTextToolbar();
    syncKBField();
    renderGallery(img);
    saveAutosave();
  }

  function renderGallery(img) {
    const gallery = $('#gallery');
    gallery.innerHTML = '';
    const active = formatById(state.activeFormat);
    const title = $('#galleryTitle');
    if (title) title.textContent = `${active.channelLabel} — všechny rozměry (${state.activeLang})`;
    const list = FORMATS.filter((f) => f.channel === active.channel);
    for (const f of list) {
      const cell = document.createElement('div');
      cell.className = 'gallery-cell' + (f.id === state.activeFormat ? ' active' : '');
      const canvas = document.createElement('canvas');
      renderIntoCanvas(canvas, f, state.activeLang, img, 360);
      const maxW = 150, maxH = 120;
      const s = Math.min(maxW / f.width, maxH / f.height, 1);
      canvas.style.width = Math.round(f.width * s) + 'px';
      canvas.style.height = Math.round(f.height * s) + 'px';
      const cap = document.createElement('div');
      cap.className = 'gallery-cap';
      cap.textContent = f.id;
      cell.appendChild(canvas);
      cell.appendChild(cap);
      cell.addEventListener('click', () => {
        state.activeFormat = f.id;
        $('#formatSelect').value = f.id;
        syncTextInputs();
        renderPreview();
      });
      gallery.appendChild(cell);
    }
  }

  // ---------- interaktivní editor (tažení prvků) ----------
  let drag = null;

  function canvasCoords(e) {
    const c = $('#mainPreview');
    const rect = c.getBoundingClientRect();
    // mapuj na REÁLNÉ rozměry formátu (náhled může mít kapnuté rozlišení)
    const format = formatById(state.activeFormat);
    return {
      x: ((e.clientX - rect.left) / rect.width) * format.width,
      y: ((e.clientY - rect.top) / rect.height) * format.height,
    };
  }

  function inside(p, box, pad) {
    pad = pad || 0;
    return (
      p.x >= box.x - pad && p.x <= box.x + box.w + pad &&
      p.y >= box.y - pad && p.y <= box.y + box.h + pad
    );
  }

  function hitTest(p) {
    const order = ['extra', 'badge', 'logo', 'cta', 'subline', 'headline'];
    for (const k of order) {
      const b = lastLayout.boxes[k];
      if (b && inside(p, b, 6)) return k;
    }
    if (lastLayout.imageRect && inside(p, lastLayout.imageRect, 0) && currentImageDataURL()) {
      return 'image';
    }
    return null;
  }

  function seedManual(ov, format) {
    ['headline', 'subline', 'cta'].forEach((el) => {
      const b = lastLayout.boxes[el];
      if (b) ov[el] = { x: b.x / format.width, y: b.y / format.height };
    });
    ov.manual = true;
  }

  function onPointerDown(e) {
    const p = canvasCoords(e);
    const hit = hitTest(p);
    if (!hit) return;
    const fmt = state.activeFormat;
    const format = formatById(fmt);
    const ov = ensureOverride(fmt);

    if (hit === 'image') {
      drag = {
        kind: 'image',
        downX: p.x, downY: p.y,
        orig: { ...ov.image },
        rect: lastLayout.imageRect,
      };
    } else {
      if (hit === 'headline' || hit === 'subline' || hit === 'cta') {
        if (!ov.manual) seedManual(ov, format);
        // starší uložení bez pozice prvku → naseeduj z aktuálního rozvržení
        else if (!ov[hit] && lastLayout.boxes[hit]) {
          const b = lastLayout.boxes[hit];
          ov[hit] = { x: b.x / format.width, y: b.y / format.height };
        }
      }
      if (hit === 'badge' && !ov.badge) {
        const b = lastLayout.boxes.badge;
        ov.badge = { x: (b.x + b.w / 2) / format.width, y: (b.y + b.h / 2) / format.height };
      }
      if (hit === 'logo' && !ov.logo) {
        const b = lastLayout.boxes.logo;
        ov.logo = { x: b.x / format.width, y: b.y / format.height };
      }
      if (['headline', 'subline', 'cta', 'logo', 'badge'].indexOf(hit) !== -1) selectElement(hit);
      let cur = ov[hit] || { x: 0, y: 0 };
      if (hit === 'extra') cur = { x: ov.extra.x == null ? 0.5 : ov.extra.x, y: ov.extra.y == null ? 0.5 : ov.extra.y };
      drag = { kind: 'el', el: hit, downX: p.x, downY: p.y, origX: cur.x, origY: cur.y, W: format.width, H: format.height };
    }
    $('#mainPreview').classList.add('dragging');
    e.preventDefault();
    // zachyť ukazatel, ať tažení funguje i mimo plátno; ulož pro pozdější uvolnění
    try {
      e.target.setPointerCapture(e.pointerId);
      drag.captureTarget = e.target;
      drag.pointerId = e.pointerId;
    } catch (_) {}
  }

  function onPointerMove(e) {
    if (!drag) return;
    const p = canvasCoords(e);
    const ov = state.overrides[state.activeFormat];
    const thr = 0.018; // práh přichycení na střed (~1,8 %)
    let snapX = false, snapY = false;
    if (drag.kind === 'el') {
      let nx = drag.origX + (p.x - drag.downX) / drag.W;
      let ny = drag.origY + (p.y - drag.downY) / drag.H;
      // střed = střed TEXTOVÉ OBLASTI (u panelu uvnitř panelu)
      const rg = lastLayout.region || { x: 0, y: 0, w: drag.W, h: drag.H };
      const rcx = (rg.x + rg.w / 2) / drag.W;
      const rcy = (rg.y + rg.h / 2) / drag.H;
      const b = lastLayout.boxes[drag.el];
      const centerBased = (drag.el === 'badge' || drag.el === 'extra');
      if (centerBased) {
        if (Math.abs(nx - rcx) < thr) { nx = rcx; snapX = true; }
        if (Math.abs(ny - rcy) < thr) { ny = rcy; snapY = true; }
      } else if (b) {
        const bw = b.w / drag.W, bh = b.h / drag.H;
        if (Math.abs(nx + bw / 2 - rcx) < thr) { nx = rcx - bw / 2; snapX = true; }
        if (Math.abs(ny + bh / 2 - rcy) < thr) { ny = rcy - bh / 2; snapY = true; }
      }
      if (drag.el === 'extra' && ov.extra) {
        // nepřepisuj celý objekt (má src/scale) — jen posuň střed
        ov.extra.x = clamp(nx, 0, 1);
        ov.extra.y = clamp(ny, 0, 1);
      } else {
        ov[drag.el] = { x: clamp(nx, 0, 0.99), y: clamp(ny, 0, 0.99) };
      }
    } else {
      ov.image = ov.image || { scale: 1, offsetX: 0, offsetY: 0 };
      let ox = drag.orig.offsetX + (p.x - drag.downX) / (drag.rect.w / 2);
      let oy = drag.orig.offsetY + (p.y - drag.downY) / (drag.rect.h / 2);
      if (Math.abs(ox) < 0.05) { ox = 0; snapX = true; }
      if (Math.abs(oy) < 0.05) { oy = 0; snapY = true; }
      ov.image.offsetX = clamp(ox, -1, 1);
      ov.image.offsetY = clamp(oy, -1, 1);
    }
    drag.snapX = snapX;
    drag.snapY = snapY;
    scheduleRender();
  }

  function onPointerUp() {
    if (!drag) return;
    // uvolni zachycení ukazatele, jinak by plátno „polykalo" další kliknutí
    // (např. výběr rozměru v galerii pod náhledem)
    try {
      if (drag.captureTarget && drag.pointerId != null) {
        drag.captureTarget.releasePointerCapture(drag.pointerId);
      }
    } catch (_) {}
    drag = null;
    $('#mainPreview').classList.remove('dragging');
    // znovu vykresli bez tažení → vodicí lišta se po manipulaci sama skryje
    renderPreview();
    saveAutosave();
  }

  function onHoverMove(e) {
    if (drag) return;
    const p = canvasCoords(e);
    $('#mainPreview').style.cursor = hitTest(p) ? 'grab' : 'default';
  }

  // ---------- export PNG ----------
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  // Vrátí kB limit pro daný formát: automaticky dle kanálu (formatById.maxKB),
  // jinak ruční globální hodnotu z pole. Fallback na 250 kB.
  function limitKBFor(fmtId) {
    const manual = parseInt($('#exportMaxKB').value, 10) || 250;
    if (!state.autoKB) return manual;
    const f = formatById(fmtId);
    return (f && f.maxKB) ? f.maxKB : manual;
  }

  // Zakóduje canvas dle zvoleného formátu. U JPG hledá kvalitu tak, aby se
  // vešel pod limit velikosti daného formátu (auto-komprese pro Sklik/Heureka/PPC).
  async function encodeCanvas(canvas, fmtId) {
    const f = formatById(fmtId);
    // Formáty „bez pozadí" musí být průhledné → vždy PNG (JPG nemá průhlednost).
    const fmt = (f && f.transparent) ? 'png' : $('#exportFileFormat').value;
    if (fmt === 'jpg') {
      const maxBytes = limitKBFor(fmtId) * 1024;
      let q = 0.92;
      let blob = await toBlob(canvas, 'image/jpeg', q);
      while (blob && blob.size > maxBytes && q > 0.35) {
        q -= 0.08;
        blob = await toBlob(canvas, 'image/jpeg', q);
      }
      return { blob: blob, ext: 'jpg', over: blob && blob.size > maxBytes };
    }
    return { blob: await toBlob(canvas, 'image/png'), ext: 'png', over: false };
  }

  async function exportCurrentPNG() {
    const canvas = await renderToCanvas(state.activeFormat, state.activeLang);
    const { blob, ext, over } = await encodeCanvas(canvas, state.activeFormat);
    downloadBlob(blob, `${state.activeFormat}_${state.activeLang}.${ext}`);
    if (over) setStatus('Pozor: ani při nejnižší kvalitě se JPG nevešel pod limit.', true);
  }

  async function exportBatchZip() {
    const formats = $$('#exportFormats input:checked').map((i) => i.value);
    const langs = $$('#exportLangs input:checked').map((i) => i.value);

    if (!formats.length || !langs.length) {
      setStatus('Vyber alespoň jeden formát a jeden jazyk.', true);
      return;
    }

    const total = formats.length * langs.length;
    const btn = $('#btnExportZip');
    btn.disabled = true;
    let done = 0;

    const zip = new window.ZipWriter();
    let oversized = 0;
    for (const fmt of formats) {
      for (const lang of langs) {
        const canvas = await renderToCanvas(fmt, lang);
        const { blob, ext, over } = await encodeCanvas(canvas, fmt);
        if (over) oversized++;
        const buf = new Uint8Array(await blob.arrayBuffer());
        zip.addFile(`${fmt}/${fmt}_${lang}.${ext}`, buf);
        done++;
        setStatus(`Generuji… ${done}/${total}`);
      }
    }
    const zipBlob = zip.toBlob();
    const brandSlug = (state.brand.name || 'brand').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadBlob(zipBlob, `banners_${brandSlug}.zip`);
    setStatus(
      `Hotovo — ${total} bannerů zabaleno do ZIP.` +
        (oversized ? ` (${oversized} × se nevešlo pod limit velikosti)` : ''),
      !!oversized
    );
    btn.disabled = false;
  }

  function setStatus(msg, isError) {
    const el = $('#status');
    el.textContent = msg;
    el.classList.toggle('error', !!isError);
  }

  // ---------- localStorage: rozpracované projekty ----------
  function serializeState() {
    return {
      v: 2,
      activeFormat: state.activeFormat,
      activeLang: state.activeLang,
      template: state.template,
      image: state.imageStore || state.image,
      texts: state.texts,
      ctaColor: state.ctaColor,
      ctaArrow: state.ctaArrow,
      ctaHidden: state.ctaHidden,
      textColor: state.textColor,
      textScale: state.textScale,
      textStyle: state.textStyle,
      imageFocus: state.imageFocus,
      logoDefaultHidden: state.logoDefaultHidden,
      logoScale: state.logoScale,
      logoColorMode: state.logoColorMode,
      showGuides: state.showGuides,
      showGrid: state.showGrid,
      discount: state.discount,
      badgeColor: state.badgeColor,
      badgeTextColor: state.badgeTextColor,
      highlightColor: state.highlightColor,
      highlightScale: state.highlightScale,
      autoKB: state.autoKB,
      overrides: state.overrides,
      savedAt: new Date().toISOString(),
    };
  }

  function applySerialized(data) {
    if (!data) return;
    state.activeFormat = data.activeFormat || state.activeFormat;
    state.activeLang = data.activeLang || state.activeLang;
    state.template = data.template || state.template;
    state.image = data.image || (data.images && data.images.full) || null;
    state.imageStore = state.image;
    state.imageAvg = null; // přepočítá se při renderu
    state.texts = data.texts || {};
    if (data.ctaColor) state.ctaColor = data.ctaColor;
    if (typeof data.ctaArrow === 'boolean') state.ctaArrow = data.ctaArrow;
    if (typeof data.ctaHidden === 'boolean') state.ctaHidden = data.ctaHidden;
    if (data.textColor) state.textColor = data.textColor;
    if (data.textScale) state.textScale = data.textScale;
    if (data.textStyle) {
      ['headline', 'subline', 'cta'].forEach((el) => {
        if (data.textStyle[el]) Object.assign(state.textStyle[el], data.textStyle[el]);
      });
    }
    if (data.imageFocus) state.imageFocus = data.imageFocus;
    if (data.logoScale) state.logoScale = data.logoScale;
    if (data.logoColorMode) state.logoColorMode = data.logoColorMode;
    if (typeof data.logoDefaultHidden === 'boolean') state.logoDefaultHidden = data.logoDefaultHidden;
    if (typeof data.showGuides === 'boolean') state.showGuides = data.showGuides;
    if (typeof data.showGrid === 'boolean') state.showGrid = data.showGrid;
    if (data.discount) state.discount = data.discount;
    if (data.badgeColor) state.badgeColor = data.badgeColor;
    if (data.badgeTextColor) state.badgeTextColor = data.badgeTextColor;
    if (data.highlightColor) state.highlightColor = data.highlightColor;
    if (data.highlightScale) state.highlightScale = data.highlightScale;
    if (typeof data.autoKB === 'boolean') state.autoKB = data.autoKB;
    state.overrides = data.overrides || {};

    // pojistka proti neplatnému uloženému formátu/jazyku (např. starší verze)
    if (!formatById(state.activeFormat)) state.activeFormat = FORMATS[0].id;
    if (!langByCode(state.activeLang)) state.activeLang = LANGUAGES[0].code;

    $('#formatSelect').value = state.activeFormat;
    $('#templateSelect').value = state.template;
    $('#templateDesc').textContent = TEMPLATES.find((t) => t.id === state.template).description;
    updateImageThumbs();
    buildLangTabs();
    syncTextInputs();
    syncStyleControls();
    syncTextToolbar();
    document.documentElement.style.setProperty('--brand-cta', state.ctaColor);
    renderPreview();
  }

  // Uloží do localStorage; při přeplnění zkusí uložit bez obrázku (jen rozvržení).
  // Vrací 'ok' | 'noimage' | 'fail'.
  function saveToStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return 'ok';
    } catch (e) {
      try {
        localStorage.setItem(key, JSON.stringify(Object.assign({}, data, { image: null })));
        return 'noimage';
      } catch (e2) {
        return 'fail';
      }
    }
  }

  function saveAutosave() {
    saveToStorage(AUTOSAVE_KEY, serializeState());
  }

  // Vytvoří samostatný HTML se ZAPEČENÝM aktuálním nastavením (window.__PRESET__),
  // aby ho příjemce po otevření viděl přesně tak, jak je teď.
  let pristineHTML = null;
  function exportWithPreset() {
    const scrOpen = '<scr' + 'ipt';
    const scrClose = '</scr' + 'ipt>';
    if (!pristineHTML || pristineHTML.indexOf(scrOpen) === -1) {
      setStatus('Zapečení funguje jen ze staženého (samostatného) HTML, ne z dev serveru.', true);
      return;
    }
    const preset = serializeState();
    // escapuj znaky, které by rozbily vložený skript
    const json = JSON.stringify(preset)
      .replace(/</g, '\\u003c')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    // označený skript (id) + skládané „scr+ipt", ať se v tomto zdroji nevyskytne
    // doslovná značka, kterou by prohlížeč/regex omylem chytil
    const tag = scrOpen + ' id="__abg_preset__">window.__PRESET__=' + json + ';' + scrClose;
    const re = new RegExp(scrOpen + ' id="__abg_preset__">[\\s\\S]*?' + scrClose + '\\s*', 'g');
    let html = pristineHTML.replace(re, '');
    // vlož před POSLEDNÍ uzavírací tag body (dřívější výskyty jsou jen řetězce v JS)
    const closeTag = '</bo' + 'dy>';
    const idx = html.lastIndexOf(closeTag);
    if (idx !== -1) html = html.slice(0, idx) + tag + '\n' + html.slice(idx);
    else html += '\n' + tag;
    const blob = new Blob([html], { type: 'text/html' });
    const brandSlug = (state.brand.name || 'brand').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadBlob(blob, 'ad-banner-generator-' + brandSlug + '.html');
    setStatus('Appka s tvým nastavením stažena — tenhle soubor můžeš poslat dál.');
  }

  function saveNamedProject() {
    const name = ($('#projectName').value || '').trim();
    if (!name) {
      setStatus('Zadej název projektu pro uložení.', true);
      return;
    }
    const res = saveToStorage(STORAGE_PREFIX + name, serializeState());
    if (res === 'ok') {
      setStatus(`Projekt „${name}" uložen.`);
      refreshProjectList();
    } else if (res === 'noimage') {
      setStatus(`Projekt „${name}" uložen, ale obrázek byl moc velký — ulož ho zvlášť (rozvržení uloženo).`, true);
      refreshProjectList();
    } else {
      setStatus('Uložení selhalo — paměť prohlížeče je plná.', true);
    }
  }

  function refreshProjectList() {
    const sel = $('#projectList');
    const prev = sel.value;
    sel.innerHTML = '<option value="">— vyber uložený projekt —</option>';
    const names = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) names.push(key.slice(STORAGE_PREFIX.length));
    }
    names.sort();
    names.forEach((n) => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n;
      sel.appendChild(opt);
    });
    if (names.includes(prev)) sel.value = prev;
  }

  function loadNamedProject() {
    const name = $('#projectList').value;
    if (!name) {
      setStatus('Vyber projekt ze seznamu.', true);
      return;
    }
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_PREFIX + name));
      applySerialized(data);
      $('#projectName').value = name;
      setStatus(`Projekt „${name}" načten.`);
    } catch (e) {
      setStatus('Načtení selhalo.', true);
    }
  }

  function deleteNamedProject() {
    const name = $('#projectList').value;
    if (!name) {
      setStatus('Vyber projekt ke smazání.', true);
      return;
    }
    localStorage.removeItem(STORAGE_PREFIX + name);
    setStatus(`Projekt „${name}" smazán.`);
    refreshProjectList();
  }

  // ---------- upload vizuálu ----------
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleUpload(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus('Nahraj prosím obrázek.', true);
      return;
    }
    const dataURL = await readFileAsDataURL(file);
    state.image = dataURL;
    state.imageAvg = null; // přepočítá se při renderu
    const img = await loadImage(dataURL);
    // zmenšená kopie pro localStorage (originál v paměti zůstává pro export)
    state.imageStore = img ? downscaleToDataURL(img, 2000, 0.85) : dataURL;
    if (img) state.imageAvg = computeAvgColor(img);
    updateImageThumbs();
    renderPreview();
  }

  function updateImageThumbs() {
    const thumb = $('#thumb-full');
    if (state.image) {
      thumb.style.backgroundImage = `url("${state.image}")`;
      thumb.classList.add('has-image');
    } else {
      thumb.style.backgroundImage = '';
      thumb.classList.remove('has-image');
    }
  }

  // ---------- zvýraznění slova (*[scale,color]slovo*) ----------
  // Každé zvýrazněné slovo si nese vlastní velikost a barvu → jsou nezávislá.
  let lastTextField = '#inHeadline';
  let focusedRun = null; // { field, open, close } — právě upravovaný úsek

  function fmtAttr(scale, color) {
    const parts = [];
    if (scale != null) parts.push(Math.round(scale * 100) / 100);
    if (color) parts.push(color);
    return parts.length ? '[' + parts.join(',') + ']' : '';
  }
  // Najdi zvýrazněný úsek (mezi hvězdičkami) obsahující pozici kurzoru.
  function highlightRunAt(val, pos) {
    const stars = [];
    for (let i = 0; i < val.length; i++) if (val[i] === '*') stars.push(i);
    for (let k = 0; k + 1 < stars.length; k += 2) {
      const open = stars[k], close = stars[k + 1];
      if (pos >= open && pos <= close + 1) return { open: open, close: close };
    }
    return null;
  }
  function readRunAttrs(val, run) {
    const inner = val.slice(run.open + 1, run.close);
    const m = inner.match(/^\[([^\]]*)\]/);
    let scale = null, color = null;
    if (m) m[1].split(',').forEach((p) => {
      p = p.trim(); if (!p) return;
      if (p[0] === '#') color = p; else if (!isNaN(parseFloat(p))) scale = parseFloat(p);
    });
    return { scale: scale, color: color, textStart: run.open + 1 + (m ? m[0].length : 0) };
  }
  // Přepiš parametry úseku; vrať {value, close} (close se posune dle délky attr).
  function writeRunAttrs(val, run, scale, color) {
    const cur = readRunAttrs(val, run);
    const text = val.slice(cur.textStart, run.close);
    const newInner = fmtAttr(scale, color) + text;
    const value = val.slice(0, run.open + 1) + newInner + val.slice(run.close);
    return { value: value, close: run.open + 1 + newInner.length };
  }
  function highlightKey() {
    return lastTextField === '#inSubline' ? 'subline' : 'headline';
  }
  // Sesouhlas posuvníky zvýraznění s úsekem pod kurzorem (nebo s výchozími).
  function refreshHighlightControls() {
    const ta = $(lastTextField);
    if (!ta) return;
    const run = highlightRunAt(ta.value || '', ta.selectionStart);
    let sc = state.highlightScale, col = state.highlightColor, active = false;
    if (run) {
      focusedRun = { field: lastTextField, open: run.open, close: run.close };
      const a = readRunAttrs(ta.value, run);
      if (a.scale != null) sc = a.scale;
      if (a.color) col = a.color;
      active = true;
    } else {
      focusedRun = null;
    }
    $('#highlightScale').value = Math.round(sc * 100);
    $('#highlightScaleVal').textContent = Math.round(sc * 100) + '%';
    if (/^#[0-9a-fA-F]{6}$/.test(col)) $('#highlightColor').value = col;
    $('#btnWrapHighlight').textContent = active ? '✨ Zrušit zvýraznění tohoto slova' : '✨ Zvýraznit označené slovo';
  }

  // ---------- automatický překlad ----------
  // Mapa našich kódů na ISO kódy překladače.
  const ISO_LANG = { CZ: 'cs', SK: 'sk', HU: 'hu', RO: 'ro', SI: 'sl', HR: 'hr', BG: 'bg' };

  // Přeloží text přes veřejný Google endpoint (CORS povolen). Překládá po
  // řádcích, aby se zachovalo ruční zalomení (\n).
  async function translateText(text, from, to) {
    if (!text || !text.trim()) return text || '';
    const lines = String(text).split('\n');
    const out = [];
    for (const ln of lines) {
      if (!ln.trim()) { out.push(ln); continue; }
      const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' +
        from + '&tl=' + to + '&dt=t&q=' + encodeURIComponent(ln);
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      out.push(data && data[0] ? data[0].map((s) => s[0]).join('') : ln);
    }
    return out.join('\n');
  }

  // Přeloží text a ZACHOVÁ zvýraznění (*[..]slovo*) — každý úsek přeloží zvlášť
  // a znovu obalí stejnými značkami, takže zůstane naformátovaná ta samá část.
  async function translateFormatted(text, from, to) {
    const segs = String(text || '').split('*');
    const keepSpace = async (s) => {
      if (!s) return s;
      const lead = (s.match(/^\s*/) || [''])[0];
      const trail = (s.match(/\s*$/) || [''])[0];
      const core = s.slice(lead.length, s.length - (trail.length || 0));
      if (!core) return s;
      return lead + (await translateText(core, from, to)) + trail;
    };
    const out = [];
    for (let i = 0; i < segs.length; i++) {
      if (i % 2 === 1) {
        const m = segs[i].match(/^\[[^\]]*\]/);
        const attr = m ? m[0] : '';
        const body = m ? segs[i].slice(m[0].length) : segs[i];
        out.push(attr + (await keepSpace(body)));
      } else {
        out.push(await keepSpace(segs[i]));
      }
    }
    return out.join('*');
  }

  async function autoTranslateAll() {
    const src = state.activeLang;
    const from = ISO_LANG[src] || 'cs';
    if (!confirm('Automaticky přeložit z „' + src + '" do všech ostatních jazyků? Přepíše to jejich současné texty (strojový překlad je nutné zkontrolovat).')) return;
    const scope = textScope();
    const base = textTarget(src);
    const btn = $('#btnAutoTranslate');
    btn.disabled = true;
    const targets = LANGUAGES.filter((l) => l.code !== src);
    try {
      for (const l of targets) {
        const to = ISO_LANG[l.code];
        setStatus('Překládám… ' + l.code);
        const [h, s, c] = await Promise.all([
          translateFormatted(base.headline, from, to),
          translateFormatted(base.subline, from, to),
          translateFormatted(base.cta, from, to),
        ]);
        scope[l.code] = { headline: h, subline: s, cta: c };
      }
      syncTextInputs();
      renderPreview();
      setStatus('Přeloženo do všech jazyků. Zkontroluj prosím znění — je to strojový překlad.');
    } catch (e) {
      setStatus('Automatický překlad se nepodařil (nejspíš připojení nebo blokace prohlížeče). Přelož ručně přes záložky jazyků.', true);
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- pusinka: barvy v horní liště (dle manuálu) ----------
  function badgeSwatchColors() {
    const p = (state.brand && state.brand.palette) || {};
    const c = (state.brand && state.brand.colors) || {};
    const fill = [
      { c: p.primaryPink || c.primary || '#DC004E', t: 'Růžová' },
      { c: p.violet || c.accent || '#985FA3', t: 'Fialová' },
      { c: p.darkViolet || c.secondary || '#1F0F36', t: 'Tmavá' },
      { c: p.lightPink || '#F8C7C8', t: 'Světlá růžová' },
    ];
    const text = [
      { c: p.white || '#FFFFFF', t: 'Bílá' },
      { c: p.darkViolet || '#1F0F36', t: 'Tmavá' },
      { c: p.primaryPink || '#DC004E', t: 'Růžová' },
    ];
    return { fill, text };
  }
  function buildBadgeSwatches() {
    const { fill, text } = badgeSwatchColors();
    const mk = (arr, wrapSel, get, set) => {
      const wrap = $(wrapSel);
      wrap.innerHTML = '';
      arr.forEach((o) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tt-swatch';
        b.style.background = o.c;
        b.title = o.t;
        b.addEventListener('click', () => { set(o.c); syncTextToolbar(); scheduleRender(); });
        wrap.appendChild(b);
      });
    };
    mk(fill, '#ttBadgeFill', () => state.badgeColor, (v) => { state.badgeColor = v; $('#discountColor').value = v; });
    mk(text, '#ttBadgeText', () => state.badgeTextColor, (v) => { state.badgeTextColor = v; $('#discountTextColor').value = v; });
  }
  function syncBadgeSwatches() {
    const cur = (state.badgeColor || '').toLowerCase();
    const curT = (state.badgeTextColor || '').toLowerCase();
    $$('#ttBadgeFill .tt-swatch').forEach((b) =>
      b.classList.toggle('sel', (b.style.background && rgbToHex(b.style.background)) === cur));
    $$('#ttBadgeText .tt-swatch').forEach((b) =>
      b.classList.toggle('sel', (b.style.background && rgbToHex(b.style.background)) === curT));
  }
  // ---------- CTA: barvy v horní liště (dle manuálu) ----------
  function ctaSwatchColors() {
    const p = (state.brand && state.brand.palette) || {};
    return [
      { c: p.green || '#2FB773', t: 'Zelená' },
      { c: p.primaryPink || '#DC004E', t: 'Růžová' },
      { c: p.violet || '#985FA3', t: 'Fialová' },
      { c: p.lightPink || '#F8C7C8', t: 'Světlá růžová' },
      { c: p.darkViolet || '#1F0F36', t: 'Tmavá' },
    ];
  }
  function buildCtaSwatches() {
    const wrap = $('#ttCtaColor');
    wrap.innerHTML = '';
    ctaSwatchColors().forEach((o) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tt-swatch';
      b.style.background = o.c;
      b.title = o.t;
      b.addEventListener('click', () => {
        state.ctaColor = o.c;
        $('#ctaColor').value = o.c;
        document.documentElement.style.setProperty('--brand-cta', o.c);
        syncCtaControls();
        scheduleRender();
      });
      wrap.appendChild(b);
    });
  }
  function syncCtaControls() {
    $('#ttCtaArrow').checked = state.ctaArrow;
    const cur = (state.ctaColor || '').toLowerCase();
    $$('#ttCtaColor .tt-swatch').forEach((b) =>
      b.classList.toggle('sel', rgbToHex(b.style.background) === cur));
  }

  // pomocník: „rgb(a,b,c)" → „#rrggbb" (pro porovnání s uloženou hex barvou)
  function rgbToHex(rgb) {
    if (!rgb) return '';
    if (rgb[0] === '#') return rgb.toLowerCase();
    const m = rgb.match(/\d+/g);
    if (!m) return rgb.toLowerCase();
    return '#' + m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, '0')).join('').toLowerCase();
  }

  // ---------- události ----------
  function wireEvents() {
    $('#formatSelect').addEventListener('change', (e) => {
      state.activeFormat = e.target.value;
      syncTextInputs();
      renderPreview();
    });

    // Šablona je PER FORMÁT — nastavuje se jen aktivnímu rozměru.
    $('#templateSelect').addEventListener('change', (e) => {
      const ov = ensureOverride(state.activeFormat);
      ov.template = e.target.value;
      const d = TEMPLATES.find((t) => t.id === e.target.value);
      if (d) $('#templateDesc').textContent = d.description;
      scheduleRender();
    });

    $('#inHeadline').addEventListener('input', (e) => {
      textTarget(state.activeLang).headline = e.target.value;
      scheduleRender();
    });
    $('#inSubline').addEventListener('input', (e) => {
      textTarget(state.activeLang).subline = e.target.value;
      scheduleRender();
    });
    // sleduj, ve kterém poli a úseku je kurzor (kvůli zvýraznění)
    ['#inHeadline', '#inSubline'].forEach((sel) => {
      const ta = $(sel);
      ['focus', 'click', 'keyup', 'select', 'input'].forEach((ev) =>
        ta.addEventListener(ev, () => { lastTextField = sel; refreshHighlightControls(); })
      );
    });

    // Zvýraznit označené slovo — obalí výběr *[velikost,barva]slovo* s aktuálními
    // výchozími hodnotami (každé slovo tak je hned nezávislé). Klik uvnitř
    // existujícího zvýraznění (bez výběru) ho zruší.
    $('#btnWrapHighlight').addEventListener('click', () => {
      const ta = $(lastTextField);
      const key = highlightKey();
      const val = ta.value || '';
      let start = ta.selectionStart, end = ta.selectionEnd;

      if (start === end) {
        const run = highlightRunAt(val, start);
        if (run) {
          const a = readRunAttrs(val, run);
          const text = val.slice(a.textStart, run.close);
          const newVal = val.slice(0, run.open) + text + val.slice(run.close + 1);
          ta.value = newVal;
          textTarget(state.activeLang)[key] = newVal;
          scheduleRender(); ta.focus(); refreshHighlightControls();
          setStatus('Zvýraznění zrušeno.');
          return;
        }
        setStatus('Označ nejdřív myší slovo v headline nebo subline (nebo klikni do zvýrazněného slova pro zrušení).', true);
        ta.focus();
        return;
      }
      // ořízni okolní mezery z výběru (ať hvězdičky sedí na slovo)
      while (start < end && /\s/.test(val[start])) start++;
      while (end > start && /\s/.test(val[end - 1])) end--;
      let selected = val.slice(start, end);
      // už zvýrazněné → zruš (odstraň hvězdičky i případné parametry)
      if (selected.length >= 2 && selected[0] === '*' && selected[selected.length - 1] === '*') {
        const inner = selected.slice(1, -1).replace(/^\[[^\]]*\]/, '');
        const newVal = val.slice(0, start) + inner + val.slice(end);
        ta.value = newVal;
        textTarget(state.activeLang)[key] = newVal;
        scheduleRender(); ta.focus(); refreshHighlightControls();
        return;
      }
      const attr = fmtAttr(state.highlightScale, state.highlightColor);
      const newVal = val.slice(0, start) + '*' + attr + selected + '*' + val.slice(end);
      ta.value = newVal;
      textTarget(state.activeLang)[key] = newVal;
      // kurzor dovnitř nového úseku → posuvníky rovnou míří na něj
      const caret = start + 1 + attr.length + 1;
      ta.setSelectionRange(caret, caret);
      scheduleRender(); ta.focus(); refreshHighlightControls();
      setStatus('Slovo zvýrazněno. Velikost i barvu teď měň jen jemu — je nezávislé na ostatních.');
    });
    $('#inCta').addEventListener('input', (e) => {
      textTarget(state.activeLang).cta = e.target.value;
      scheduleRender();
    });

    wireTextToolbar();

    $('#btnAutoTranslate').addEventListener('click', autoTranslateAll);


    $('#uploadFull').addEventListener('change', (e) => handleUpload(e.target.files[0]));
    $('#thumb-full').addEventListener('click', () => $('#uploadFull').click());
    $('#btnClearFull').addEventListener('click', (e) => {
      e.stopPropagation();
      state.image = null;
      updateImageThumbs();
      renderPreview();
    });

    // rozvržení obrázku
    $('#imgZoom').addEventListener('input', (e) => {
      const ov = ensureOverride(state.activeFormat);
      ov.image.scale = (+e.target.value) / 100;
      $('#zoomVal').textContent = e.target.value + '%';
      scheduleRender();
    });
    $('#imgX').addEventListener('input', (e) => {
      const ov = ensureOverride(state.activeFormat);
      ov.image.offsetX = (+e.target.value) / 100;
      scheduleRender();
    });
    $('#imgY').addEventListener('input', (e) => {
      const ov = ensureOverride(state.activeFormat);
      ov.image.offsetY = (+e.target.value) / 100;
      scheduleRender();
    });
    $('#btnResetLayout').addEventListener('click', () => {
      delete state.overrides[state.activeFormat];
      syncLayoutControls();
      renderPreview();
      setStatus('Rozvržení tohoto rozměru resetováno.');
    });

    // další obrázek (per formát)
    $('#btnAddExtra').addEventListener('click', () => $('#uploadExtra').click());
    $('#uploadExtra').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      const dataURL = await readFileAsDataURL(file);
      const img = await loadImage(dataURL);
      const src = img ? downscaleToDataURL(img, 1200, 0.85) : dataURL;
      await loadImage(src); // zajisti, že je zmenšená verze v cache
      const ov = ensureOverride(state.activeFormat);
      const prev = ov.extra || {};
      ov.extra = { src: src, x: prev.x == null ? 0.5 : prev.x, y: prev.y == null ? 0.5 : prev.y, scale: prev.scale || 1 };
      e.target.value = '';
      syncLayoutControls();
      renderPreview();
      setStatus('Další obrázek přidán do rozměru ' + state.activeFormat + '. Přetáhni ho myší.');
    });
    $('#extraSize').addEventListener('input', (e) => {
      const ov = state.overrides[state.activeFormat];
      if (ov && ov.extra) ov.extra.scale = (+e.target.value) / 100;
      $('#extraSizeVal').textContent = e.target.value + '%';
      scheduleRender();
    });
    $('#btnRemoveExtra').addEventListener('click', () => {
      const ov = state.overrides[state.activeFormat];
      if (ov && ov.extra) delete ov.extra;
      syncLayoutControls();
      renderPreview();
      setStatus('Další obrázek odebrán z rozměru ' + state.activeFormat + '.');
    });

    // styl prvků
    $('#ctaColor').addEventListener('input', (e) => {
      state.ctaColor = e.target.value;
      document.documentElement.style.setProperty('--brand-cta', state.ctaColor);
      scheduleRender();
    });
    $$('.swatch-btn[data-cta]').forEach((b) =>
      b.addEventListener('click', () => {
        state.ctaColor = b.getAttribute('data-cta');
        $('#ctaColor').value = state.ctaColor;
        document.documentElement.style.setProperty('--brand-cta', state.ctaColor);
        scheduleRender();
      })
    );
    $('#textColor').addEventListener('change', (e) => {
      state.textColor = e.target.value;
      scheduleRender();
    });
    $('#ctaArrow').addEventListener('change', (e) => {
      state.ctaArrow = e.target.checked;
      scheduleRender();
    });
    $('#ctaShow').addEventListener('change', (e) => {
      ensureOverride(state.activeFormat).ctaHidden = !e.target.checked;
      renderPreview();
    });
    $('#perFormatText').addEventListener('change', (e) => {
      const fmt = state.activeFormat;
      if (e.target.checked) {
        const ov = ensureOverride(fmt);
        if (!ov.texts) ov.texts = {};
        textTarget(state.activeLang); // nasej aktuální jazyk z dosavadních textů
        setStatus('Texty teď platí jen pro rozměr „' + fmt + '". Ostatní rozměry mají svoje.');
      } else {
        const ov = state.overrides[fmt];
        if (ov && ov.texts) {
          if (!confirm('Zrušit vlastní texty tohoto rozměru a vrátit se ke společným?')) { e.target.checked = true; return; }
          delete ov.texts;
        }
        setStatus('Rozměr „' + fmt + '" teď používá společné texty.');
      }
      syncTextInputs();
      renderPreview();
    });
    $('#textScale').addEventListener('input', (e) => {
      state.textScale = (+e.target.value) / 100;
      $('#textScaleVal').textContent = e.target.value + '%';
      scheduleRender();
    });
    $('#showLogo').addEventListener('change', (e) => {
      const ov = ensureOverride(state.activeFormat);
      ov.logoHidden = !e.target.checked;
      scheduleRender();
    });
    $('#btnResetLogo').addEventListener('click', () => {
      const ov = state.overrides[state.activeFormat];
      if (ov) { delete ov.logo; delete ov.logoHidden; }
      syncLayoutControls();
      renderPreview();
    });
    $('#logoScale').addEventListener('input', (e) => {
      ensureOverride(state.activeFormat).logoScale = (+e.target.value) / 100;
      $('#logoScaleVal').textContent = e.target.value + '%';
      scheduleRender();
    });
    $('#logoColorMode').addEventListener('change', (e) => {
      state.logoColorMode = e.target.value;
      scheduleRender();
    });
    $('#showGuides').addEventListener('change', (e) => {
      state.showGuides = e.target.checked;
      scheduleRender();
    });
    $('#showGrid').addEventListener('change', (e) => {
      state.showGrid = e.target.checked;
      scheduleRender();
    });
    $('#discountShow').addEventListener('change', (e) => {
      state.discount.show = e.target.checked;
      scheduleRender();
    });
    $('#discountText').addEventListener('input', (e) => {
      state.discount.text = e.target.value;
      scheduleRender();
    });
    $('#discountColor').addEventListener('input', (e) => {
      state.badgeColor = e.target.value;
      scheduleRender();
    });
    $('#discountTextColor').addEventListener('input', (e) => {
      state.badgeTextColor = e.target.value;
      scheduleRender();
    });
    // Barva/velikost zvýraznění: upraví ÚSEK pod kurzorem (je-li), jinak nastaví
    // výchozí hodnotu pro nově zvýrazňovaná slova.
    $('#highlightColor').addEventListener('input', (e) => {
      const col = e.target.value;
      if (focusedRun && $(focusedRun.field)) {
        const ta = $(focusedRun.field);
        const a = readRunAttrs(ta.value, focusedRun);
        const res = writeRunAttrs(ta.value, focusedRun, a.scale, col);
        ta.value = res.value; focusedRun.close = res.close;
        textTarget(state.activeLang)[focusedRun.field === '#inSubline' ? 'subline' : 'headline'] = res.value;
      } else {
        state.highlightColor = col;
      }
      scheduleRender();
    });
    $('#highlightScale').addEventListener('input', (e) => {
      const sc = (+e.target.value) / 100;
      $('#highlightScaleVal').textContent = e.target.value + '%';
      if (focusedRun && $(focusedRun.field)) {
        const ta = $(focusedRun.field);
        const a = readRunAttrs(ta.value, focusedRun);
        const res = writeRunAttrs(ta.value, focusedRun, sc, a.color);
        ta.value = res.value; focusedRun.close = res.close;
        textTarget(state.activeLang)[focusedRun.field === '#inSubline' ? 'subline' : 'headline'] = res.value;
      } else {
        state.highlightScale = sc;
      }
      scheduleRender();
    });
    $('#discountSize').addEventListener('input', (e) => {
      ensureOverride(state.activeFormat).badgeSize = (+e.target.value) / 100;
      $('#discountSizeVal').textContent = e.target.value + '%';
      scheduleRender();
    });
    $('#focusX').addEventListener('input', (e) => {
      state.imageFocus.x = (+e.target.value) / 100;
      $('#focusXVal').textContent = e.target.value + '%';
      scheduleRender();
    });
    $('#focusY').addEventListener('input', (e) => {
      state.imageFocus.y = (+e.target.value) / 100;
      $('#focusYVal').textContent = e.target.value + '%';
      scheduleRender();
    });
    $('#hideLogoAll').addEventListener('change', (e) => {
      state.logoDefaultHidden = e.target.checked;
      // aplikuj na všechny rozměry — zruš per-formát výjimky loga
      Object.values(state.overrides).forEach((o) => {
        if (o) delete o.logoHidden;
      });
      syncLayoutControls();
      renderPreview();
    });

    // tažení prvků v náhledu
    const preview = $('#mainPreview');
    preview.addEventListener('pointerdown', onPointerDown);
    preview.addEventListener('pointermove', onHoverMove);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    $('#autoKB').addEventListener('change', (e) => {
      state.autoKB = e.target.checked;
      syncKBField();
    });
    $('#btnExportPng').addEventListener('click', exportCurrentPNG);
    $('#btnExportZip').addEventListener('click', exportBatchZip);

    $('#btnSaveDefault').addEventListener('click', () => {
      const res = saveToStorage(DEFAULT_KEY, serializeState());
      if (res === 'fail') setStatus('Uložení výchozího selhalo — paměť je plná.', true);
      else setStatus('Výchozí rozvržení uloženo — načte se automaticky při startu.');
    });
    $('#btnClearDefault').addEventListener('click', () => {
      try { localStorage.removeItem(DEFAULT_KEY); } catch (e) {}
      setStatus('Výchozí rozvržení zrušeno.');
    });

    $('#btnExportHtml').addEventListener('click', exportWithPreset);

    // Odebrat vizuál — jen smaže obrázek (dvojí potvrzení).
    $('#btnRemoveImage').addEventListener('click', () => {
      if (!confirm('Odebrat nahraný vizuál z projektu?')) return;
      if (!confirm('Určitě? Vizuál se odstraní ze všech bannerů. Tuto akci nelze vrátit.')) return;
      state.image = null;
      state.imageStore = null;
      state.imageAvg = null;
      updateImageThumbs();
      renderPreview();
      setStatus('Vizuál odebrán.');
    });

    // Reset umístění — vrátí zoom/posun/těžiště u všech rozměrů (dvojí potvrzení).
    $('#btnResetPlacement').addEventListener('click', () => {
      if (!confirm('Resetovat umístění vizuálu (zoom, posun, těžiště) u VŠECH rozměrů?')) return;
      if (!confirm('Určitě? Ruční doladění obrázku u všech rozměrů se ztratí. Tuto akci nelze vrátit.')) return;
      state.imageFocus = { x: 0.5, y: 0.45 };
      Object.values(state.overrides).forEach((o) => {
        if (o) o.image = { scale: 1, offsetX: 0, offsetY: 0 };
      });
      syncStyleControls();
      syncLayoutControls();
      renderPreview();
      setStatus('Umístění vizuálu resetováno u všech rozměrů.');
    });

    $('#btnSaveProject').addEventListener('click', saveNamedProject);
    $('#btnLoadProject').addEventListener('click', loadNamedProject);
    $('#btnDeleteProject').addEventListener('click', deleteNamedProject);

    $('#btnSelectAllFormats').addEventListener('click', () =>
      $$('#exportFormats input').forEach((i) => (i.checked = true))
    );
    $('#btnSelectNoneFormats').addEventListener('click', () =>
      $$('#exportFormats input').forEach((i) => (i.checked = false))
    );
    $('#btnSelectAllLangs').addEventListener('click', () =>
      $$('#exportLangs input').forEach((i) => (i.checked = true))
    );
    $('#btnSelectNoneLangs').addEventListener('click', () =>
      $$('#exportLangs input').forEach((i) => (i.checked = false))
    );
  }

  // ---------- init ----------
  async function init() {
    // zachyť čistý zdroj stránky ještě před tím, než ho JS začne měnit
    // (pro „zapečení" nastavení do samostatného HTML)
    try { pristineHTML = '<!DOCTYPE html>\n' + document.documentElement.outerHTML; } catch (e) {}
    await loadBrand();
    buildFormatSelect();
    buildTemplateSelect();
    buildLangTabs();
    buildExportCheckboxes();
    syncTextInputs();
    syncStyleControls();
    buildBadgeSwatches();
    buildCtaSwatches();
    syncTextToolbar();
    updateImageThumbs();
    document.documentElement.style.setProperty('--brand-cta', state.ctaColor);
    wireEvents();
    refreshProjectList();

    try {
      // Zapečené nastavení (window.__PRESET__) se aplikuje při prvním otevření
      // souboru; pak už má přednost rozpracovaný autosave (aby si příjemce
      // neztratil vlastní úpravy). Jinak výchozí rozvržení.
      const preset = window.__PRESET__;
      const presetId = preset && preset.savedAt;
      const applied = (function () { try { return localStorage.getItem('abg:presetApplied'); } catch (e) { return null; } })();
      if (preset && applied !== presetId) {
        applySerialized(preset);
        try { localStorage.setItem('abg:presetApplied', presetId || '1'); } catch (e) {}
      } else {
        const auto = localStorage.getItem(AUTOSAVE_KEY) || localStorage.getItem(DEFAULT_KEY);
        if (auto) applySerialized(JSON.parse(auto));
      }
    } catch (e) {
      /* ignore */
    }

    renderPreview();
    setStatus('Připraveno.');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
