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

  // ---------- stav ----------
  const state = {
    brand: null,
    activeFormat: FORMATS[0].id,
    activeLang: 'CZ',
    template: 'overlay',
    version: 'full', // 'safe' | 'full'
    images: { safe: null, full: null }, // dataURL
    texts: {}, // per jazyk: { CZ:{headline,subline,cta}, ... }

    // styl prvků (globální)
    ctaColor: '#2FB773', // zelená z palety manuálu
    textColor: 'auto', // 'auto' | 'light' | 'dark'
    textScale: 1, // násobič velikosti textů (0.6–2.5)
    showGuides: false, // vodicí středové lišty v náhledu
    showGrid: false, // jemná vodicí mřížka v náhledu
    discount: { show: false, text: '-20 %' },
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
    return state.images[state.version] || state.images.full || state.images.safe || null;
  }

  function textsFor(lang) {
    if (!state.texts[lang]) {
      const d = langByCode(lang).defaults;
      state.texts[lang] = { headline: d.headline, subline: d.subline, cta: d.cta };
    }
    return state.texts[lang];
  }

  function specFor(lang) {
    const t = textsFor(lang);
    return {
      headline: t.headline,
      subline: t.subline,
      cta: t.cta,
      template: state.template,
      discount: state.discount,
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
    Object.entries(c).forEach(([key, val]) => {
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
  async function renderToCanvas(formatId, lang, version) {
    const format = formatById(formatId);
    const canvas = document.createElement('canvas');
    canvas.width = format.width;
    canvas.height = format.height;
    const ctx = canvas.getContext('2d');
    const dataURL = state.images[version] || state.images.full || state.images.safe || null;
    const img = await loadImage(dataURL);
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
    $('#showLogo').checked = !(ov && ov.logoHidden);
  }

  function syncStyleControls() {
    $('#ctaColor').value = state.ctaColor;
    $('#textColor').value = state.textColor;
    $('#textScale').value = Math.round(state.textScale * 100);
    $('#textScaleVal').textContent = Math.round(state.textScale * 100) + '%';
    $('#showGuides').checked = state.showGuides;
    $('#showGrid').checked = state.showGrid;
    $('#discountShow').checked = state.discount.show;
    $('#discountText').value = state.discount.text;
    $('#discountColor').value = state.badgeColor || (state.brand && state.brand.colors.primary) || '#DC004E';
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
        drawCenterGuides(ctx, format, overlay);
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

  function drawCenterGuides(ctx, format, o) {
    const W = format.width, H = format.height;
    ctx.save();
    // svislá lišta (střed X)
    ctx.strokeStyle = o.snapX ? 'rgba(17,170,170,1)' : 'rgba(17,170,170,0.4)';
    ctx.lineWidth = o.snapX ? 3 : 1.5;
    ctx.setLineDash(o.snapX ? [] : [9, 8]);
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    // vodorovná lišta (střed Y)
    ctx.strokeStyle = o.snapY ? 'rgba(17,170,170,1)' : 'rgba(17,170,170,0.4)';
    ctx.lineWidth = o.snapY ? 3 : 1.5;
    ctx.setLineDash(o.snapY ? [] : [9, 8]);
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
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
    const overlay = {
      grid: state.showGrid,
      safeZone: true,
      centerGuides: state.showGuides || !!drag,
      snapX: !!(drag && drag.snapX),
      snapY: !!(drag && drag.snapY),
    };
    lastLayout = renderIntoCanvas(mainCanvas, format, state.activeLang, img, 1600, overlay);
    $('#previewMeta').textContent =
      `${format.id} · ${format.label} · ${state.activeLang} · ${state.version.toUpperCase()}`;
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
      const b = lastLayout.boxes[drag.el];
      if (drag.el === 'badge') {
        if (Math.abs(nx - 0.5) < thr) { nx = 0.5; snapX = true; }
        if (Math.abs(ny - 0.5) < thr) { ny = 0.5; snapY = true; }
      } else if (b) {
        const bw = b.w / drag.W, bh = b.h / drag.H;
        if (Math.abs(nx + bw / 2 - 0.5) < thr) { nx = 0.5 - bw / 2; snapX = true; }
        if (Math.abs(ny + bh / 2 - 0.5) < thr) { ny = 0.5 - bh / 2; snapY = true; }
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
    const canvas = await renderToCanvas(state.activeFormat, state.activeLang, state.version);
    const { blob, ext, over } = await encodeCanvas(canvas);
    downloadBlob(blob, `${state.activeFormat}_${state.activeLang}_${state.version}.${ext}`);
    if (over) setStatus('Pozor: ani při nejnižší kvalitě se JPG nevešel pod limit.', true);
  }

  async function exportBatchZip() {
    const formats = $$('#exportFormats input:checked').map((i) => i.value);
    const langs = $$('#exportLangs input:checked').map((i) => i.value);
    const versionSel = $('#exportVersion').value;
    let versions;
    if (versionSel === 'both') versions = ['safe', 'full'];
    else if (versionSel === 'current') versions = [state.version];
    else versions = [versionSel];

    if (!formats.length || !langs.length) {
      setStatus('Vyber alespoň jeden formát a jeden jazyk.', true);
      return;
    }

    const total = formats.length * langs.length * versions.length;
    const btn = $('#btnExportZip');
    btn.disabled = true;
    let done = 0;

    const zip = new window.ZipWriter();
    let oversized = 0;
    for (const version of versions) {
      for (const fmt of formats) {
        for (const lang of langs) {
          const canvas = await renderToCanvas(fmt, lang, version);
          const { blob, ext, over } = await encodeCanvas(canvas);
          if (over) oversized++;
          const buf = new Uint8Array(await blob.arrayBuffer());
          const folder = versions.length > 1 ? `${version}/${fmt}` : fmt;
          zip.addFile(`${folder}/${fmt}_${lang}.${ext}`, buf);
          done++;
          setStatus(`Generuji… ${done}/${total}`);
        }
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
      version: state.version,
      images: state.images,
      texts: state.texts,
      ctaColor: state.ctaColor,
      textColor: state.textColor,
      textScale: state.textScale,
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
    state.version = data.version || state.version;
    state.images = data.images || { safe: null, full: null };
    state.texts = data.texts || {};
    if (data.ctaColor) state.ctaColor = data.ctaColor;
    if (data.textColor) state.textColor = data.textColor;
    if (data.textScale) state.textScale = data.textScale;
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
    $$('input[name="version"]').forEach((r) => (r.checked = r.value === state.version));
    updateImageThumbs();
    buildLangTabs();
    syncTextInputs();
    syncStyleControls();
    document.documentElement.style.setProperty('--brand-cta', state.ctaColor);
    renderPreview();
  }

  function saveAutosave() {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeState()));
    } catch (e) {
      /* localStorage plný nebo nedostupný */
    }
  }

  function saveNamedProject() {
    const name = ($('#projectName').value || '').trim();
    if (!name) {
      setStatus('Zadej název projektu pro uložení.', true);
      return;
    }
    try {
      localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(serializeState()));
      setStatus(`Projekt „${name}" uložen.`);
      refreshProjectList();
    } catch (e) {
      setStatus('Uložení selhalo (localStorage plný?).', true);
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

  async function handleUpload(which, file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus('Nahraj prosím obrázek.', true);
      return;
    }
    const dataURL = await readFileAsDataURL(file);
    state.images[which] = dataURL;
    updateImageThumbs();
    renderPreview();
  }

  function updateImageThumbs() {
    ['safe', 'full'].forEach((which) => {
      const thumb = $(`#thumb-${which}`);
      if (state.images[which]) {
        thumb.style.backgroundImage = `url("${state.images[which]}")`;
        thumb.classList.add('has-image');
      } else {
        thumb.style.backgroundImage = '';
        thumb.classList.remove('has-image');
      }
    });
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

    $$('input[name="version"]').forEach((r) =>
      r.addEventListener('change', (e) => {
        if (e.target.checked) {
          state.version = e.target.value;
          renderPreview();
        }
      })
    );

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

    $('#btnResetLang').addEventListener('click', () => {
      const d = langByCode(state.activeLang).defaults;
      state.texts[state.activeLang] = { headline: d.headline, subline: d.subline, cta: d.cta };
      syncTextInputs();
      renderPreview();
    });

    $('#uploadFull').addEventListener('change', (e) => handleUpload('full', e.target.files[0]));
    $('#uploadSafe').addEventListener('change', (e) => handleUpload('safe', e.target.files[0]));
    $('#thumb-full').addEventListener('click', () => $('#uploadFull').click());
    $('#thumb-safe').addEventListener('click', () => $('#uploadSafe').click());
    $('#btnClearFull').addEventListener('click', (e) => {
      e.stopPropagation();
      state.images.full = null;
      updateImageThumbs();
      renderPreview();
    });
    $('#btnClearSafe').addEventListener('click', (e) => {
      e.stopPropagation();
      state.images.safe = null;
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

    // tažení prvků v náhledu
    const preview = $('#mainPreview');
    preview.addEventListener('pointerdown', onPointerDown);
    preview.addEventListener('pointermove', onHoverMove);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    $('#btnExportPng').addEventListener('click', exportCurrentPNG);
    $('#btnExportZip').addEventListener('click', exportBatchZip);

    $('#btnSaveProject').addEventListener('click', saveNamedProject);
    $('#btnLoadProject').addEventListener('click', loadNamedProject);
    $('#btnDeleteProject').addEventListener('click', deleteNamedProject);

    $('#btnSelectAllFormats').addEventListener('click', () =>
      $$('#exportFormats input').forEach((i) => (i.checked = true))
    );
    $('#btnSelectAllLangs').addEventListener('click', () =>
      $$('#exportLangs input').forEach((i) => (i.checked = true))
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
    updateImageThumbs();
    document.documentElement.style.setProperty('--brand-cta', state.ctaColor);
    wireEvents();
    refreshProjectList();

    try {
      const auto = localStorage.getItem(AUTOSAVE_KEY);
      if (auto) applySerialized(JSON.parse(auto));
    } catch (e) {
      /* ignore */
    }

    renderPreview();
    setStatus('Připraveno.');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
