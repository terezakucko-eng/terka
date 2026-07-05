/*
 * Ad Banner Generator — hlavní logika.
 * Čisté HTML/JS/CSS, bez backendu. Vše běží v prohlížeči.
 */
(function () {
  'use strict';

  const { FORMATS, LANGUAGES, TEMPLATES } = window.BannerConfig;
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
    // texty per jazyk: { CZ: {headline, subline, cta}, ... }
    texts: {},
  };

  // cache načtených HTMLImageElement dle dataURL
  const imageCache = new Map();

  // ---------- pomůcky ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const formatById = (id) => FORMATS.find((f) => f.id === id);
  const langByCode = (code) => LANGUAGES.find((l) => l.code === code);

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
    return { headline: t.headline, subline: t.subline, cta: t.cta, template: state.template };
  }

  // ---------- načtení brandu ----------
  async function loadBrand() {
    try {
      const res = await fetch('brand.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      state.brand = await res.json();
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
    await loadBrandFonts();
    applyBrandToUI();
  }

  // Načte fonty z brand.json (url může být lokální fonts.css i CDN) a počká
  // na jejich dostupnost, aby canvas kreslil správným písmem.
  async function loadBrandFonts() {
    const fonts = state.brand.fonts || {};
    const urls = new Set();
    Object.values(fonts).forEach((f) => f && f.url && urls.add(f.url));

    // Vlož stylesheety a počkej na jejich načtení — teprve pak jsou @font-face
    // pravidla známá a je možné fonty přednačíst.
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

    // Probe text pokrývá latin, latin-ext (Ěě Řř íé) i cyrilici (Бб гд),
    // aby se přednačetly všechny potřebné subsety pro všechny jazyky.
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
    root.style.setProperty('--brand-cta', c.ctaBackground);
    $('#brandName').textContent = state.brand.name || 'Brand';
    // ukázka barev
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
      (state.brand.fonts.heading.family.split(',')[0].replace(/['"]/g, '')) +
      ' / ' +
      (state.brand.fonts.body.family.split(',')[0].replace(/['"]/g, ''));
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
    renderBanner(ctx, format, specFor(lang), state.brand, img);
    return canvas;
  }

  // ---------- UI: sestavení ovládacích prvků ----------
  function buildFormatSelect() {
    const sel = $('#formatSelect');
    sel.innerHTML = '';
    FORMATS.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = `${f.id} — ${f.label}`;
      sel.appendChild(opt);
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
    FORMATS.forEach((f) => {
      const label = document.createElement('label');
      label.className = 'chk';
      label.innerHTML = `<input type="checkbox" value="${f.id}" checked> ${f.id}`;
      fWrap.appendChild(label);
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

  async function renderPreview() {
    // hlavní náhled
    const format = formatById(state.activeFormat);
    const mainCanvas = $('#mainPreview');
    mainCanvas.width = format.width;
    mainCanvas.height = format.height;
    const ctx = mainCanvas.getContext('2d');
    const img = await loadImage(currentImageDataURL());
    renderBanner(ctx, format, specFor(state.activeLang), state.brand, img);
    $('#previewMeta').textContent =
      `${format.id} · ${format.label} · ${state.activeLang} · ${state.version.toUpperCase()}`;

    // galerie všech formátů (aktivní jazyk)
    renderGallery(img);
    saveAutosave();
  }

  async function renderGallery(img) {
    const gallery = $('#gallery');
    gallery.innerHTML = '';
    for (const f of FORMATS) {
      const cell = document.createElement('div');
      cell.className = 'gallery-cell' + (f.id === state.activeFormat ? ' active' : '');
      const canvas = document.createElement('canvas');
      canvas.width = f.width;
      canvas.height = f.height;
      const ctx = canvas.getContext('2d');
      renderBanner(ctx, f, specFor(state.activeLang), state.brand, img);
      // omez zobrazenou velikost
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

  function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  async function exportCurrentPNG() {
    const canvas = await renderToCanvas(state.activeFormat, state.activeLang, state.version);
    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, `${state.activeFormat}_${state.activeLang}_${state.version}.png`);
  }

  async function exportBatchZip() {
    const formats = $$('#exportFormats input:checked').map((i) => i.value);
    const langs = $$('#exportLangs input:checked').map((i) => i.value);
    const versionSel = $('#exportVersion').value; // 'current' | 'safe' | 'full' | 'both'
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
    for (const version of versions) {
      for (const fmt of formats) {
        for (const lang of langs) {
          const canvas = await renderToCanvas(fmt, lang, version);
          const blob = await canvasToBlob(canvas);
          const buf = new Uint8Array(await blob.arrayBuffer());
          const folder = versions.length > 1 ? `${version}/${fmt}` : fmt;
          zip.addFile(`${folder}/${fmt}_${lang}.png`, buf);
          done++;
          setStatus(`Generuji… ${done}/${total}`);
        }
      }
    }
    const zipBlob = zip.toBlob();
    const brandSlug = (state.brand.name || 'brand').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadBlob(zipBlob, `banners_${brandSlug}.zip`);
    setStatus(`Hotovo — ${total} bannerů zabaleno do ZIP.`);
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
      v: 1,
      activeFormat: state.activeFormat,
      activeLang: state.activeLang,
      template: state.template,
      version: state.version,
      images: state.images,
      texts: state.texts,
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
    // sync UI
    $('#formatSelect').value = state.activeFormat;
    $('#templateSelect').value = state.template;
    $('#templateDesc').textContent = TEMPLATES.find((t) => t.id === state.template).description;
    $$('input[name="version"]').forEach((r) => (r.checked = r.value === state.version));
    updateImageThumbs();
    buildLangTabs();
    syncTextInputs();
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
    updateImageThumbs();
    wireEvents();
    refreshProjectList();

    // obnovit autosave, pokud existuje
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
