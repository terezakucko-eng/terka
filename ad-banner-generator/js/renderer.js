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
    const words = String(text || '').split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const lines = [];
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
    return lines;
  }

  function fitText(ctx, text, opts) {
    const { fontFamily, fontWeight, maxWidth, maxHeight, maxLines, maxSize, minSize } = opts;
    for (let size = maxSize; size >= minSize; size -= 1) {
      ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
      const lines = wrapText(ctx, text, maxWidth);
      const lineHeight = size * 1.15;
      if (lines.length <= maxLines && lines.length * lineHeight <= maxHeight) {
        return { fontSize: size, lines: lines, lineHeight: lineHeight };
      }
    }
    ctx.font = `${fontWeight} ${minSize}px ${fontFamily}`;
    let lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
    if (lines.length === maxLines) {
      lines[lines.length - 1] = lines[lines.length - 1] + '…';
    }
    return { fontSize: minSize, lines: lines, lineHeight: minSize * 1.15 };
  }

  function drawLines(ctx, lines, x, y, lineHeight) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let cy = y;
    let maxW = 0;
    for (const line of lines) {
      ctx.fillText(line, x, cy);
      maxW = Math.max(maxW, ctx.measureText(line).width);
      cy += lineHeight;
    }
    return { width: maxW, bottom: cy };
  }

  // Nakreslí obrázek "cover" do obdélníku s transformací (zoom + posun).
  // t = { scale >= 1, offsetX -1..1, offsetY -1..1 }
  function drawImageTransformed(ctx, img, rx, ry, rw, rh, t) {
    t = t || {};
    const scale = Math.max(rw / img.width, rh / img.height) * (t.scale || 1);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const slackX = dw - rw;
    const slackY = dh - rh;
    const ox = Math.max(-1, Math.min(1, t.offsetX || 0));
    const oy = Math.max(-1, Math.min(1, t.offsetY || 0));
    const dx = rx - slackX / 2 + (ox * slackX) / 2;
    const dy = ry - slackY / 2 + (oy * slackY) / 2;
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

  // ---------- CTA ----------
  function ctaMetrics(ctx, spec, brand, scale, ts) {
    const text = (spec.cta || '').trim();
    if (!text) return null;
    const fontSize = Math.max(9, Math.round(13 * scale * (ts || 1)));
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

  // Odznak ve tvaru "pusinky" (rty Růžového Slona) s hodnotou slevy.
  // Špičaté rohy vlevo/vpravo, horní ret s prohlubní uprostřed (cupid's bow),
  // spodní ret plná oblá křivka.
  function badgePath(ctx, cx, cy, W, H) {
    ctx.beginPath();
    ctx.moveTo(cx - W, cy); // levá špička
    // horní ret: hrbolek → jemný zářez uprostřed → hrbolek → pravá špička
    ctx.bezierCurveTo(cx - W * 0.48, cy - H * 1.34, cx - W * 0.18, cy - H * 1.22, cx, cy - H * 1.05);
    ctx.bezierCurveTo(cx + W * 0.18, cy - H * 1.22, cx + W * 0.48, cy - H * 1.34, cx + W, cy);
    // spodní ret: plná oblá křivka zpět k levé špičce
    ctx.bezierCurveTo(cx + W * 0.5, cy + H * 1.33, cx - W * 0.5, cy + H * 1.33, cx - W, cy);
    ctx.closePath();
  }

  // Zachovává poměr stran pusinky (~1,9:1), aby vypadala stejně bez ohledu na
  // délku textu slevy. Číslo je vždy vycentrované uvnitř.
  function badgeMetrics(ctx, text, brand, scale) {
    const t = String(text || '').trim();
    if (!t) return null;
    const fontSize = Math.max(12, Math.round(20 * scale));
    ctx.font = `800 ${fontSize}px ${brand.fonts.heading.family}`;
    const tw = ctx.measureText(t).width;
    const ASPECT = 1.9;
    let halfW = tw / 2 + fontSize * 1.1;
    let halfH = halfW / ASPECT;
    const minHalfH = fontSize * 0.95;
    if (halfH < minHalfH) {
      halfH = minHalfH;
      halfW = halfH * ASPECT;
    }
    return { text: t, fontSize, halfW, halfH };
  }

  function drawBadgeAt(ctx, m, brand, color, cx, cy) {
    badgePath(ctx, cx, cy, m.halfW, m.halfH);
    ctx.fillStyle = color || brand.colors.primary;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 ${m.fontSize}px ${brand.fonts.heading.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.text, cx, cy + 1);
  }

  function drawLogo(ctx, brand, x, y, scale, color) {
    const text = brand.logoText || brand.name || '';
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
  function drawBackground(ctx, format, spec, brand, image, orient, scale, pad, imgT) {
    const W = format.width;
    const H = format.height;
    const c = brand.colors;
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
        logoColor: '#FFFFFF',
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
        logoColor: '#FFFFFF',
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
      ctx.fillStyle = c.surface;
      ctx.fillRect(region.x, region.y, region.w, region.h);
      return {
        region: region,
        colors: { text: c.text, muted: c.textMuted },
        imageRect: imageRect,
        logoColor: '#FFFFFF',
      };
    }

    // split
    let imageRect, region, logoColor;
    if (orient === 'vertical') {
      const textH = Math.round(H * 0.5);
      ctx.fillStyle = linearGradient(ctx, 0, 0, 0, textH, [
        [0, c.primary],
        [1, c.secondary],
      ]);
      ctx.fillRect(0, 0, W, textH);
      imageRect = { x: 0, y: textH, w: W, h: H - textH };
      region = { x: 0, y: 0, w: W, h: textH };
      logoColor = '#FFFFFF';
    } else {
      const textW = Math.round(W * (orient === 'horizontal' ? 0.5 : 0.55));
      ctx.fillStyle = linearGradient(ctx, 0, 0, textW, H, [
        [0, c.primary],
        [1, c.secondary],
      ]);
      ctx.fillRect(0, 0, textW, H);
      imageRect = { x: textW, y: 0, w: W - textW, h: H };
      region = { x: 0, y: 0, w: textW, h: H };
      logoColor = '#FFFFFF';
    }
    drawImageTransformed(ctx, image, imageRect.x, imageRect.y, imageRect.w, imageRect.h, imgT);
    return {
      region: region,
      colors: { text: '#FFFFFF', muted: 'rgba(255,255,255,0.85)' },
      imageRect: imageRect,
      logoColor: logoColor,
    };
  }

  // ---------- automatické rozvržení textů (v oblasti) ----------
  function layoutTextsAuto(ctx, format, spec, brand, colors, ctaColor, region, orient, scale, pad, valign, ts) {
    if (orient === 'horizontal') {
      return layoutHorizontal(ctx, format, spec, brand, colors, ctaColor, region, scale, pad, ts);
    }
    return layoutStacked(ctx, format, spec, brand, colors, ctaColor, region, scale, pad, valign, ts);
  }

  function layoutStacked(ctx, format, spec, brand, colors, ctaColor, region, scale, pad, valign, ts) {
    const st = scale * (ts || 1);
    const innerX = region.x + pad;
    const maxWidth = region.w - pad * 2;
    const hFont = brand.fonts.heading;
    const bFont = brand.fonts.body;
    const boxes = {};

    const headline = fitText(ctx, spec.headline, {
      fontFamily: hFont.family,
      fontWeight: hFont.weight || 700,
      maxWidth: maxWidth,
      maxHeight: region.h * (ts > 1 ? 0.7 : 0.4),
      maxLines: region.h > 300 ? 3 : 2,
      maxSize: Math.round(28 * st),
      minSize: Math.max(9, Math.round(13 * st)),
    });
    const subline =
      spec.subline && spec.subline.trim()
        ? fitText(ctx, spec.subline, {
            fontFamily: bFont.family,
            fontWeight: bFont.weight || 400,
            maxWidth: maxWidth,
            maxHeight: region.h * (ts > 1 ? 0.5 : 0.3),
            maxLines: region.h > 300 ? 3 : 2,
            maxSize: Math.round(15 * st),
            minSize: Math.max(8, Math.round(11 * st)),
          })
        : null;

    const gap = Math.round(6 * scale);
    const cta = ctaMetrics(ctx, spec, brand, scale, ts);
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
    let r = drawLines(ctx, headline.lines, innerX, y, headline.lineHeight);
    boxes.headline = { x: innerX, y: y, w: r.width, h: headlineH };
    y = r.bottom;

    if (subline) {
      y += gap;
      ctx.fillStyle = colors.muted;
      ctx.font = `${bFont.weight || 400} ${subline.fontSize}px ${bFont.family}`;
      r = drawLines(ctx, subline.lines, innerX, y, subline.lineHeight);
      boxes.subline = { x: innerX, y: y - gap + gap, w: r.width, h: sublineH };
      y = r.bottom;
    }

    if (cta) {
      y += gap * 1.6;
      drawCTAAt(ctx, cta, brand, ctaColor, innerX, y);
      boxes.cta = { x: innerX, y: y, w: cta.w, h: cta.h };
    }
    return boxes;
  }

  function layoutHorizontal(ctx, format, spec, brand, colors, ctaColor, region, scale, pad, ts) {
    const st = scale * (ts || 1);
    const hFont = brand.fonts.heading;
    const bFont = brand.fonts.body;
    const boxes = {};
    const cta = ctaMetrics(ctx, spec, brand, scale, ts);
    const ctaW = cta ? cta.w + pad : 0;

    const textX = region.x + pad;
    const textMaxW = region.w - pad * 2 - ctaW;

    const headline = fitText(ctx, spec.headline, {
      fontFamily: hFont.family,
      fontWeight: hFont.weight || 700,
      maxWidth: textMaxW,
      maxHeight: region.h * 0.85,
      maxLines: region.h < 110 ? 1 : 2,
      maxSize: Math.round(Math.min(region.h * 0.42 * (ts || 1), 24 * st)),
      minSize: Math.max(9, Math.round(12 * st)),
    });
    const showSub = spec.subline && spec.subline.trim() && region.h >= 90;
    const subline = showSub
      ? fitText(ctx, spec.subline, {
          fontFamily: bFont.family,
          fontWeight: bFont.weight || 400,
          maxWidth: textMaxW,
          maxHeight: region.h * 0.45,
          maxLines: 1,
          maxSize: Math.round(Math.min(region.h * 0.28 * (ts || 1), 14 * st)),
          minSize: Math.max(8, Math.round(10 * st)),
        })
      : null;

    const gap = Math.round(3 * scale);
    const headlineH = headline.lines.length * headline.lineHeight;
    const sublineH = subline ? subline.lines.length * subline.lineHeight : 0;
    const totalH = headlineH + (subline ? gap + sublineH : 0);
    let y = region.y + (region.h - totalH) / 2;

    ctx.fillStyle = colors.text;
    ctx.font = `${hFont.weight || 700} ${headline.fontSize}px ${hFont.family}`;
    let r = drawLines(ctx, headline.lines, textX, y, headline.lineHeight);
    boxes.headline = { x: textX, y: y, w: r.width, h: headlineH };
    y = r.bottom;

    if (subline) {
      y += gap;
      ctx.fillStyle = colors.muted;
      ctx.font = `${bFont.weight || 400} ${subline.fontSize}px ${bFont.family}`;
      r = drawLines(ctx, subline.lines, textX, y, subline.lineHeight);
      boxes.subline = { x: textX, y: y, w: r.width, h: sublineH };
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
  function layoutTextsManual(ctx, format, spec, brand, colors, ctaColor, ov, scale, pad, ts) {
    const W = format.width;
    const H = format.height;
    const st = scale * (ts || 1);
    const hFont = brand.fonts.heading;
    const bFont = brand.fonts.body;
    const boxes = {};

    function place(el, isHeadline) {
      const o = ov[el];
      if (!o) return;
      const anchorX = o.x * W;
      const anchorY = o.y * H;
      const maxWidth = Math.max(20, W - anchorX - pad);
      const font = isHeadline ? hFont : bFont;
      const fit = fitText(ctx, spec[el], {
        fontFamily: font.family,
        fontWeight: font.weight || (isHeadline ? 700 : 400),
        maxWidth: maxWidth,
        maxHeight: H,
        maxLines: isHeadline ? 4 : 4,
        maxSize: isHeadline ? Math.round(30 * st) : Math.round(15 * st),
        minSize: isHeadline ? Math.max(9, Math.round(13 * st)) : Math.max(8, Math.round(11 * st)),
      });
      ctx.fillStyle = isHeadline ? colors.text : colors.muted;
      ctx.font = `${font.weight || (isHeadline ? 700 : 400)} ${fit.fontSize}px ${font.family}`;
      const r = drawLines(ctx, fit.lines, anchorX, anchorY, fit.lineHeight);
      boxes[el] = { x: anchorX, y: anchorY, w: r.width, h: fit.lines.length * fit.lineHeight };
    }

    if (spec.headline && spec.headline.trim()) place('headline', true);
    if (spec.subline && spec.subline.trim()) place('subline', false);

    const cta = ctaMetrics(ctx, spec, brand, scale, ts);
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
    const imgT = ov.image || null;
    const W = format.width;
    const H = format.height;
    const orient = orientationOf(format);
    const scale = Math.max(0.7, Math.min(2.2, Math.sqrt((W * H) / (300 * 250))));
    const pad = Math.round(Math.max(8, 12 * scale));

    const bg = drawBackground(ctx, format, spec, brand, image, orient, scale, pad, imgT);
    const colors = resolveTextColors(opts.textColor, bg.colors, brand);
    const ts = opts.textScale || 1;

    let boxes;
    if (ov.manual) {
      boxes = layoutTextsManual(ctx, format, spec, brand, colors, opts.ctaColor, ov, scale, pad, ts);
    } else {
      boxes = layoutTextsAuto(
        ctx, format, spec, brand, colors, opts.ctaColor, bg.region, orient, scale, pad, bg.valign, ts
      );
    }

    // slevový odznak ("pusinka")
    if (spec.discount && spec.discount.show) {
      const bm = badgeMetrics(ctx, spec.discount.text, brand, scale);
      if (bm) {
        const b = ov.badge || { x: 0.8, y: 0.3 };
        const cx = b.x * W;
        const cy = b.y * H;
        drawBadgeAt(ctx, bm, brand, opts.badgeColor, cx, cy);
        boxes.badge = { x: cx - bm.halfW, y: cy - bm.halfH, w: bm.halfW * 2, h: bm.halfH * 2 };
      }
    }

    if (!ov.logoHidden) {
      const lx = ov.logo ? ov.logo.x * W : pad;
      const ly = ov.logo ? ov.logo.y * H : pad;
      const lbox = drawLogo(ctx, brand, lx, ly, scale, bg.imageRect ? bg.logoColor : colors.text);
      if (lbox) boxes.logo = lbox;
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    return { boxes: boxes, imageRect: bg.imageRect, region: bg.region };
  }

  global.BannerRenderer = { renderBanner: renderBanner, orientationOf: orientationOf };
})(window);
