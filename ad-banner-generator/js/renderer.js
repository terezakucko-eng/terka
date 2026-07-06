/*
 * Vykreslení jednoho banneru na canvas.
 * Stejná funkce se používá pro živý náhled i pro PNG export,
 * takže náhled = výsledek.
 *
 * renderBanner vrací "layout" — pozice prvků (headline, subline, cta) a oblast
 * obrázku v pixelech banneru. Editor to používá pro chytání prvků myší.
 */
(function (global) {
  'use strict';

  // ---------- pomocné funkce ----------

  function orientationOf(format) {
    const ratio = format.width / format.height;
    if (ratio >= 2.5) return 'horizontal';
    if (ratio <= 0.75) return 'vertical';
    return 'square';
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function wrapText(ctx, text, maxWidth) {
    // Respektuj ruční zalomení (Enter = \n), pak zalamuj po slovech.
    const paragraphs = String(text || '').split('\n');
    const lines = [];
    for (const para of paragraphs) {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) {
        lines.push('');
        continue;
      }
      let current = words[0];
      for (let i = 1; i < words.length; i++) {
        const test = current + ' ' + words[i];
        if (ctx.measureText(test).width <= maxWidth) {
          current = test;
        } else {
          lines.push(current);
          current = words[i];
        }
      }
      lines.push(current);
    }
    return lines;
  }

  function fitText(ctx, text, opts) {
    const { fontFamily, fontWeight, maxWidth, maxHeight, maxLines, maxSize, minSize } = opts;
    const lh = opts.lineHeight || 1.15;
    for (let size = maxSize; size >= minSize; size -= 1) {
      ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
      const lines = wrapText(ctx, text, maxWidth);
      const lineHeight = size * lh;
      if (lines.length <= maxLines && lines.length * lineHeight <= maxHeight) {
        return { fontSize: size, lines: lines, lineHeight: lineHeight };
      }
    }
    ctx.font = `${fontWeight} ${minSize}px ${fontFamily}`;
    let lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
    if (lines.length === maxLines) {
      lines[lines.length - 1] = lines[lines.length - 1] + '…';
    }
    return { fontSize: minSize, lines: lines, lineHeight: minSize * lh };
  }

  // Vykreslí řádky se zarovnáním (left/center/right) v pásu [boxLeft, boxLeft+boxW].
  function drawLines(ctx, lines, boxLeft, y, lineHeight, align, boxW) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let cy = y, minL = Infinity, maxR = -Infinity;
    for (const line of lines) {
      const lw = ctx.measureText(line).width;
      let lx = boxLeft;
      if (align === 'center') lx = boxLeft + (boxW - lw) / 2;
      else if (align === 'right') lx = boxLeft + (boxW - lw);
      ctx.fillText(line, lx, cy);
      minL = Math.min(minL, lx);
      maxR = Math.max(maxR, lx + lw);
      cy += lineHeight;
    }
    return { left: minL, right: maxR, width: maxR - minL, bottom: cy };
  }

  function styleFor(styles, el) {
    const s = (styles && styles[el]) || {};
    return { size: s.size || 1, lineHeight: s.lineHeight || (el === 'headline' ? 1.15 : 1.3), align: s.align || 'left' };
  }

  // ---------- rich text (část textu jinou velikostí/barvou přes *...*) ----------
  var richCfg = { color: '#DC004E', scale: 1.35 };

  // Zvýrazněný úsek: *slovo* (výchozí barva/velikost) nebo s vlastními parametry
  // *[1.5,#00A000]slovo* — každé slovo tak může mít NEZÁVISLE svou velikost a barvu.
  function parseRunAttrs(seg) {
    const m = seg.match(/^\[([^\]]*)\]/);
    let scale = null, color = null, text = seg;
    if (m) {
      text = seg.slice(m[0].length);
      m[1].split(',').forEach((p) => {
        p = p.trim();
        if (!p) return;
        if (p[0] === '#') color = p;
        else if (!isNaN(parseFloat(p))) scale = parseFloat(p);
      });
    }
    return { scale: scale, color: color, text: text };
  }

  function richTokens(text) {
    const s = String(text || '');
    const segs = s.split('*');
    const items = [];
    segs.forEach((seg, idx) => {
      const hl = idx % 2 === 1; // liché úseky = mezi hvězdičkami
      let scale = null, color = null, body = seg;
      if (hl) {
        const a = parseRunAttrs(seg);
        scale = a.scale; color = a.color; body = a.text;
      }
      body.split('\n').forEach((line, li) => {
        if (li > 0) items.push({ br: true });
        line.split(/\s+/).forEach((w) => { if (w) items.push({ word: w, hl: hl, scale: scale, color: color }); });
      });
    });
    return items;
  }

  function richHasMarkup(text) {
    return String(text || '').indexOf('*') !== -1;
  }

  function layoutRichAt(ctx, items, family, weight, base, defScale, maxWidth, lh) {
    // velikost slova: zvýrazněné má vlastní scale (nebo výchozí defScale)
    const sizeOf = (it) => (it.hl ? Math.max(6, Math.round(base * (it.scale || defScale || 1))) : base);
    const lines = [];
    let cur = { words: [], width: 0, maxSize: 0 };
    const flush = () => { lines.push(cur); cur = { words: [], width: 0, maxSize: 0 }; };
    for (const it of items) {
      if (it.br) { flush(); continue; }
      const size = sizeOf(it);
      ctx.font = `${weight} ${size}px ${family}`;
      const w = ctx.measureText(it.word).width;
      const spW = ctx.measureText(' ').width;
      const sp = cur.words.length ? spW : 0;
      if (cur.words.length && cur.width + sp + w > maxWidth) flush();
      const sp2 = cur.words.length ? spW : 0;
      cur.words.push({ word: it.word, hl: it.hl, color: it.color || null, x: cur.width + sp2, w: w, size: size });
      cur.width += sp2 + w;
      cur.maxSize = Math.max(cur.maxSize, size);
    }
    if (cur.words.length || lines.length === 0) flush();
    let totalH = 0, maxLineW = 0;
    lines.forEach((l) => { l.lineH = l.maxSize * lh; totalH += l.lineH; maxLineW = Math.max(maxLineW, l.width); });
    return { lines: lines, height: totalH, width: maxLineW, base: base };
  }

  // Náhrada fitText pro rich text — vrací kompatibilní objekt s .lines a rozměry.
  function fitRich(ctx, text, o) {
    const items = richTokens(text);
    const lh = o.lineHeight || 1.15;
    for (let base = o.maxSize; base >= o.minSize; base--) {
      const r = layoutRichAt(ctx, items, o.fontFamily, o.fontWeight, base, o.hlScale, o.maxWidth, lh);
      if (r.lines.length <= o.maxLines && r.height <= o.maxHeight && r.width <= o.maxWidth) {
        return r;
      }
    }
    return layoutRichAt(ctx, items, o.fontFamily, o.fontWeight, o.minSize, o.hlScale, o.maxWidth, lh);
  }

  function drawRich(ctx, r, boxLeft, y, boxW, align, weight, family, color, hlColor) {
    let cy = y, minL = Infinity, maxR = -Infinity;
    for (const l of r.lines) {
      let sx = boxLeft;
      if (align === 'center') sx = boxLeft + (boxW - l.width) / 2;
      else if (align === 'right') sx = boxLeft + (boxW - l.width);
      const baseline = cy + l.maxSize * 0.8;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      for (const w of l.words) {
        ctx.font = `${weight} ${w.size}px ${family}`;
        ctx.fillStyle = w.hl ? (w.color || hlColor) : color;
        ctx.fillText(w.word, sx + w.x, baseline);
        minL = Math.min(minL, sx + w.x);
        maxR = Math.max(maxR, sx + w.x + w.w);
      }
      cy += l.lineH;
    }
    if (!isFinite(minL)) { minL = boxLeft; maxR = boxLeft; }
    return { left: minL, right: maxR, width: maxR - minL, bottom: cy };
  }

  // Změř textový prvek (rich pokud obsahuje *…*, jinak plain) BEZ vykreslení.
  // Vrací { rich, data, height, lineCount } — layout nejdřív měří, pak kreslí.
  function measureTextEl(ctx, text, o) {
    if (richHasMarkup(text)) {
      const r = fitRich(ctx, text, {
        fontFamily: o.fontFamily, fontWeight: o.fontWeight, maxWidth: o.maxWidth,
        maxHeight: o.maxHeight, maxLines: o.maxLines, maxSize: o.maxSize,
        minSize: o.minSize, lineHeight: o.lineHeight, hlScale: richCfg.scale,
      });
      return { rich: true, data: r, height: r.height, lineCount: r.lines.length };
    }
    const fit = fitText(ctx, text, {
      fontFamily: o.fontFamily, fontWeight: o.fontWeight, maxWidth: o.maxWidth,
      maxHeight: o.maxHeight, maxLines: o.maxLines, maxSize: o.maxSize,
      minSize: o.minSize, lineHeight: o.lineHeight,
    });
    return { rich: false, data: fit, height: fit.lines.length * fit.lineHeight, lineCount: fit.lines.length };
  }

  // Vykresli změřený prvek na pozici y v pásu [boxLeft, boxLeft+boxW].
  // Vrací { box:{x,y,w,h}, bottom }.
  function paintTextEl(ctx, m, boxLeft, y, boxW, align, weight, family, color) {
    if (m.rich) {
      const d = drawRich(ctx, m.data, boxLeft, y, boxW, align, weight, family, color, richCfg.color);
      return { box: { x: d.left, y: y, w: d.width, h: m.height }, bottom: d.bottom };
    }
    ctx.fillStyle = color;
    ctx.font = `${weight} ${m.data.fontSize}px ${family}`;
    const d = drawLines(ctx, m.data.lines, boxLeft, y, m.data.lineHeight, align, boxW);
    return { box: { x: d.left, y: y, w: d.width, h: m.height }, bottom: d.bottom };
  }

  // Nakreslí obrázek "cover" do obdélníku s transformací.
  // t = { scale, offsetX -1..1, offsetY -1..1, focusX 0..1, focusY 0..1 }
  // focus = "těžiště" (hlavní motiv) — drží se v záběru napříč rozměry (master).
  function drawImageTransformed(ctx, img, rx, ry, rw, rh, t) {
    t = t || {};
    const scale = Math.max(rw / img.width, rh / img.height) * (t.scale || 1);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const slackX = dw - rw;
    const slackY = dh - rh;
    const fx = t.focusX == null ? 0.5 : t.focusX;
    const fy = t.focusY == null ? 0.45 : t.focusY;
    const ox = Math.max(-1, Math.min(1, t.offsetX || 0));
    const oy = Math.max(-1, Math.min(1, t.offsetY || 0));
    // umísti tak, aby těžiště obrázku bylo ve středu rámu, pak jemný pan
    let dx = rx + rw / 2 - fx * dw + (ox * slackX) / 2;
    let dy = ry + rh / 2 - fy * dh + (oy * slackY) / 2;
    // pokud obrázek rám pokrývá, drž ho v mezích (bez prázdných okrajů)
    if (slackX >= 0) dx = Math.min(rx, Math.max(rx + rw - dw, dx));
    if (slackY >= 0) dy = Math.min(ry, Math.max(ry + rh - dh, dy));
    ctx.save();
    ctx.beginPath();
    ctx.rect(rx, ry, rw, rh);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  function linearGradient(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((s) => g.addColorStop(s[0], s[1]));
    return g;
  }

  // ---------- barevné pomůcky ----------
  function parseColor(col) {
    if (Array.isArray(col)) return col;
    if (typeof col !== 'string') return [0, 0, 0];
    if (col[0] === '#') {
      let h = col.slice(1);
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    const m = col.match(/(\d+(\.\d+)?)/g);
    return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
  }
  function relLum(col) {
    const [r, g, b] = parseColor(col).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrastRatio(a, b) {
    const la = relLum(a), lb = relLum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  // Logo dle manuálu: bílá (tmavé pozadí), jinak růžová (primární) pokud má
  // dost kontrastu, jinak černá.
  function pickLogoColor(bg, brand) {
    const white = '#FFFFFF';
    const black = '#141414';
    const pink = brand.colors.primary;
    if (relLum(bg) < 0.42) return white;
    return contrastRatio(pink, bg) >= 2.4 ? pink : black;
  }
  function rgbaStr(col, a) {
    const [r, g, b] = parseColor(col);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  // Ztmaví barvu o daný podíl (0..1) — pro čitelný podklad pod bílým textem.
  function darken(col, t) {
    const [r, g, b] = parseColor(col);
    const f = 1 - t;
    return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
  }
  // Dotónuje světlé pozadí panelu k průměrné barvě vizuálu (čitelný pastel).
  function tintPanel(avg, brand) {
    if (!avg) return brand.colors.surface;
    const mix = (a, b, t) => Math.round(a + (b - a) * t);
    const r = mix(avg[0], 255, 0.8);
    const g = mix(avg[1], 255, 0.8);
    const b = mix(avg[2], 255, 0.8);
    return `rgb(${r}, ${g}, ${b})`;
  }

  // ---------- CTA ----------
  function ctaMetrics(ctx, spec, brand, scale, ts, sizeMult, maxW) {
    const text = (spec.cta || '').trim();
    if (!text) return null;
    const fam = brand.fonts.heading.family;
    const arrow = !!spec.ctaArrow;
    const compute = (fs) => {
      ctx.font = `600 ${fs}px ${fam}`;
      const textW = ctx.measureText(text).width;
      const padX = Math.round(fs * 1.1);
      const padY = Math.round(fs * 0.6);
      const gap = arrow ? fs * 0.5 : 0;
      const arrowW = arrow ? fs * 0.55 : 0;
      const contentW = textW + gap + arrowW;
      return { text, fontSize: fs, padX, padY, textW, gap, arrow, arrowW, contentW, w: contentW + padX * 2, h: fs + padY * 2 };
    };
    let m = compute(Math.max(9, Math.round(13 * scale * (ts || 1) * (sizeMult || 1))));
    // u úzkých rozměrů zmenši CTA tak, aby se vešlo na šířku (min 8 px)
    if (maxW) {
      while (m.fontSize > 8 && m.w > maxW) m = compute(m.fontSize - 1);
    }
    return m;
  }

  function drawCTAAt(ctx, m, brand, ctaColor, x, y) {
    roundRect(ctx, x, y, m.w, m.h, m.h / 2);
    ctx.fillStyle = ctaColor || brand.colors.ctaBackground;
    ctx.fill();
    const cy = y + m.h / 2;
    const contentLeft = x + m.w / 2 - m.contentW / 2;
    ctx.fillStyle = brand.colors.ctaText;
    ctx.font = `600 ${m.fontSize}px ${brand.fonts.heading.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.text, contentLeft, cy + 1);
    if (m.arrow) {
      // plný trojúhelník ▸ (jako v referenci CHCI SLEVU ▸)
      const ax = contentLeft + m.textW + m.gap;
      const s = m.fontSize * 0.34;
      ctx.fillStyle = brand.colors.ctaText;
      ctx.beginPath();
      ctx.moveTo(ax, cy - s);
      ctx.lineTo(ax + s * 0.95, cy);
      ctx.lineTo(ax, cy + s);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Odznak "pusinka" — PŘESNÝ vektor z brand manuálu (Path2D z SVG).
  // Tvar: rovné diagonální strany od špiček + zakřivený vrchol a spodek.
  var PUSINKA_PATH =
    'M 2.339844 749.761719 L 419.996094 1129.507812 C 602.582031 1295.527344 898.613281 1295.527344 1081.210938 1129.507812 L 1498.859375 749.742188 L 1081.1875 369.992188 C 898.597656 203.96875 602.558594 203.96875 419.976562 369.992188 Z';
  var PUSINKA_BBOX = { x: 2.339844, y: 245.457031, w: 1496.519531, h: 1008.746094 };
  var PUSINKA_ASPECT = PUSINKA_BBOX.w / PUSINKA_BBOX.h; // ~1,484
  var _pusinkaPath2D = null;
  function pusinkaShape() {
    if (!_pusinkaPath2D && typeof Path2D !== 'undefined') _pusinkaPath2D = new Path2D(PUSINKA_PATH);
    return _pusinkaPath2D;
  }

  // sizeMult zvětšuje/zmenšuje celý odznak; text vyplňuje pusinku výrazně,
  // procenta jsou menší a blíž k číslu. Zachovává poměr stran pusinky.
  function badgeMetrics(ctx, text, brand, scale, sizeMult) {
    const t = String(text || '').trim();
    if (!t) return null;
    const fam = brand.fonts.heading.family;
    const fontSize = Math.max(12, Math.round(20 * scale * (sizeMult || 1)));
    const m = t.match(/^(.*?)(?:\s*)(%)\s*$/);
    let parts = null;
    let totalW;
    if (m && m[1].trim()) {
      const numPart = m[1].trim();
      const pctSize = Math.round(fontSize * 0.62);
      ctx.font = `800 ${fontSize}px ${fam}`;
      const numW = ctx.measureText(numPart).width;
      ctx.font = `800 ${pctSize}px ${fam}`;
      const pctW = ctx.measureText('%').width;
      const gap = fontSize * 0.05;
      totalW = numW + gap + pctW;
      parts = { numPart, numW, pctW, pctSize, gap };
    } else {
      ctx.font = `800 ${fontSize}px ${fam}`;
      totalW = ctx.measureText(t).width;
    }
    let halfW = totalW / 2 + fontSize * 0.7;
    let halfH = halfW / PUSINKA_ASPECT;
    const minHalfH = fontSize * 0.82;
    if (halfH < minHalfH) {
      halfH = minHalfH;
      halfW = halfH * PUSINKA_ASPECT;
    }
    return { text: t, fontSize, halfW, halfH, parts };
  }

  function drawBadgeAt(ctx, m, brand, color, cx, cy, textColor) {
    const shape = pusinkaShape();
    const b = PUSINKA_BBOX;
    ctx.save();
    ctx.translate(cx - m.halfW, cy - m.halfH);
    ctx.scale((2 * m.halfW) / b.w, (2 * m.halfH) / b.h);
    ctx.translate(-b.x, -b.y);
    ctx.fillStyle = color || brand.colors.primary;
    if (shape) ctx.fill(shape);
    ctx.restore();

    const fam = brand.fonts.heading.family;
    ctx.fillStyle = textColor || '#FFFFFF';
    ctx.textBaseline = 'middle';
    if (m.parts) {
      const p = m.parts;
      const totalW = p.numW + p.gap + p.pctW;
      let x = cx - totalW / 2;
      ctx.textAlign = 'left';
      ctx.font = `800 ${m.fontSize}px ${fam}`;
      ctx.fillText(p.numPart, x, cy + 1);
      x += p.numW + p.gap;
      ctx.font = `800 ${p.pctSize}px ${fam}`;
      ctx.fillText('%', x, cy + 1);
    } else {
      ctx.textAlign = 'center';
      ctx.font = `800 ${m.fontSize}px ${fam}`;
      ctx.fillText(m.text, cx, cy + 1);
    }
  }

  function drawLogo(ctx, brand, x, y, scale, color, logoText, logoScale) {
    const text = logoText || brand.logoText || brand.name || '';
    if (!text) return null;
    const fontSize = Math.max(9, Math.round(12 * scale * (logoScale || 1)));
    ctx.font = `700 ${fontSize}px ${brand.fonts.heading.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    return { x: x, y: y, w: ctx.measureText(text).width, h: fontSize };
  }

  // ---------- barvy textu ----------
  function resolveTextColors(mode, bgDefault, brand) {
    if (mode === 'light') return { text: '#FFFFFF', muted: 'rgba(255,255,255,0.9)' };
    if (mode === 'dark') return { text: brand.colors.text, muted: brand.colors.textMuted };
    return bgDefault; // auto
  }

  // ---------- pozadí (dle šablony) ----------
  function drawBackground(ctx, format, spec, brand, image, orient, scale, pad, imgT, opts) {
    const W = format.width;
    const H = format.height;
    const c = brand.colors;
    const avg = opts && opts.imageAvg;
    const transparent = opts && opts.transparent;

    // Bez pozadí (kategorie, rozcestník) — jen vizuál (celý, „contain"), zbytek
    // průhledný, aby banner splynul se stránkou. Text/odznak/logo se vykreslí přes.
    if (transparent) {
      let imageRect = { x: 0, y: 0, w: W, h: H };
      if (image) {
        const s = Math.min(W / image.width, H / image.height) * (imgT.scale || 1);
        const dw = image.width * s, dh = image.height * s;
        const dx = (W - dw) / 2 + (imgT.offsetX || 0) * (W / 2);
        const dy = (H - dh) / 2 + (imgT.offsetY || 0) * (H / 2);
        ctx.drawImage(image, dx, dy, dw, dh);
        imageRect = { x: dx, y: dy, w: dw, h: dh };
      }
      return {
        region: { x: 0, y: 0, w: W, h: H },
        colors: { text: c.text, muted: c.textMuted },
        imageRect: imageRect,
        logoColor: pickLogoColor('#FFFFFF', brand),
        logoAnchor: { x: pad, y: pad },
      };
    }

    ctx.fillStyle = c.background;
    ctx.fillRect(0, 0, W, H);

    const template = spec.template || 'overlay';

    if (template === 'minimal' || !image) {
      ctx.fillStyle = linearGradient(ctx, 0, 0, W, H, [
        [0, c.primary],
        [1, c.secondary],
      ]);
      ctx.fillRect(0, 0, W, H);
      return {
        region: { x: 0, y: 0, w: W, h: H },
        colors: { text: '#FFFFFF', muted: 'rgba(255,255,255,0.85)' },
        imageRect: null,
        logoColor: pickLogoColor(c.primary, brand),
        logoAnchor: { x: pad, y: pad },
      };
    }

    if (template === 'overlay') {
      drawImageTransformed(ctx, image, 0, 0, W, H, imgT);
      if (orient === 'horizontal') {
        ctx.fillStyle = linearGradient(ctx, 0, 0, W, 0, [
          [0, 'rgba(0,0,0,0.72)'],
          [0.6, 'rgba(0,0,0,0.35)'],
          [1, 'rgba(0,0,0,0.0)'],
        ]);
      } else {
        ctx.fillStyle = linearGradient(ctx, 0, H, 0, 0, [
          [0, 'rgba(0,0,0,0.78)'],
          [0.55, 'rgba(0,0,0,0.35)'],
          [1, 'rgba(0,0,0,0.0)'],
        ]);
      }
      ctx.fillRect(0, 0, W, H);
      return {
        region: { x: 0, y: 0, w: W, h: H },
        colors: { text: '#FFFFFF', muted: 'rgba(255,255,255,0.9)' },
        imageRect: { x: 0, y: 0, w: W, h: H },
        logoColor: pickLogoColor(avg || c.secondary, brand),
        logoAnchor: { x: pad, y: pad },
        valign: 'bottom',
      };
    }

    if (template === 'classic') {
      let imageRect, region;
      if (orient === 'vertical') {
        const imgH = Math.round(H * 0.5);
        imageRect = { x: 0, y: 0, w: W, h: imgH };
        region = { x: 0, y: imgH, w: W, h: H - imgH };
      } else if (orient === 'horizontal') {
        const imgW = Math.round(W * 0.34);
        imageRect = { x: 0, y: 0, w: imgW, h: H };
        region = { x: imgW, y: 0, w: W - imgW, h: H };
      } else {
        const imgH = Math.round(H * 0.52);
        imageRect = { x: 0, y: 0, w: W, h: imgH };
        region = { x: 0, y: imgH, w: W, h: H - imgH };
      }
      drawImageTransformed(ctx, image, imageRect.x, imageRect.y, imageRect.w, imageRect.h, imgT);
      // panel dotónovaný k vizuálu (světlý pastel), text tmavý
      const panel = tintPanel(avg, brand);
      ctx.fillStyle = panel;
      ctx.fillRect(region.x, region.y, region.w, region.h);
      return {
        region: region,
        colors: { text: c.text, muted: c.textMuted },
        imageRect: imageRect,
        logoColor: pickLogoColor(panel, brand),
        logoAnchor: { x: region.x + pad, y: region.y + pad }, // logo NA panelu
      };
    }

    // split — textový panel je graficky odvozený z použitého vizuálu:
    // do panelu se vloží samotný obrázek a překryje se značkovým přechodem
    // (růžová → tón vizuálu), takže panel drží barevně pohromadě s fotkou.
    let imageRect, region, gv;
    if (orient === 'vertical') {
      const textH = Math.round(H * 0.5);
      imageRect = { x: 0, y: textH, w: W, h: H - textH };
      region = { x: 0, y: 0, w: W, h: textH };
      gv = true;
    } else {
      const textW = Math.round(W * (orient === 'horizontal' ? 0.5 : 0.55));
      imageRect = { x: textW, y: 0, w: W - textW, h: H };
      region = { x: 0, y: 0, w: textW, h: H };
      gv = false;
    }
    // hlavní vizuál
    drawImageTransformed(ctx, image, imageRect.x, imageRect.y, imageRect.w, imageRect.h, imgT);
    // textový panel: stejný vizuál jako podklad + značkový přechod přes něj
    ctx.save();
    ctx.beginPath();
    ctx.rect(region.x, region.y, region.w, region.h);
    ctx.clip();
    drawImageTransformed(ctx, image, region.x, region.y, region.w, region.h, imgT);
    const panelTone = avg ? darken(avg, 0.5) : c.secondary;
    const gx1 = gv ? region.x : region.x;
    const gy1 = gv ? region.y : region.y;
    const gx2 = gv ? region.x : region.x + region.w;
    const gy2 = gv ? region.y + region.h : region.y;
    ctx.fillStyle = linearGradient(ctx, gx1, gy1, gx2, gy2, [
      [0, rgbaStr(c.primary, 0.9)],
      [1, rgbaStr(panelTone, 0.94)],
    ]);
    ctx.fillRect(region.x, region.y, region.w, region.h);
    ctx.restore();
    return {
      region: region,
      colors: { text: '#FFFFFF', muted: 'rgba(255,255,255,0.85)' },
      imageRect: imageRect,
      logoColor: pickLogoColor(c.primary, brand),
      logoAnchor: { x: region.x + pad, y: region.y + pad },
    };
  }

  // ---------- automatické rozvržení textů (v oblasti) ----------
  function layoutTextsAuto(ctx, format, spec, brand, colors, ctaColor, region, orient, scale, pad, valign, ts, styles) {
    if (orient === 'horizontal') {
      return layoutHorizontal(ctx, format, spec, brand, colors, ctaColor, region, scale, pad, ts, styles);
    }
    return layoutStacked(ctx, format, spec, brand, colors, ctaColor, region, scale, pad, valign, ts, styles);
  }

  function layoutStacked(ctx, format, spec, brand, colors, ctaColor, region, scale, pad, valign, ts, styles) {
    const innerX = region.x + pad;
    const maxWidth = region.w - pad * 2;
    const hFont = brand.fonts.heading;
    const bFont = brand.fonts.body;
    const boxes = {};
    const hs = styleFor(styles, 'headline');
    const ss = styleFor(styles, 'subline');
    const cs = styleFor(styles, 'cta');
    const hst = scale * (ts || 1) * hs.size;
    const sst = scale * (ts || 1) * ss.size;

    const headline = measureTextEl(ctx, spec.headline, {
      fontFamily: hFont.family, fontWeight: hFont.weight || 700,
      maxWidth: maxWidth, maxHeight: region.h * 0.85,
      maxLines: region.h > 300 ? 5 : 3,
      maxSize: Math.round(28 * hst), minSize: Math.max(9, Math.round(13 * hst)),
      lineHeight: hs.lineHeight,
    });
    const subline = spec.subline && spec.subline.trim()
      ? measureTextEl(ctx, spec.subline, {
          fontFamily: bFont.family, fontWeight: bFont.weight || 400,
          maxWidth: maxWidth, maxHeight: region.h * 0.55,
          maxLines: region.h > 300 ? 5 : 3,
          maxSize: Math.round(15 * sst), minSize: Math.max(8, Math.round(11 * sst)),
          lineHeight: ss.lineHeight,
        })
      : null;

    const gap = Math.round(6 * scale);
    const cta = ctaMetrics(ctx, spec, brand, scale, ts, cs.size, maxWidth);
    const headlineH = headline.height;
    const sublineH = subline ? subline.height : 0;
    const totalH = headlineH + (subline ? gap + sublineH : 0) + (cta ? gap * 1.6 + cta.h : 0);

    let y;
    if (valign === 'bottom') {
      y = region.y + region.h - pad - totalH;
    } else {
      const topSpace = region.y === 0 ? pad + 18 * scale : pad;
      const avail = region.h - topSpace - pad;
      y = region.y + topSpace + Math.max(0, (avail - totalH) / 2);
    }

    let r = paintTextEl(ctx, headline, innerX, y, maxWidth, hs.align, hFont.weight || 700, hFont.family, colors.text);
    boxes.headline = { x: r.box.x, y: y, w: r.box.w, h: headlineH };
    y = r.bottom;

    if (subline) {
      y += gap;
      r = paintTextEl(ctx, subline, innerX, y, maxWidth, ss.align, bFont.weight || 400, bFont.family, colors.muted);
      boxes.subline = { x: r.box.x, y: y, w: r.box.w, h: sublineH };
      y = r.bottom;
    }

    if (cta) {
      y += gap * 1.6;
      let cx = innerX;
      if (cs.align === 'center') cx = innerX + (maxWidth - cta.w) / 2;
      else if (cs.align === 'right') cx = innerX + (maxWidth - cta.w);
      drawCTAAt(ctx, cta, brand, ctaColor, cx, y);
      boxes.cta = { x: cx, y: y, w: cta.w, h: cta.h };
    }
    return boxes;
  }

  function layoutHorizontal(ctx, format, spec, brand, colors, ctaColor, region, scale, pad, ts, styles) {
    const hFont = brand.fonts.heading;
    const bFont = brand.fonts.body;
    const boxes = {};
    const hs = styleFor(styles, 'headline');
    const ss = styleFor(styles, 'subline');
    const cs = styleFor(styles, 'cta');
    const hst = scale * (ts || 1) * hs.size;
    const sst = scale * (ts || 1) * ss.size;
    const cta = ctaMetrics(ctx, spec, brand, scale, ts, cs.size, Math.max(40, region.w - pad * 2));
    const ctaW = cta ? cta.w + pad : 0;

    const textX = region.x + pad;
    const textMaxW = region.w - pad * 2 - ctaW;

    const headline = measureTextEl(ctx, spec.headline, {
      fontFamily: hFont.family, fontWeight: hFont.weight || 700,
      maxWidth: textMaxW, maxHeight: region.h * 0.85,
      maxLines: region.h < 110 ? 2 : 3,
      maxSize: Math.round(Math.min(region.h * 0.5 * (ts || 1) * hs.size, 24 * hst)),
      minSize: Math.max(9, Math.round(12 * hst)),
      lineHeight: hs.lineHeight,
    });
    const showSub = spec.subline && spec.subline.trim() && region.h >= 90;
    const subline = showSub
      ? measureTextEl(ctx, spec.subline, {
          fontFamily: bFont.family, fontWeight: bFont.weight || 400,
          maxWidth: textMaxW, maxHeight: region.h * 0.45, maxLines: 2,
          maxSize: Math.round(Math.min(region.h * 0.3 * (ts || 1) * ss.size, 14 * sst)),
          minSize: Math.max(8, Math.round(10 * sst)),
          lineHeight: ss.lineHeight,
        })
      : null;

    const gap = Math.round(3 * scale);
    const headlineH = headline.height;
    const sublineH = subline ? subline.height : 0;
    const totalH = headlineH + (subline ? gap + sublineH : 0);
    let y = region.y + (region.h - totalH) / 2;

    let r = paintTextEl(ctx, headline, textX, y, textMaxW, hs.align, hFont.weight || 700, hFont.family, colors.text);
    boxes.headline = { x: r.box.x, y: y, w: r.box.w, h: headlineH };
    y = r.bottom;

    if (subline) {
      y += gap;
      r = paintTextEl(ctx, subline, textX, y, textMaxW, ss.align, bFont.weight || 400, bFont.family, colors.muted);
      boxes.subline = { x: r.box.x, y: y, w: r.box.w, h: sublineH };
    }

    if (cta) {
      const cy = region.y + (region.h - cta.h) / 2;
      const cx = region.x + region.w - pad - cta.w;
      drawCTAAt(ctx, cta, brand, ctaColor, cx, cy);
      boxes.cta = { x: cx, y: cy, w: cta.w, h: cta.h };
    }
    return boxes;
  }

  // ---------- ruční rozvržení textů (volné pozice) ----------
  function layoutTextsManual(ctx, format, spec, brand, colors, ctaColor, ov, scale, pad, ts, styles, region) {
    const W = format.width;
    const H = format.height;
    const hFont = brand.fonts.heading;
    const bFont = brand.fonts.body;
    const boxes = {};
    const reg = region || { x: 0, y: 0, w: W, h: H };
    const regLeft = reg.x + pad;
    const regRight = reg.x + reg.w - pad;

    // Zarovnání se počítá vůči TEXTOVÉ OBLASTI (u panelu = panel), aby všechny
    // vycentrované prvky ladily na střed (jako vodicí lišta). anchorX řídí jen
    // levý (left) nebo pravý (right) okraj.
    function bandFor(align, anchorX) {
      if (align === 'center') return { boxLeft: regLeft, boxW: Math.max(20, regRight - regLeft) };
      if (align === 'right') return { boxLeft: regLeft, boxW: Math.max(20, anchorX - regLeft) };
      return { boxLeft: anchorX, boxW: Math.max(20, regRight - anchorX) };
    }

    function place(el, isHeadline) {
      const o = ov[el];
      if (!o) return;
      const s = styleFor(styles, el);
      const est = scale * (ts || 1) * s.size;
      const anchorX = o.x * W;
      const anchorY = o.y * H;
      const band = bandFor(s.align, anchorX);
      const font = isHeadline ? hFont : bFont;
      const weight = font.weight || (isHeadline ? 700 : 400);
      const m = measureTextEl(ctx, spec[el], {
        fontFamily: font.family,
        fontWeight: weight,
        maxWidth: band.boxW,
        maxHeight: H,
        maxLines: 6,
        maxSize: isHeadline ? Math.round(30 * est) : Math.round(15 * est),
        minSize: isHeadline ? Math.max(9, Math.round(13 * est)) : Math.max(8, Math.round(11 * est)),
        lineHeight: s.lineHeight,
      });
      const r = paintTextEl(ctx, m, band.boxLeft, anchorY, band.boxW, s.align, weight, font.family, isHeadline ? colors.text : colors.muted);
      boxes[el] = { x: r.box.x, y: anchorY, w: r.box.w, h: m.height };
    }

    if (spec.headline && spec.headline.trim()) place('headline', true);
    if (spec.subline && spec.subline.trim()) place('subline', false);

    const cs = styleFor(styles, 'cta');
    const cta = ctaMetrics(ctx, spec, brand, scale, ts, cs.size, Math.max(40, regRight - regLeft));
    if (cta && ov.cta) {
      const anchorX = ov.cta.x * W;
      const cy = ov.cta.y * H;
      let cx;
      if (cs.align === 'center') cx = reg.x + reg.w / 2 - cta.w / 2;
      else if (cs.align === 'right') cx = anchorX - cta.w;
      else cx = anchorX;
      drawCTAAt(ctx, cta, brand, ctaColor, cx, cy);
      boxes.cta = { x: cx, y: cy, w: cta.w, h: cta.h };
    }
    return boxes;
  }

  // ---------- hlavní render ----------
  /**
   * @param {Object} opts { override, ctaColor, textColor }
   *   override = { manual, image:{scale,offsetX,offsetY}, headline:{x,y}, subline:{x,y}, cta:{x,y} }
   * @returns {Object} layout { boxes:{headline,subline,cta}, imageRect, region }
   */
  function renderBanner(ctx, format, spec, brand, image, opts) {
    opts = opts || {};
    // barva/velikost zvýrazněné části textu (*slovo*) — z nastavení uživatele
    richCfg.color = opts.highlightColor || '#DC004E';
    richCfg.scale = opts.highlightScale || 1.35;
    const ov = opts.override || {};
    const imgT = ov.image ? Object.assign({}, ov.image) : { scale: 1, offsetX: 0, offsetY: 0 };
    if (opts.imageFocus) {
      if (imgT.focusX == null) imgT.focusX = opts.imageFocus.x;
      if (imgT.focusY == null) imgT.focusY = opts.imageFocus.y;
    }
    const W = format.width;
    const H = format.height;

    // Master = zdrojový obrázek (bez textu/CTA/odznaku/loga). Ukáže celý vizuál.
    if (format.channel === 'master') {
      ctx.fillStyle = '#e9edf2';
      ctx.fillRect(0, 0, W, H);
      if (image) {
        const s = Math.min(W / image.width, H / image.height);
        const dw = image.width * s;
        const dh = image.height * s;
        ctx.drawImage(image, (W - dw) / 2, (H - dh) / 2, dw, dh);
      } else {
        ctx.fillStyle = '#8a93a0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${Math.round(W * 0.028)}px sans-serif`;
        ctx.fillText('Nahraj master vizuál (2400 × 2400 px)', W / 2, H / 2);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
      return { boxes: {}, imageRect: { x: 0, y: 0, w: W, h: H }, region: { x: 0, y: 0, w: W, h: H }, source: true };
    }

    const orient = orientationOf(format);
    const scale = Math.max(0.7, Math.min(2.2, Math.sqrt((W * H) / (300 * 250))));
    // proporcionální bezpečný okraj (~6 % kratší strany) dle grafických standardů
    const pad = Math.round(Math.max(10, Math.min(W, H) * 0.06));

    const bg = drawBackground(ctx, format, spec, brand, image, orient, scale, pad, imgT, opts);
    const colors = resolveTextColors(opts.textColor, bg.colors, brand);
    const ts = opts.textScale || 1;

    let boxes;
    if (ov.manual) {
      boxes = layoutTextsManual(ctx, format, spec, brand, colors, opts.ctaColor, ov, scale, pad, ts, opts.textStyle, bg.region);
    } else {
      boxes = layoutTextsAuto(
        ctx, format, spec, brand, colors, opts.ctaColor, bg.region, orient, scale, pad, bg.valign, ts, opts.textStyle
      );
    }

    // slevový odznak ("pusinka")
    if (spec.discount && spec.discount.show) {
      const bm = badgeMetrics(ctx, spec.discount.text, brand, scale, spec.discount.size);
      if (bm) {
        const b = ov.badge || { x: 0.8, y: 0.3 };
        const cx = b.x * W;
        const cy = b.y * H;
        drawBadgeAt(ctx, bm, brand, opts.badgeColor, cx, cy, opts.badgeTextColor);
        boxes.badge = { x: cx - bm.halfW, y: cy - bm.halfH, w: bm.halfW * 2, h: bm.halfH * 2 };
      }
    }

    const logoHidden = ov.logoHidden === undefined ? !!opts.logoDefaultHidden : ov.logoHidden;
    if (!logoHidden) {
      const anchor = bg.logoAnchor || { x: pad, y: pad };
      const lx = ov.logo ? ov.logo.x * W : anchor.x;
      const ly = ov.logo ? ov.logo.y * H : anchor.y;
      let logoColor = bg.logoColor || colors.text;
      const mode = opts.logoColorMode;
      if (mode === 'white') logoColor = '#FFFFFF';
      else if (mode === 'black') logoColor = '#141414';
      else if (mode === 'pink') logoColor = brand.colors.primary;
      const lbox = drawLogo(ctx, brand, lx, ly, scale, logoColor, spec.logoText, opts.logoScale);
      if (lbox) boxes.logo = lbox;
    }

    if (!opts.transparent) {
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    }

    return { boxes: boxes, imageRect: bg.imageRect, region: bg.region };
  }

  global.BannerRenderer = { renderBanner: renderBanner, orientationOf: orientationOf };
})(window);
