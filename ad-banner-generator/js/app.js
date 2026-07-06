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

  // Logo se liší podle země: CZ = Růžový Slon, SK = Ružový slon,
  // ostatní (zahraničí) = Sexy Elephant. Řízeno brand.logoByLang.
  function logoFor(lang) {
    const map = (state.brand && state.brand.logoByLang) || {};
    return map[lang] || map.default || (state.brand && state.brand.logoText) || '';
  }

  function specFor(lang) {
    const t = textsFor(lang);
    return {
      headline: t.headline,
      subline: t.subline,
      cta: t.cta,
      template: state.template,
      discount: state.discount,
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

  function optsFor(fmt) {
    return {
      override: state.overrides[fmt] || null,
      ctaColor: state.ctaColor,
      textColor: state.textColor,
      textScale: state.textScale,
      textStyle: state.textStyle,
      logoDefaultHidden: state.logoDefaultHidden,
      logoScale: state.logoScale,
      logoColorMode: state.logoColorMode,
      imageFocus: state.imageFocus,
      imageAvg: state.imageAvg,
      badgeColor: state.badgeColor || (state.brand && state.brand.colors.primary),
    };
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
    renderBanner(ctx, format, specFor(lang), state.brand, img, optsFor(formatId));
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
    const t = textsFor(state.activeLang);
    $('#inHeadline').value = t.headline || '';
    $('#inSubline').value = t.subline || '';
    $('#inCta').value = t.cta || '';
    $('#activeLangLabel').textContent = langByCode(state.activeLang).label;
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
    $('#logoScale').value = Math.round(state.logoScale * 100);
    $('#logoScaleVal').textContent = Math.round(state.logoScale * 100) + '%';
    $('#logoColorMode').value = state.logoColorMode;
  }

  function syncTextToolbar() {
    const el = state.selectedEl;
    const s = state.textStyle[el];
    $$('#ttElements button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-sel') === el));
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
        state.textStyle[state.selectedEl].align = b.getAttribute('data-align');
        syncTextToolbar();
        scheduleRender();
      })
    );
    $('#ttSize').addEventListener('input', (e) => {
      state.textStyle[state.selectedEl].size = (+e.target.value) / 100;
      $('#ttSizeVal').textContent = e.target.value + '%';
      scheduleRender();
    });
    $('#ttLineHeight').addEventListener('input', (e) => {
      state.textStyle[state.selectedEl].lineHeight = (+e.target.value) / 100;
      $('#ttLhVal').textContent = ((+e.target.value) / 100).toFixed(2);
      scheduleRender();
    });
  }

  function syncStyleControls() {
    $('#ctaColor').value = state.ctaColor;
    $('#textColor').value = state.textColor;
    $('#textScale').value = Math.round(state.textScale * 100);
    $('#textScaleVal').textContent = Math.round(state.textScale * 100) + '%';
    $('#ctaArrow').checked = state.ctaArrow;
    $('#hideLogoAll').checked = state.logoDefaultHidden;
    $('#showGuides').checked = state.showGuides;
    $('#showGrid').checked = state.showGrid;
    $('#discountShow').checked = state.discount.show;
    $('#discountText').value = state.discount.text;
    $('#discountColor').value = state.badgeColor || (state.brand && state.brand.colors.primary) || '#DC004E';
    $('#discountSize').value = Math.round((state.discount.size || 1) * 100);
    $('#discountSizeVal').textContent = Math.round((state.discount.size || 1) * 100) + '%';
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
    const layout = renderBanner(ctx, format, specFor(lang), state.brand, img, optsFor(format.id));
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

  async function renderPreview() {
    const format = formatById(state.activeFormat);
    const mainCanvas = $('#mainPreview');
    const img = await loadImage(currentImageDataURL());
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
    const order = ['badge', 'logo', 'cta', 'subline', 'headline'];
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
      if ((hit === 'headline' || hit === 'subline' || hit === 'cta') && !ov.manual) {
        seedManual(ov, format);
      }
      if (hit === 'badge' && !ov.badge) {
        const b = lastLayout.boxes.badge;
        ov.badge = { x: (b.x + b.w / 2) / format.width, y: (b.y + b.h / 2) / format.height };
      }
      if (hit === 'logo' && !ov.logo) {
        const b = lastLayout.boxes.logo;
        ov.logo = { x: b.x / format.width, y: b.y / format.height };
      }
      if (hit === 'headline' || hit === 'subline' || hit === 'cta') selectElement(hit);
      const cur = ov[hit] || { x: 0, y: 0 };
      drag = { kind: 'el', el: hit, downX: p.x, downY: p.y, origX: cur.x, origY: cur.y, W: format.width, H: format.height };
    }
    $('#mainPreview').classList.add('dragging');
    e.preventDefault();
    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
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
      if (drag.el === 'badge') {
        if (Math.abs(nx - rcx) < thr) { nx = rcx; snapX = true; }
        if (Math.abs(ny - rcy) < thr) { ny = rcy; snapY = true; }
      } else if (b) {
        const bw = b.w / drag.W, bh = b.h / drag.H;
        if (Math.abs(nx + bw / 2 - rcx) < thr) { nx = rcx - bw / 2; snapX = true; }
        if (Math.abs(ny + bh / 2 - rcy) < thr) { ny = rcy - bh / 2; snapY = true; }
      }
      ov[drag.el] = { x: clamp(nx, 0, 0.99), y: clamp(ny, 0, 0.99) };
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
    drag = null;
    $('#mainPreview').classList.remove('dragging');
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

  // Zakóduje canvas dle zvoleného formátu. U JPG hledá kvalitu tak, aby se
  // vešel pod zadaný limit velikosti (auto-komprese pro Sklik/Heureka/PPC).
  async function encodeCanvas(canvas) {
    const fmt = $('#exportFileFormat').value;
    if (fmt === 'jpg') {
      const maxBytes = (parseInt($('#exportMaxKB').value, 10) || 250) * 1024;
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
    const { blob, ext, over } = await encodeCanvas(canvas);
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
        const { blob, ext, over } = await encodeCanvas(canvas);
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

  // ---------- události ----------
  function wireEvents() {
    $('#formatSelect').addEventListener('change', (e) => {
      state.activeFormat = e.target.value;
      renderPreview();
    });

    $('#templateSelect').addEventListener('change', (e) => {
      state.template = e.target.value;
      $('#templateDesc').textContent = TEMPLATES.find((t) => t.id === state.template).description;
      scheduleRender();
    });

    $('#inHeadline').addEventListener('input', (e) => {
      textsFor(state.activeLang).headline = e.target.value;
      scheduleRender();
    });
    $('#inSubline').addEventListener('input', (e) => {
      textsFor(state.activeLang).subline = e.target.value;
      scheduleRender();
    });
    $('#inCta').addEventListener('input', (e) => {
      textsFor(state.activeLang).cta = e.target.value;
      scheduleRender();
    });

    wireTextToolbar();

    $('#btnResetLang').addEventListener('click', () => {
      const d = langByCode(state.activeLang).defaults;
      state.texts[state.activeLang] = { headline: d.headline, subline: d.subline, cta: d.cta };
      syncTextInputs();
      renderPreview();
    });

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
      state.logoScale = (+e.target.value) / 100;
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
    $('#discountSize').addEventListener('input', (e) => {
      state.discount.size = (+e.target.value) / 100;
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

    $('#btnResetApp').addEventListener('click', () => {
      if (!confirm('Odebrat vizuál a resetovat jeho umístění (zoom/posun/těžiště) ve všech rozměrech? Texty a rozvržení zůstanou.')) return;
      state.image = null;
      state.imageStore = null;
      state.imageAvg = null;
      state.imageFocus = { x: 0.5, y: 0.45 };
      Object.values(state.overrides).forEach((o) => {
        if (o) o.image = { scale: 1, offsetX: 0, offsetY: 0 };
      });
      updateImageThumbs();
      syncStyleControls();
      syncLayoutControls();
      renderPreview();
      setStatus('Vizuál odebrán a umístění resetováno.');
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
    await loadBrand();
    buildFormatSelect();
    buildTemplateSelect();
    buildLangTabs();
    buildExportCheckboxes();
    syncTextInputs();
    syncStyleControls();
    syncTextToolbar();
    updateImageThumbs();
    document.documentElement.style.setProperty('--brand-cta', state.ctaColor);
    wireEvents();
    refreshProjectList();

    try {
      // přednost má rozpracovaný autosave; jinak výchozí rozvržení
      const auto = localStorage.getItem(AUTOSAVE_KEY) || localStorage.getItem(DEFAULT_KEY);
      if (auto) applySerialized(JSON.parse(auto));
    } catch (e) {
      /* ignore */
    }

    renderPreview();
    setStatus('Připraveno.');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
