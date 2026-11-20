// poster.js — draws a multi-panel sunset poster onto a canvas 2D context.
//
// A poster is panels on top and a caption band at the bottom. drawPoster(ctx, state, w, h)
// renders the whole thing at any pixel size, so the live preview and the exported PNG are
// the same drawing. Nothing here touches the network: photos are Image objects the editor
// loaded from the user's machine (or the app's own sample files).

export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350' },
  wide: { w: 1920, h: 1080, label: '1920 × 1080' },
};

// One colour grade: how the photos are filtered, the tint washed over each panel, and
// the colours of the caption band. All original palettes, no game assets.
export const GRADES = {
  sunset: {
    name: 'Vice City Sunset',
    filter: 'saturate(1.30) contrast(1.10) brightness(1.03)',
    tintFrom: 'rgba(255, 122, 26, 0.30)',
    tintTo: 'rgba(255, 41, 117, 0.34)',
    band: ['#ff9a3d', '#ff2975', '#7b2ff7'],
    sub: '#ffe66d',
  },
  neon: {
    name: 'Neon Nights',
    filter: 'saturate(1.65) contrast(1.15) hue-rotate(-8deg)',
    tintFrom: 'rgba(255, 41, 117, 0.32)',
    tintTo: 'rgba(0, 229, 255, 0.30)',
    band: ['#2b1055', '#ff2975', '#00c2ff'],
    sub: '#7ef9ff',
  },
  pop: {
    name: 'Bubblegum Pop',
    filter: 'saturate(1.45) contrast(1.05) brightness(1.04)',
    tintFrom: 'rgba(255, 93, 162, 0.30)',
    tintTo: 'rgba(0, 194, 255, 0.26)',
    band: ['#ff5da2', '#7b2ff7', '#00c2ff'],
    sub: '#ffffff',
  },
};

// Layouts carve the panels area (the poster minus the caption band) into rectangles.
// Each function gets the panels area in pixels and the gutter, and answers panel rects
// in the order the editor numbers them.
export const LAYOUTS = {
  hero: {
    name: 'Hero + two',
    panels: (w, h, g) => {
      const heroW = Math.round(w * 0.62);
      const sideW = w - heroW - g;
      const sideH = Math.round((h - g) / 2);
      return [
        { x: 0, y: 0, w: heroW, h },
        { x: heroW + g, y: 0, w: sideW, h: sideH },
        { x: heroW + g, y: sideH + g, w: sideW, h: h - sideH - g },
      ];
    },
  },
  four: {
    name: 'Four up',
    panels: (w, h, g) => {
      const cw = Math.round((w - g) / 2);
      const ch = Math.round((h - g) / 2);
      return [
        { x: 0, y: 0, w: cw, h: ch },
        { x: cw + g, y: 0, w: w - cw - g, h: ch },
        { x: 0, y: ch + g, w: cw, h: h - ch - g },
        { x: cw + g, y: ch + g, w: w - cw - g, h: h - ch - g },
      ];
    },
  },
  triptych: {
    name: 'Triptych',
    panels: (w, h, g) => {
      const cw = Math.round((w - 2 * g) / 3);
      return [
        { x: 0, y: 0, w: cw, h },
        { x: cw + g, y: 0, w: cw, h },
        { x: 2 * (cw + g), y: 0, w: w - 2 * (cw + g), h },
      ];
    },
  },
  solo: {
    name: 'Solo',
    panels: (w, h) => [{ x: 0, y: 0, w, h }],
  },
};

/** The panel rects for a layout at this poster size. */
export function panelRects(layout, w, h) {
  const gap = Math.max(2, Math.round(Math.min(w, h) * 0.012));
  const bandH = Math.round(h * 0.26);
  const rects = LAYOUTS[layout].panels(w, h - bandH, gap);
  return { rects, gap, bandH, panelsH: h - bandH };
}

/** How far a panel's photo may be panned (fractions of the panel) before it stops covering. */
function panLimits(photo, rect, zoom) {
  if (!photo || !photo.naturalWidth) return { x: 0, y: 0 };
  const scale = Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight) * zoom;
  const dw = photo.naturalWidth * scale;
  const dh = photo.naturalHeight * scale;
  return {
    x: Math.max(0, (dw - rect.w) / 2 / rect.w),
    y: Math.max(0, (dh - rect.h) / 2 / rect.h),
  };
}

function clampPan(panel, photo, rect) {
  const lim = panLimits(photo, rect, panel.zoom);
  panel.panX = Math.max(-lim.x, Math.min(lim.x, panel.panX || 0));
  panel.panY = Math.max(-lim.y, Math.min(lim.y, panel.panY || 0));
}

