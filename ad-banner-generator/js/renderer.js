/*
 * Vykreslení jednoho banneru na canvas.
 * Stejná funkce se používá pro živý náhled i pro PNG export,
 * takže náhled = výsledek.
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

  // Rozdělí text na řádky tak, aby se vešel do maxWidth, s daným fontem.
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

  // Najde největší velikost písma (<= maxSize), při které se text vejde
  // do maxWidth na maxLines řádků. Vrací { fontSize, lines }.
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
    // fallback: minSize, tvrdě ořízneme počet řádků
    ctx.font = `${fontWeight} ${minSize}px ${fontFamily}`;
    let lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
    if (lines.length === maxLines) {
      // přidat výpustku k poslednímu řádku pokud oříznuto
      lines[lines.length - 1] = lines[lines.length - 1] + '…';
    }
    return { fontSize: minSize, lines: lines, lineHeight: minSize * 1.15 };
  }

  function drawTextBlock(ctx, lines, x, y, lineHeight, align) {
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    let cy = y;
    for (const line of lines) {
      ctx.fillText(line, x, cy);
      cy += lineHeight;
    }
    return cy;
  }

  // Nakreslí obrázek metodou "cover" do obdélníku (x,y,w,h).
  function drawImageCover(ctx, img, x, y, w, h) {
    const ir = img.width / img.height;
    const rr = w / h;
    let sx, sy, sw, sh;
    if (ir > rr) {
      // obrázek širší — ořež po stranách
      sh = img.height;
      sw = sh * rr;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = sw / rr;
      sx = 0;
      sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  function linearGradient(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((s) => g.addColorStop(s[0], s[1]));
    return g;
  }

  function drawCTA(ctx, spec, brand, cx, cy, scale) {
    const text = spec.cta || '';
    if (!text.trim()) return { width: 0, height: 0 };
    const fontFamily = brand.fonts.heading.family;
    const fontSize = Math.max(9, Math.round(13 * scale));
    ctx.font = `600 ${fontSize}px ${fontFamily}`;
    const padX = Math.round(fontSize * 1.1);
    const padY = Math.round(fontSize * 0.6);
    const textW = ctx.measureText(text).width;
    const btnW = textW + padX * 2;
    const btnH = fontSize + padY * 2;
    roundRect(ctx, cx, cy, btnW, btnH, btnH / 2);
    ctx.fillStyle = brand.colors.ctaBackground;
    ctx.fill();
    ctx.fillStyle = brand.colors.ctaText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx + btnW / 2, cy + btnH / 2 + 1);
    return { width: btnW, height: btnH };
  }

  function drawLogo(ctx, brand, x, y, scale, color) {
    const text = brand.logoText || brand.name || '';
    if (!text) return;
    const fontSize = Math.max(9, Math.round(12 * scale));
    ctx.font = `700 ${fontSize}px ${brand.fonts.heading.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color || brand.colors.primary;
    ctx.fillText(text, x, y);
  }

  // ---------- hlavní render ----------

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} format  { width, height }
   * @param {Object} spec    { headline, subline, cta, template }
   * @param {Object} brand   načtený brand.json
   * @param {HTMLImageElement|null} image  vybraný vizuál (safe/full)
   */
  function renderBanner(ctx, format, spec, brand, image) {
    const W = format.width;
    const H = format.height;
    const orient = orientationOf(format);
    const scale = Math.max(0.7, Math.min(2.2, Math.sqrt((W * H) / (300 * 250))));
    const pad = Math.round(Math.max(8, 12 * scale));
    const template = spec.template || 'overlay';
    const c = brand.colors;

    // pozadí
    ctx.fillStyle = c.background;
    ctx.fillRect(0, 0, W, H);

    if (template === 'minimal' || !image) {
      renderTextOnColor(ctx, format, spec, brand, orient, scale, pad, !image && template !== 'minimal');
    } else if (template === 'overlay') {
      renderOverlay(ctx, format, spec, brand, image, orient, scale, pad);
    } else if (template === 'classic') {
      renderClassic(ctx, format, spec, brand, image, orient, scale, pad);
    } else if (template === 'split') {
      renderSplit(ctx, format, spec, brand, image, orient, scale, pad);
    } else {
      renderOverlay(ctx, format, spec, brand, image, orient, scale, pad);
    }

    // jemný rámeček (pro display sítě)
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }

  // Text na barevném pozadí značky (minimal, nebo fallback bez vizuálu)
  function renderTextOnColor(ctx, format, spec, brand, orient, scale, pad, noVisualHint) {
    const W = format.width;
    const H = format.height;
    const c = brand.colors;

    ctx.fillStyle = linearGradient(ctx, 0, 0, W, H, [
      [0, c.primary],
      [1, c.secondary],
    ]);
    ctx.fillRect(0, 0, W, H);

    const textColor = '#FFFFFF';
    const mutedColor = 'rgba(255,255,255,0.85)';

    if (orient === 'horizontal') {
      layoutHorizontal(ctx, format, spec, brand, pad, scale, textColor, mutedColor, null);
    } else {
      layoutStacked(ctx, format, spec, brand, pad, scale, textColor, mutedColor, 0, W);
    }
    drawLogo(ctx, brand, pad, pad, scale, '#FFFFFF');
  }

  function renderOverlay(ctx, format, spec, brand, image, orient, scale, pad) {
    const W = format.width;
    const H = format.height;
    drawImageCover(ctx, image, 0, 0, W, H);

    // tmavý přechod pro čitelnost
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

    const textColor = '#FFFFFF';
    const mutedColor = 'rgba(255,255,255,0.9)';
    if (orient === 'horizontal') {
      layoutHorizontal(ctx, format, spec, brand, pad, scale, textColor, mutedColor, null);
    } else {
      layoutStackedBottom(ctx, format, spec, brand, pad, scale, textColor, mutedColor, 0, W);
    }
    drawLogo(ctx, brand, pad, pad, scale, '#FFFFFF');
  }

  function renderClassic(ctx, format, spec, brand, image, orient, scale, pad) {
    const W = format.width;
    const H = format.height;
    const c = brand.colors;

    if (orient === 'vertical') {
      const imgH = Math.round(H * 0.5);
      drawImageCover(ctx, image, 0, 0, W, imgH);
      ctx.fillStyle = c.surface;
      ctx.fillRect(0, imgH, W, H - imgH);
      const region = { x: 0, y: imgH, w: W, h: H - imgH };
      layoutStackedRegion(ctx, format, spec, brand, region, pad, scale, c.text, c.textMuted);
      drawLogo(ctx, brand, pad, pad, scale, '#FFFFFF');
    } else if (orient === 'horizontal') {
      const imgW = Math.round(W * 0.34);
      drawImageCover(ctx, image, 0, 0, imgW, H);
      ctx.fillStyle = c.surface;
      ctx.fillRect(imgW, 0, W - imgW, H);
      layoutHorizontalRegion(ctx, format, spec, brand, { x: imgW, y: 0, w: W - imgW, h: H }, pad, scale, c.text, c.textMuted);
    } else {
      const imgH = Math.round(H * 0.52);
      drawImageCover(ctx, image, 0, 0, W, imgH);
      ctx.fillStyle = c.surface;
      ctx.fillRect(0, imgH, W, H - imgH);
      const region = { x: 0, y: imgH, w: W, h: H - imgH };
      layoutStackedRegion(ctx, format, spec, brand, region, pad, scale, c.text, c.textMuted);
      drawLogo(ctx, brand, pad, pad, scale, '#FFFFFF');
    }
  }

  function renderSplit(ctx, format, spec, brand, image, orient, scale, pad) {
    const W = format.width;
    const H = format.height;
    const c = brand.colors;

    if (orient === 'vertical') {
      // obrázek dole, text nahoře na barvě
      const textH = Math.round(H * 0.5);
      ctx.fillStyle = linearGradient(ctx, 0, 0, 0, textH, [
        [0, c.primary],
        [1, c.secondary],
      ]);
      ctx.fillRect(0, 0, W, textH);
      drawImageCover(ctx, image, 0, textH, W, H - textH);
      layoutStackedRegion(ctx, format, spec, brand, { x: 0, y: 0, w: W, h: textH }, pad, scale, '#FFFFFF', 'rgba(255,255,255,0.85)');
      drawLogo(ctx, brand, pad, pad, scale, '#FFFFFF');
    } else {
      // text vlevo na barvě, obrázek vpravo
      const textW = Math.round(W * (orient === 'horizontal' ? 0.5 : 0.55));
      ctx.fillStyle = linearGradient(ctx, 0, 0, textW, H, [
        [0, c.primary],
        [1, c.secondary],
      ]);
      ctx.fillRect(0, 0, textW, H);
      drawImageCover(ctx, image, textW, 0, W - textW, H);
      if (orient === 'horizontal') {
        layoutHorizontalRegion(ctx, format, spec, brand, { x: 0, y: 0, w: textW, h: H }, pad, scale, '#FFFFFF', 'rgba(255,255,255,0.85)');
      } else {
        layoutStackedRegion(ctx, format, spec, brand, { x: 0, y: 0, w: textW, h: H }, pad, scale, '#FFFFFF', 'rgba(255,255,255,0.85)');
      }
      drawLogo(ctx, brand, pad, pad, scale, '#FFFFFF');
    }
  }

  // ---------- layout helpery ----------

  // Vertikálně skládaný obsah v celém formátu, zarovnaný odshora s logem.
  function layoutStacked(ctx, format, spec, brand, pad, scale, textColor, mutedColor, x0, width) {
    layoutStackedRegion(
      ctx,
      format,
      spec,
      brand,
      { x: x0, y: 0, w: width, h: format.height },
      pad,
      scale,
      textColor,
      mutedColor
    );
  }

  // Skládaný obsah zarovnaný dolů (pro overlay).
  function layoutStackedBottom(ctx, format, spec, brand, pad, scale, textColor, mutedColor, x0, width) {
    const region = { x: x0, y: 0, w: width, h: format.height };
    layoutStackedRegion(ctx, format, spec, brand, region, pad, scale, textColor, mutedColor, 'bottom');
  }

  function layoutStackedRegion(ctx, format, spec, brand, region, pad, scale, textColor, mutedColor, valign) {
    const innerX = region.x + pad;
    const maxWidth = region.w - pad * 2;
    const hFont = brand.fonts.heading;
    const bFont = brand.fonts.body;

    const headline = fitText(ctx, spec.headline, {
      fontFamily: hFont.family,
      fontWeight: hFont.weight || 700,
      maxWidth: maxWidth,
      maxHeight: region.h * 0.4,
      maxLines: region.h > 300 ? 3 : 2,
      maxSize: Math.round(28 * scale),
      minSize: Math.max(12, Math.round(13 * scale)),
    });

    const subline = spec.subline && spec.subline.trim()
      ? fitText(ctx, spec.subline, {
          fontFamily: bFont.family,
          fontWeight: bFont.weight || 400,
          maxWidth: maxWidth,
          maxHeight: region.h * 0.3,
          maxLines: region.h > 300 ? 3 : 2,
          maxSize: Math.round(15 * scale),
          minSize: Math.max(10, Math.round(11 * scale)),
        })
      : null;

    const gap = Math.round(6 * scale);
    const ctaText = (spec.cta || '').trim();
    const ctaH = ctaText ? Math.round(13 * scale) + Math.round(13 * scale * 0.6) * 2 : 0;

    const headlineH = headline.lines.length * headline.lineHeight;
    const sublineH = subline ? subline.lines.length * subline.lineHeight : 0;
    const totalH = headlineH + (subline ? gap + sublineH : 0) + (ctaText ? gap * 1.6 + ctaH : 0);

    let y;
    if (valign === 'bottom') {
      y = region.y + region.h - pad - totalH;
    } else {
      // vertikálně vycentrovat v regionu, ale nechat místo na logo nahoře
      const topSpace = region.y === 0 ? pad + 18 * scale : pad;
      const avail = region.h - topSpace - pad;
      y = region.y + topSpace + Math.max(0, (avail - totalH) / 2);
    }

    ctx.fillStyle = textColor;
    ctx.font = `${hFont.weight || 700} ${headline.fontSize}px ${hFont.family}`;
    y = drawTextBlock(ctx, headline.lines, innerX, y, headline.lineHeight, 'left');

    if (subline) {
      y += gap;
      ctx.fillStyle = mutedColor;
      ctx.font = `${bFont.weight || 400} ${subline.fontSize}px ${bFont.family}`;
      y = drawTextBlock(ctx, subline.lines, innerX, y, subline.lineHeight, 'left');
    }

    if (ctaText) {
      y += gap * 1.6;
      drawCTA(ctx, spec, brand, innerX, y, scale);
    }
  }

  // Horizontální pruh: text vlevo, CTA vpravo (leaderboard apod.)
  function layoutHorizontal(ctx, format, spec, brand, pad, scale, textColor, mutedColor) {
    layoutHorizontalRegion(ctx, format, spec, brand, { x: 0, y: 0, w: format.width, h: format.height }, pad, scale, textColor, mutedColor);
  }

  function layoutHorizontalRegion(ctx, format, spec, brand, region, pad, scale, textColor, mutedColor) {
    const hFont = brand.fonts.heading;
    const bFont = brand.fonts.body;
    const ctaText = (spec.cta || '').trim();

    // Rezervuj prostor pro CTA vpravo
    let ctaW = 0;
    if (ctaText) {
      const fontSize = Math.max(9, Math.round(13 * scale));
      ctx.font = `600 ${fontSize}px ${hFont.family}`;
      ctaW = ctx.measureText(ctaText).width + Math.round(fontSize * 1.1) * 2 + pad;
    }

    const logoSpace = region.x === 0 ? 0 : 0;
    const textX = region.x + pad + logoSpace;
    const textMaxW = region.w - pad * 2 - ctaW - logoSpace;

    const headline = fitText(ctx, spec.headline, {
      fontFamily: hFont.family,
      fontWeight: hFont.weight || 700,
      maxWidth: textMaxW,
      maxHeight: region.h * 0.6,
      maxLines: region.h < 110 ? 1 : 2,
      maxSize: Math.round(Math.min(region.h * 0.42, 24 * scale)),
      minSize: Math.max(11, Math.round(12 * scale)),
    });

    const showSub = spec.subline && spec.subline.trim() && region.h >= 90;
    const subline = showSub
      ? fitText(ctx, spec.subline, {
          fontFamily: bFont.family,
          fontWeight: bFont.weight || 400,
          maxWidth: textMaxW,
          maxHeight: region.h * 0.35,
          maxLines: 1,
          maxSize: Math.round(Math.min(region.h * 0.28, 14 * scale)),
          minSize: Math.max(9, Math.round(10 * scale)),
        })
      : null;

    const gap = Math.round(3 * scale);
    const headlineH = headline.lines.length * headline.lineHeight;
    const sublineH = subline ? subline.lines.length * subline.lineHeight : 0;
    const totalH = headlineH + (subline ? gap + sublineH : 0);
    let y = region.y + (region.h - totalH) / 2;

    ctx.fillStyle = textColor;
    ctx.font = `${hFont.weight || 700} ${headline.fontSize}px ${hFont.family}`;
    y = drawTextBlock(ctx, headline.lines, textX, y, headline.lineHeight, 'left');

    if (subline) {
      y += gap;
      ctx.fillStyle = mutedColor;
      ctx.font = `${bFont.weight || 400} ${subline.fontSize}px ${bFont.family}`;
      drawTextBlock(ctx, subline.lines, textX, y, subline.lineHeight, 'left');
    }

    if (ctaText) {
      const fontSize = Math.max(9, Math.round(13 * scale));
      const btnH = fontSize + Math.round(fontSize * 0.6) * 2;
      const cy = region.y + (region.h - btnH) / 2;
      const padX = Math.round(fontSize * 1.1);
      ctx.font = `600 ${fontSize}px ${hFont.family}`;
      const btnW = ctx.measureText(ctaText).width + padX * 2;
      const cx = region.x + region.w - pad - btnW;
      roundRect(ctx, cx, cy, btnW, btnH, btnH / 2);
      ctx.fillStyle = brand.colors.ctaBackground;
      ctx.fill();
      ctx.fillStyle = brand.colors.ctaText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ctaText, cx + btnW / 2, cy + btnH / 2 + 1);
    }
  }

  global.BannerRenderer = { renderBanner: renderBanner, orientationOf: orientationOf };
})(window);
