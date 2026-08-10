/**
 * Capture board region for polaroid.
 * Hides camera chrome during capture; composites bg + board + light.
 */

import { BOARD_LAYOUT } from '../layout';

export const CAPTURE_PAD_Y = 28;
export const CAPTURE_PAD_X = 12;

export type CaptureRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function boardCaptureRect(): CaptureRect {
  const { left, top, size } = BOARD_LAYOUT;
  const x = Math.max(0, left - CAPTURE_PAD_X);
  const y = Math.max(0, top - CAPTURE_PAD_Y);
  return {
    x,
    y,
    width: Math.min(390 - x, size + CAPTURE_PAD_X * 2),
    height: Math.min(844 - y, size + CAPTURE_PAD_Y * 2),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`img load fail: ${src}`));
    img.src = src;
  });
}

function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    let left = n;
    const tick = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function isMostlyBlack(canvas: HTMLCanvasElement): boolean {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const w = Math.min(canvas.width, 48);
    const h = Math.min(canvas.height, 48);
    const sample = document.createElement('canvas');
    sample.width = w;
    sample.height = h;
    const sctx = sample.getContext('2d')!;
    sctx.drawImage(canvas, 0, 0, w, h);
    const data = sctx.getImageData(0, 0, w, h).data;
    let bright = 0;
    const n = w * h;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] > 48) bright++;
    }
    return bright / n < 0.03;
  } catch {
    return true;
  }
}

/** Temporarily hide camera UI so capture sees the game. */
async function withCameraHidden<T>(
  uiRoot: HTMLElement,
  fn: () => Promise<T>,
): Promise<T> {
  const cam = uiRoot.querySelector('.camera-session') as HTMLElement | null;
  const prev = cam?.getAttribute('style') ?? null;
  if (cam) {
    cam.style.setProperty('display', 'none', 'important');
    cam.style.setProperty('visibility', 'hidden', 'important');
    cam.style.setProperty('opacity', '0', 'important');
  }
  // Bake light blend for DOM capture
  const lights = uiRoot.querySelectorAll<HTMLCanvasElement>('.board-light-canvas');
  const prevBlend: string[] = [];
  lights.forEach((c) => {
    prevBlend.push(c.style.mixBlendMode);
    c.style.mixBlendMode = 'screen';
  });
  await waitFrames(2);
  try {
    return await fn();
  } finally {
    lights.forEach((c, i) => {
      c.style.mixBlendMode = prevBlend[i] ?? '';
    });
    if (cam) {
      if (prev == null) cam.removeAttribute('style');
      else cam.setAttribute('style', prev);
    }
  }
}

async function tryDomToCanvas(
  el: HTMLElement,
  opts: { width?: number; height?: number; bgcolor?: string | null },
): Promise<HTMLCanvasElement | null> {
  const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 2, 2);
  // modern-screenshot
  try {
    const { domToCanvas } = await import('modern-screenshot');
    const canvas = await domToCanvas(el, {
      scale: dpr,
      width: opts.width,
      height: opts.height,
      backgroundColor: opts.bgcolor ?? undefined,
      style: {
        // ensure design size while capturing
        transform: 'none',
        margin: '0',
      },
    });
    if (canvas && canvas.width > 8 && !isMostlyBlack(canvas)) return canvas;
  } catch (e) {
    console.warn('[capture] modern-screenshot failed', e);
  }
  // snapdom
  try {
    const { snapdom } = await import('@zumer/snapdom');
    const canvas = await snapdom.toCanvas(el, {
      dpr,
      scale: 1,
      backgroundColor: opts.bgcolor ?? undefined,
      outerTransforms: false,
      fast: true,
    });
    if (canvas && canvas.width > 8 && !isMostlyBlack(canvas)) return canvas;
  } catch (e) {
    console.warn('[capture] snapdom failed', e);
  }
  return null;
}

/**
 * Composite: stage bg crop + board DOM + light canvas.
 */
