/**
 * Capture board region for polaroid.
 * Mobile: 轻量合成优先，避免长时间卡死感。
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

function isMobileLike(): boolean {
  try {
    if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      return true;
    }
    if (typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth < 520) {
      return true;
    }
  } catch {
    /* */
  }
  return false;
}

function captureDpr(): number {
  const raw = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
  // 手机限 1，大幅降低截屏耗时
  return isMobileLike() ? 1 : Math.min(raw, 2);
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

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`[capture] timeout ${label} ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
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

/**
 * 截屏时只藏取景框/按钮，保留 print 蒙黑与闪白，避免「整屏消失像卡死」。
 */
async function withChromeHiddenForCapture<T>(
  uiRoot: HTMLElement,
  fn: () => Promise<T>,
): Promise<T> {
  uiRoot.classList.add('is-dom-capturing');
  const lights = uiRoot.querySelectorAll<HTMLCanvasElement>('.board-light-canvas');
  const prevBlend: string[] = [];
  lights.forEach((c) => {
    prevBlend.push(c.style.mixBlendMode);
    c.style.mixBlendMode = 'screen';
  });
  await waitFrames(1);
  try {
    return await fn();
  } finally {
    lights.forEach((c, i) => {
      c.style.mixBlendMode = prevBlend[i] ?? '';
    });
    uiRoot.classList.remove('is-dom-capturing');
  }
}

async function tryDomToCanvas(
  el: HTMLElement,
  opts: { width?: number; height?: number; bgcolor?: string | null },
): Promise<HTMLCanvasElement | null> {
  const dpr = captureDpr();
  try {
    const { domToCanvas } = await import('modern-screenshot');
    const canvas = await withTimeout(
      domToCanvas(el, {
        scale: dpr,
        width: opts.width,
        height: opts.height,
        backgroundColor: opts.bgcolor ?? undefined,
        style: { transform: 'none', margin: '0' },
      }),
      isMobileLike() ? 2000 : 4000,
      'domToCanvas',
    );
    if (canvas && canvas.width > 8 && !isMostlyBlack(canvas)) return canvas;
  } catch (e) {
    console.warn('[capture] modern-screenshot failed', e);
  }
  // 手机跳过 snapdom 二次尝试（慢）
  if (isMobileLike()) return null;
  try {
    const { snapdom } = await import('@zumer/snapdom');
    const canvas = await withTimeout(
      snapdom.toCanvas(el, {
        dpr,
        scale: 1,
        backgroundColor: opts.bgcolor ?? undefined,
        outerTransforms: false,
        fast: true,
      }),
      3000,
      'snapdom',
    );
    if (canvas && canvas.width > 8 && !isMostlyBlack(canvas)) return canvas;
  } catch (e) {
    console.warn('[capture] snapdom failed', e);
  }
  return null;
}

/** 轻量合成：bg + sprites + light（手机主路径） */
async function compositeCapture(
  uiRoot: HTMLElement,
  rect: CaptureRect,
): Promise<string> {
  const dpr = captureDpr();
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(rect.width * dpr));
  out.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = out.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#1a1520';
  ctx.fillRect(0, 0, rect.width, rect.height);

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

  // 优先直接画 DOM 里的 img（比整板 dom-to-canvas 快）
  await drawDomSprites(ctx, uiRoot, rect);

  // 桌面再尝试整板一次提升道具一致性；手机跳过
  if (!isMobileLike()) {
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
      }
    }
  }

  const light = uiRoot.querySelector('.board-light-canvas') as HTMLCanvasElement | null;
  if (light && light.width > 0 && light.height > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
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

/** 读取 CSS transform 旋转角（度）。手电/镜朝向在 img 上 rotate。 */
function cssRotationDeg(el: Element): number {
  try {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 0;
    const m2 = /^matrix\((.+)\)$/.exec(t);
    if (m2) {
      const p = m2[1].split(',').map((x) => Number(x.trim()));
      if (p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
        return (Math.atan2(p[1], p[0]) * 180) / Math.PI;
      }
    }
    const m3 = /^matrix3d\((.+)\)$/.exec(t);
    if (m3) {
      const p = m3[1].split(',').map((x) => Number(x.trim()));
      // matrix3d: a00=p[0], a10=p[1]
      if (p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
        return (Math.atan2(p[1], p[0]) * 180) / Math.PI;
      }
    }
    const rot = /rotate\(([-\d.]+)deg\)/.exec(
      (el as HTMLElement).style?.transform ?? '',
    );
    if (rot) return Number(rot[1]) || 0;
  } catch {
    /* */
  }
  return 0;
}

/**
 * 画带 CSS 旋转的图：中心对齐 AABB 中心，按未旋转 layout 尺寸 + rotate。
 * 旧逻辑直接 drawImage 会丢掉 img 上的 rotate，导致合影手电朝向错误。
 */
function drawImageWithCssRotate(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  centerX: number,
  centerY: number,
  drawW: number,
  drawH: number,
  deg: number,
): void {
  ctx.save();
  ctx.translate(centerX, centerY);
  if (deg !== 0) ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}

async function drawDomSprites(
  ctx: CanvasRenderingContext2D,
  uiRoot: HTMLElement,
  rect: CaptureRect,
): Promise<void> {
  const rootR = uiRoot.getBoundingClientRect();
  const scale = rootR.width / 390 || 1;

  // 道具：画 .prop-sprite > img（带 rotate）；鬼/墙同理
  const nodes = uiRoot.querySelectorAll<HTMLElement>(
    '#board-hit .prop-sprite img, #board-hit .wall-mark, .board-ghost-layer img, .board-ghost-layer .ghost-base, .board-ghost-layer .ghost-lit-add',
  );

  for (const node of nodes) {
    const r = node.getBoundingClientRect();
    // AABB 中心（设计坐标，相对 capture rect）
    const cx = (r.left + r.width / 2 - rootR.left) / scale - rect.x;
    const cy = (r.top + r.height / 2 - rootR.top) / scale - rect.y;

    // 未旋转时的逻辑尺寸（offset 不受 rotate 影响，更准）
    const layoutW = Math.max(1, node.offsetWidth || r.width / scale);
    const layoutH = Math.max(1, node.offsetHeight || r.height / scale);
    // offset 在 stage scale 前是 design px；若被浏览器当成 CSS px 与 scale 一致
    // 视觉尺寸 ≈ getBoundingClientRect / scale 对未旋转元素；旋转后 AABB 变大
    // 优先 offsetWidth；若异常再用 unrotated estimate
    const dw = layoutW > 0 ? layoutW : r.width / scale;
    const dh = layoutH > 0 ? layoutH : r.height / scale;
    if (dw < 1 || dh < 1) continue;

    if (node instanceof HTMLImageElement && node.naturalWidth > 0) {
      try {
        const deg = cssRotationDeg(node);
        drawImageWithCssRotate(ctx, node, cx, cy, dw, dh, deg);
      } catch {
        /* */
      }
      continue;
    }
    const img = node.querySelector('img');
    if (img && img.naturalWidth > 0) {
      try {
        const deg = cssRotationDeg(img) || cssRotationDeg(node);
        drawImageWithCssRotate(ctx, img, cx, cy, dw, dh, deg);
      } catch {
        /* */
      }
    }
  }
}

/**
 * Capture board area as PNG data URL.
 * 手机：直接轻量合成（秒级内）；桌面：可尝试更高质量路径。
 */
export async function captureBoardDataUrl(uiRoot: HTMLElement): Promise<string> {
  const rect = boardCaptureRect();
  return withChromeHiddenForCapture(uiRoot, async () => {
    // 主路径：合成（手机友好）
    try {
      const url = await withTimeout(
        compositeCapture(uiRoot, rect),
        isMobileLike() ? 2800 : 5000,
        'composite',
      );
      if (url && url.length > 64) return url;
    } catch (e) {
      console.warn('[capture] composite failed', e);
    }

    // 桌面兜底：整板库
    if (!isMobileLike()) {
      try {
        const { domToCanvas } = await import('modern-screenshot');
        const dpr = captureDpr();
        const full = await withTimeout(
          domToCanvas(uiRoot, {
            scale: dpr,
            width: 390,
            height: 844,
            backgroundColor: '#0b1020',
            filter: (el) => {
              if (!(el instanceof Element)) return true;
              if (el.closest?.('.camera-session')) return false;
              if (
                el.closest?.(
                  '#prop-tuner, #haptic-tuner, #prop-tuner-fab, #haptic-tuner-fab, #island-tuner-fab, #island-tuner, #settle-tuner, #settle-tuner-fab, .settle-tuner, .settle-tuner-fab, .settle-tuner-wrap',
                )
              )
                return false;
              if (el.closest?.('#tray, .game-tray, #drag-layer, .game-hud')) return false;
              return true;
            },
            style: { transform: 'none' },
          }),
          4000,
          'full-root',
        );
        if (full && !isMostlyBlack(full)) {
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
    }

    // 最后兜底：纯色 + 尽量画 sprites
    try {
      return await compositeCapture(uiRoot, rect);
    } catch {
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 200;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#1a1520';
      ctx.fillRect(0, 0, 200, 200);
      return c.toDataURL('image/png');
    }
  });
}
