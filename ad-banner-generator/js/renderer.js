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
  function ctaMetrics(ctx, spec, brand, scale, ts, sizeMult) {
    const text = (spec.cta || '').trim();
    if (!text) return null;
    const fontSize = Math.max(9, Math.round(13 * scale * (ts || 1) * (sizeMult || 1)));
    ctx.font = `600 ${fontSize}px ${brand.fonts.heading.family}`;
    const padX = Math.round(fontSize * 1.1);
    const padY = Math.round(fontSize * 0.6);
    const textW = ctx.measureText(text).width;
    return { text, fontSize, padX, padY, w: textW + padX * 2, h: fontSize + padY * 2 };
  }

  function drawCTAAt(ctx, m, brand, ctaColor, x, y) {
    roundRect(ctx, x, y, m.w, m.h, m.h / 2);
    ctx.fillStyle = ctaColor || brand.colors.ctaBackground;
    ctx.fill();
    ctx.fillStyle = brand.colors.ctaText;
    ctx.font = `600 ${m.fontSize}px ${brand.fonts.heading.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.text, x + m.w / 2, y + m.h / 2 + 1);
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

  function drawBadgeAt(ctx, m, brand, color, cx, cy) {
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
    ctx.fillStyle = '#FFFFFF';
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

  function drawLogo(ctx, brand, x, y, scale, color, logoText) {
    const text = logoText || brand.logoText || brand.name || '';
    if (!text) return null;
    const fontSize = Math.max(9, Math.round(12 * scale));
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

    // split
    let imageRect, region;
    if (orient === 'vertical') {
      const textH = Math.round(H * 0.5);
      ctx.fillStyle = linearGradient(ctx, 0, 0, 0, textH, [
        [0, c.primary],
        [1, c.secondary],
      ]);
      ctx.fillRect(0, 0, W, textH);
      imageRect = { x: 0, y: textH, w: W, h: H - textH };
      region = { x: 0, y: 0, w: W, h: textH };
    } else {
      const textW = Math.round(W * (orient === 'horizontal' ? 0.5 : 0.55));
      ctx.fillStyle = linearGradient(ctx, 0, 0, textW, H, [
        [0, c.primary],
        [1, c.secondary],
      ]);
      ctx.fillRect(0, 0, textW, H);
      imageRect = { x: textW, y: 0, w: W - textW, h: H };
      region = { x: 0, y: 0, w: textW, h: H };
    }
    drawImageTransformed(ctx, image, imageRect.x, imageRect.y, imageRect.w, imageRect.h, imgT);
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

    const headline = fitText(ctx, spec.headline, {
      fontFamily: hFont.family, fontWeight: hFont.weight || 700,
      maxWidth: maxWidth, maxHeight: region.h * 0.85,
      maxLines: region.h > 300 ? 5 : 3,
      maxSize: Math.round(28 * hst), minSize: Math.max(9, Math.round(13 * hst)),
      lineHeight: hs.lineHeight,
    });
    const subline = spec.subline && spec.subline.trim()
      ? fitText(ctx, spec.subline, {
          fontFamily: bFont.family, fontWeight: bFont.weight || 400,
          maxWidth: maxWidth, maxHeight: region.h * 0.55,
          maxLines: region.h > 300 ? 5 : 3,
          maxSize: Math.round(15 * sst), minSize: Math.max(8, Math.round(11 * sst)),
          lineHeight: ss.lineHeight,
        })
      : null;

    const gap = Math.round(6 * scale);
    const cta = ctaMetrics(ctx, spec, brand, scale, ts, cs.size);
    const headlineH = headline.lines.length * headline.lineHeight;
    const sublineH = subline ? subline.lines.length * subline.lineHeight : 0;
    const totalH = headlineH + (subline ? gap + sublineH : 0) + (cta ? gap * 1.6 + cta.h : 0);

    let y;
    if (valign === 'bottom') {
      y = region.y + region.h - pad - totalH;
    } else {
      const topSpace = region.y === 0 ? pad + 18 * scale : pad;
      const avail = region.h - topSpace - pad;
      y = region.y + topSpace + Math.max(0, (avail - totalH) / 2);
    }

    ctx.fillStyle = colors.text;
    ctx.font = `${hFont.weight || 700} ${headline.fontSize}px ${hFont.family}`;
    let r = drawLines(ctx, headline.lines, innerX, y, headline.lineHeight, hs.align, maxWidth);
    boxes.headline = { x: r.left, y: y, w: r.width, h: headlineH };
    y = r.bottom;

    if (subline) {
      y += gap;
      ctx.fillStyle = colors.muted;
      ctx.font = `${bFont.weight || 400} ${subline.fontSize}px ${bFont.family}`;
      r = drawLines(ctx, subline.lines, innerX, y, subline.lineHeight, ss.align, maxWidth);
      boxes.subline = { x: r.left, y: y, w: r.width, h: sublineH };
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
    const cta = ctaMetrics(ctx, spec, brand, scale, ts, cs.size);
    const ctaW = cta ? cta.w + pad : 0;

    const textX = region.x + pad;
    const textMaxW = region.w - pad * 2 - ctaW;

    const headline = fitText(ctx, spec.headline, {
      fontFamily: hFont.family, fontWeight: hFont.weight || 700,
      maxWidth: textMaxW, maxHeight: region.h * 0.85,
      maxLines: region.h < 110 ? 2 : 3,
      maxSize: Math.round(Math.min(region.h * 0.5 * (ts || 1) * hs.size, 24 * hst)),
      minSize: Math.max(9, Math.round(12 * hst)),
      lineHeight: hs.lineHeight,
    });
    const showSub = spec.subline && spec.subline.trim() && region.h >= 90;
    const subline = showSub
      ? fitText(ctx, spec.subline, {
          fontFamily: bFont.family, fontWeight: bFont.weight || 400,
          maxWidth: textMaxW, maxHeight: region.h * 0.45, maxLines: 2,
          maxSize: Math.round(Math.min(region.h * 0.3 * (ts || 1) * ss.size, 14 * sst)),
          minSize: Math.max(8, Math.round(10 * sst)),
          lineHeight: ss.lineHeight,
        })
      : null;

    const gap = Math.round(3 * scale);
    const headlineH = headline.lines.length * headline.lineHeight;
    const sublineH = subline ? subline.lines.length * subline.lineHeight : 0;
    const totalH = headlineH + (subline ? gap + sublineH : 0);
    let y = region.y + (region.h - totalH) / 2;

    ctx.fillStyle = colors.text;
    ctx.font = `${hFont.weight || 700} ${headline.fontSize}px ${hFont.family}`;
    let r = drawLines(ctx, headline.lines, textX, y, headline.lineHeight, hs.align, textMaxW);
    boxes.headline = { x: r.left, y: y, w: r.width, h: headlineH };
    y = r.bottom;

    if (subline) {
      y += gap;
      ctx.fillStyle = colors.muted;
      ctx.font = `${bFont.weight || 400} ${subline.fontSize}px ${bFont.family}`;
      r = drawLines(ctx, subline.lines, textX, y, subline.lineHeight, ss.align, textMaxW);
      boxes.subline = { x: r.left, y: y, w: r.width, h: sublineH };
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
  function layoutTextsManual(ctx, format, spec, brand, colors, ctaColor, ov, scale, pad, ts, styles) {
    const W = format.width;
    const H = format.height;
    const hFont = brand.fonts.heading;
    const bFont = brand.fonts.body;
    const boxes = {};

    function place(el, isHeadline) {
      const o = ov[el];
      if (!o) return;
      const s = styleFor(styles, el);
      const est = scale * (ts || 1) * s.size;
      const anchorX = o.x * W;
      const anchorY = o.y * H;
      const boxW = Math.max(20, W - anchorX - pad);
      const font = isHeadline ? hFont : bFont;
      const fit = fitText(ctx, spec[el], {
        fontFamily: font.family,
        fontWeight: font.weight || (isHeadline ? 700 : 400),
        maxWidth: boxW,
        maxHeight: H,
        maxLines: 6,
        maxSize: isHeadline ? Math.round(30 * est) : Math.round(15 * est),
        minSize: isHeadline ? Math.max(9, Math.round(13 * est)) : Math.max(8, Math.round(11 * est)),
        lineHeight: s.lineHeight,
      });
      ctx.fillStyle = isHeadline ? colors.text : colors.muted;
      ctx.font = `${font.weight || (isHeadline ? 700 : 400)} ${fit.fontSize}px ${font.family}`;
      const r = drawLines(ctx, fit.lines, anchorX, anchorY, fit.lineHeight, s.align, boxW);
      boxes[el] = { x: r.left, y: anchorY, w: r.width, h: fit.lines.length * fit.lineHeight };
    }

    if (spec.headline && spec.headline.trim()) place('headline', true);
    if (spec.subline && spec.subline.trim()) place('subline', false);

    const cta = ctaMetrics(ctx, spec, brand, scale, ts, styleFor(styles, 'cta').size);
    if (cta && ov.cta) {
      const cx = ov.cta.x * W;
      const cy = ov.cta.y * H;
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
    const ov = opts.override || {};
    const imgT = ov.image ? Object.assign({}, ov.image) : { scale: 1, offsetX: 0, offsetY: 0 };
    if (opts.imageFocus) {
      if (imgT.focusX == null) imgT.focusX = opts.imageFocus.x;
      if (imgT.focusY == null) imgT.focusY = opts.imageFocus.y;
    }
    const W = format.width;
    const H = format.height;
    const orient = orientationOf(format);
    const scale = Math.max(0.7, Math.min(2.2, Math.sqrt((W * H) / (300 * 250))));
    // proporcionální bezpečný okraj (~6 % kratší strany) dle grafických standardů
    const pad = Math.round(Math.max(10, Math.min(W, H) * 0.06));

    const bg = drawBackground(ctx, format, spec, brand, image, orient, scale, pad, imgT, opts);
    const colors = resolveTextColors(opts.textColor, bg.colors, brand);
    const ts = opts.textScale || 1;

    let boxes;
    if (ov.manual) {
      boxes = layoutTextsManual(ctx, format, spec, brand, colors, opts.ctaColor, ov, scale, pad, ts, opts.textStyle);
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
        drawBadgeAt(ctx, bm, brand, opts.badgeColor, cx, cy);
        boxes.badge = { x: cx - bm.halfW, y: cy - bm.halfH, w: bm.halfW * 2, h: bm.halfH * 2 };
      }
    }

    const logoHidden = ov.logoHidden === undefined ? !!opts.logoDefaultHidden : ov.logoHidden;
    if (!logoHidden) {
      const anchor = bg.logoAnchor || { x: pad, y: pad };
      const lx = ov.logo ? ov.logo.x * W : anchor.x;
      const ly = ov.logo ? ov.logo.y * H : anchor.y;
      const lbox = drawLogo(ctx, brand, lx, ly, scale, bg.logoColor || colors.text, spec.logoText);
      if (lbox) boxes.logo = lbox;
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    return { boxes: boxes, imageRect: bg.imageRect, region: bg.region };
  }

  global.BannerRenderer = { renderBanner: renderBanner, orientationOf: orientationOf };
})(window);