async function compositeCapture(
  uiRoot: HTMLElement,
  rect: CaptureRect,
): Promise<string> {
  const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 2, 2);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(rect.width * dpr));
  out.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = out.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#1a1520';
  ctx.fillRect(0, 0, rect.width, rect.height);

  // 1) Background
  const bg = uiRoot.querySelector('.stage-bg') as HTMLElement | null;
  if (bg) {
    const url = getComputedStyle(bg).backgroundImage;
    const m = /url\(["']?(.*?)["']?\)/.exec(url);
    if (m?.[1]) {
      try {
        const img = await loadImage(m[1].replace(/&quot;/g, ''));
        const scale = Math.max(390 / img.naturalWidth, 844 / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const ox = (390 - dw) / 2;
        const oy = 0;
        ctx.drawImage(
          img,
          (rect.x - ox) / scale,
          (rect.y - oy) / scale,
          rect.width / scale,
          rect.height / scale,
          0,
          0,
          rect.width,
          rect.height,
        );
      } catch {
        /* skip */
      }
    }
  }

  // 2) Board (grid + props + ghosts)
  const boardHit = uiRoot.querySelector('#board-hit') as HTMLElement | null;
  if (boardHit) {
    const piece = await tryDomToCanvas(boardHit, {
      width: BOARD_LAYOUT.size,
      height: BOARD_LAYOUT.size,
      bgcolor: null,
    });
    if (piece) {
      const padX = BOARD_LAYOUT.left - rect.x;
      const padY = BOARD_LAYOUT.top - rect.y;
      ctx.drawImage(piece, padX, padY, BOARD_LAYOUT.size, BOARD_LAYOUT.size);
    } else {
      // Manual ghost + prop draw from live DOM images
      await drawDomSprites(ctx, uiRoot, rect);
    }
  }

  // 3) Light canvas (design 390×844)
  const light = uiRoot.querySelector('.board-light-canvas') as HTMLCanvasElement | null;
  if (light && light.width > 0 && light.height > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    // light canvas CSS size is 390×844; bitmap may be 1:1 design px
    const srcW = light.width;
    const srcH = light.height;
    const sx = (rect.x / 390) * srcW;
    const sy = (rect.y / 844) * srcH;
    const sw = (rect.width / 390) * srcW;
    const sh = (rect.height / 844) * srcH;
    ctx.drawImage(light, sx, sy, sw, sh, 0, 0, rect.width, rect.height);
    ctx.restore();
  }

  return out.toDataURL('image/png');
}

async function drawDomSprites(
  ctx: CanvasRenderingContext2D,
  uiRoot: HTMLElement,
  rect: CaptureRect,
): Promise<void> {
  const rootR = uiRoot.getBoundingClientRect();
  const scale = rootR.width / 390 || 1;

  const nodes = uiRoot.querySelectorAll<HTMLElement>(
    '#board-hit img, #board-hit .wall-mark, .board-ghost-layer img, .board-ghost-layer .ghost-sprite',
  );

  for (const node of nodes) {
    const r = node.getBoundingClientRect();
    const dx = (r.left - rootR.left) / scale - rect.x;
    const dy = (r.top - rootR.top) / scale - rect.y;
    const dw = r.width / scale;
    const dh = r.height / scale;
    if (dw < 1 || dh < 1) continue;

    if (node instanceof HTMLImageElement && node.naturalWidth > 0) {
      try {
        ctx.drawImage(node, dx, dy, dw, dh);
      } catch {
        /* */
      }
      continue;
    }
    const img = node.querySelector('img');
    if (img && img.naturalWidth > 0) {
      try {
        ctx.drawImage(img, dx, dy, dw, dh);
      } catch {
        /* */
      }
    }
  }
}

/**
 * Capture board area as PNG data URL.
 */
export async function captureBoardDataUrl(uiRoot: HTMLElement): Promise<string> {
  const rect = boardCaptureRect();
  return withCameraHidden(uiRoot, async () => {
    // Full ui-root clip attempt (game only, chrome hidden)
    try {
      const { domToCanvas } = await import('modern-screenshot');
      const dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 2, 2);
      const full = await domToCanvas(uiRoot, {
        scale: dpr,
        width: 390,
        height: 844,
        backgroundColor: '#0b1020',
        filter: (el) => {
          if (!(el instanceof Element)) return true;
          if (el.closest?.('.camera-session')) return false;
          if (el.closest?.('#prop-tuner, #haptic-tuner, #prop-tuner-fab, #haptic-tuner-fab'))
            return false;
          if (el.closest?.('#tray, .game-tray, #drag-layer, .game-hud')) return false;
          return true;
        },
        style: { transform: 'none' },
      });
      if (full && !isMostlyBlack(full)) {
        // Crop to rect
        const out = document.createElement('canvas');
        out.width = Math.round(rect.width * dpr);
        out.height = Math.round(rect.height * dpr);
        const ctx = out.getContext('2d')!;
        ctx.drawImage(
          full,
          rect.x * dpr,
          rect.y * dpr,
          rect.width * dpr,
          rect.height * dpr,
          0,
          0,
          out.width,
          out.height,
        );
        if (!isMostlyBlack(out)) return out.toDataURL('image/png');
      }
    } catch (e) {
      console.warn('[capture] full root failed', e);
    }

    return compositeCapture(uiRoot, rect);
  });
}