function drawPanel(ctx, rect, panel, photos, grade) {
  const photo = panel && panel.photo != null ? photos[panel.photo] : null;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (photo && photo.img) {
    clampPan(panel, photo.img, rect);
    const zoom = panel.zoom || 1;
    const scale = Math.max(rect.w / photo.img.naturalWidth, rect.h / photo.img.naturalHeight) * zoom;
    const dw = photo.img.naturalWidth * scale;
    const dh = photo.img.naturalHeight * scale;
    const dx = rect.x + (rect.w - dw) / 2 + (panel.panX || 0) * rect.w;
    const dy = rect.y + (rect.h - dh) / 2 + (panel.panY || 0) * rect.h;
    ctx.filter = grade.filter;
    ctx.drawImage(photo.img, dx, dy, dw, dh);
    ctx.filter = 'none';
  } else {
    const empty = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
    empty.addColorStop(0, '#241239');
    empty.addColorStop(1, '#160a26');
    ctx.fillStyle = empty;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  // Sunset wash over the photo, then shade at the foot so panels sit together.
  const tint = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  tint.addColorStop(0, grade.tintFrom);
  tint.addColorStop(1, grade.tintTo);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = tint;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'source-over';
  const shade = ctx.createLinearGradient(0, rect.y + rect.h * 0.55, 0, rect.y + rect.h);
  shade.addColorStop(0, 'rgba(16, 4, 28, 0)');
  shade.addColorStop(1, 'rgba(16, 4, 28, 0.38)');
  ctx.fillStyle = shade;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  // Thin white frame: the comic-poster edge between panels.
  ctx.lineWidth = Math.max(2, Math.round(Math.min(rect.w, rect.h) * 0.008));
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.strokeRect(rect.x + ctx.lineWidth / 2, rect.y + ctx.lineWidth / 2, rect.w - ctx.lineWidth, rect.h - ctx.lineWidth);
}

function fitFont(ctx, text, fontFamily, startSize, maxWidth, weight) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${fontFamily}`;
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${fontFamily}`;
  }
  return size;
}

function drawBand(ctx, x, y, w, h, state, grade) {
  const band = ctx.createLinearGradient(x, y, x + w, y + h);
  grade.band.forEach((color, i) => band.addColorStop(i / (grade.band.length - 1), color));
  ctx.fillStyle = band;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(12, 4, 26, 0.28)';
  ctx.fillRect(x, y, w, h);

  // A low synthwave sun glowing behind the title.
  const sunR = h * 0.85;
  const sunX = w / 2;
  const sunY = y + h * 0.30;
  const sun = ctx.createRadialGradient(sunX, sunY, sunR * 0.1, sunX, sunY, sunR);
  sun.addColorStop(0, 'rgba(255, 211, 25, 0.85)');
  sun.addColorStop(0.55, 'rgba(255, 41, 117, 0.55)');
  sun.addColorStop(1, 'rgba(255, 41, 117, 0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  const title = (state.title || '').trim().toUpperCase();
  if (title) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    try { ctx.letterSpacing = '0.01em'; } catch { /* older canvas: no letter spacing */ }
    const size = fitFont(ctx, title, 'Anton, "Arial Black", sans-serif', h * 0.52, w * 0.92, 400);
    const cy = y + h * 0.40;
    ctx.fillStyle = '#160a24';
    ctx.fillText(title, w / 2 + size * 0.05, cy + size * 0.07);
    ctx.fillStyle = state.titleColor || '#ffffff';
    ctx.fillText(title, w / 2, cy);
    try { ctx.letterSpacing = '0px'; } catch { /* reset */ }
  }

  const sub = (state.subtitle || '').trim().toUpperCase();
  if (sub) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    try { ctx.letterSpacing = '0.42em'; } catch { /* older canvas */ }
    const size = fitFont(ctx, sub, '"Bebas Neue", "Arial Narrow", sans-serif', h * 0.20, w * 0.88, 400);
    ctx.fillStyle = grade.sub;
    ctx.fillText(sub, w / 2, y + h * 0.74);
    try { ctx.letterSpacing = '0px'; } catch { /* reset */ }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.max(9, Math.round(h * 0.075))}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fillText('MADE WITH SUNSET COVER STUDIO', w / 2, y + h * 0.92);
}

/** Draws the whole poster for `state` at `w` by `h` pixels. */
export function drawPoster(ctx, state, w, h) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  ctx.fillStyle = '#150826';
  ctx.fillRect(0, 0, w, h);
  const { rects, bandH, panelsH } = panelRects(state.layout, w, h);
  rects.forEach((rect, i) => {
    drawPanel(ctx, rect, state.panels[i], state.photos, grade);
  });
  drawBand(ctx, 0, panelsH, w, bandH, state, grade);
}

/** A fresh canvas with the poster rendered at `w` by `h` pixels. */
export function renderCover(state, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawPoster(canvas.getContext('2d'), state, w, h);
  return canvas;
}
