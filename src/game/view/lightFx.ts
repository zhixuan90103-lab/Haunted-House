/**
 * 扫描光效（拿起手电时）
 *
 * 设计：
 * - 仅显示层：连接 light-beam.png + 光斑 light-glow.png
 * - 仅在 drag 手电时出现；放下清空
 * - 全设计空间 canvas，无 board-hit 裁切 / mask
 * - 顶层 z + mix-blend-mode: plus-lighter → 对背景 Additive
 * - 相对手电的位置/尺寸只读 VIEW_STYLE（与调参一致，不写死改关系）
 */

import { BOARD_LAYOUT, cellSize } from '../layout';
import { DELTA, Dir, type DragGhost } from '../types';
import { VIEW_STYLE } from '../viewStyle';

const LIGHT_GLOW_SRC = './light-glow.png';
const LIGHT_BEAM_SRC = './light-beam.png';

/** 与光斑同色 */
const LIGHT_FILTER = 'brightness(1.2) sepia(1) saturate(9) hue-rotate(3deg)';

const DESIGN_W = 390;
const DESIGN_H = 844;

const glowImg = new Image();
glowImg.src = LIGHT_GLOW_SRC;
const beamImg = new Image();
beamImg.src = LIGHT_BEAM_SRC;

export type FreeGlow = { designX: number; designY: number };

export type LightFxHandle = {
  canvas: HTMLCanvasElement;
  /** 布局（全屏 design，避免裁切） */
  layout: () => void;
  /** 拿起手电时画；否则清空 */
  paint: (drag: DragGhost | null, freeGlows: FreeGlow[]) => void;
  dispose: () => void;
};

/**
 * 光斑中心（连续）= 手电中心 + 朝向前/侧 + 固定 px
 * 关系只由 VIEW_STYLE 决定
 */
export function freeBeamSpot(
  designX: number,
  designY: number,
  facing: number,
): FreeGlow {
  const cs = cellSize();
  const f = ((facing % 4) + 4) % 4;
  const fwd = DELTA[f as Dir] ?? DELTA[Dir.N];
  const right = DELTA[((f + 1) % 4) as Dir];
  const { glowForward, glowSide, glowOffsetX, glowOffsetY } = VIEW_STYLE;
  return {
    designX:
      designX +
      fwd.dx * cs * glowForward +
      right.dx * cs * glowSide +
      glowOffsetX,
    designY:
      designY +
      fwd.dy * cs * glowForward +
      right.dy * cs * glowSide +
      glowOffsetY,
  };
}

function facingAngleRad(facing: number): number {
  const f = ((facing % 4) + 4) % 4;
  const fwd = DELTA[f as Dir] ?? DELTA[Dir.N];
  return Math.atan2(fwd.dy, fwd.dx);
}

/**
 * 连接开灯：位置/长度不变，仅宽度 0→满（中心向两侧变宽）。
 * 锚点 = 手电中心 + beamOffset（与调参一致）。
 */
function paintBeam(
  ctx: CanvasRenderingContext2D,
  lightX: number,
  lightY: number,
  facing: number,
  cell: number,
  openT: number,
): void {
  if (!beamImg.complete || beamImg.naturalWidth <= 0) return;
  const t = Math.max(0, Math.min(1, openT));
  if (t <= 0.001) return;

  const { beamWidth, beamLength, beamOffsetX, beamOffsetY, beamAlpha } =
    VIEW_STYLE;
  // 满宽 × openT；长度固定
  const thickness = cell * Math.max(0.05, beamWidth / 100) * t;
  const length = cell * Math.max(0.05, beamLength / 100);
  if (thickness < 0.5 || length < 1) return;

  // 位置不变（与调参一致）
  const cx = lightX + beamOffsetX;
  const cy = lightY + beamOffsetY;

  ctx.save();
  ctx.translate(cx, cy);
  // 与原先一致：素材 +90° 对齐朝向
  ctx.rotate(facingAngleRad(facing) + Math.PI / 2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = Math.max(0, Math.min(1, beamAlpha));
  ctx.filter = LIGHT_FILTER;
  // 中心锚定：宽变、长/位置不动
  ctx.drawImage(beamImg, -thickness / 2, -length / 2, thickness, length);
  ctx.restore();
}

/**
 * 光斑开灯：整体 scale 0→1（中心缩放）
 */
function paintGlow(
  ctx: CanvasRenderingContext2D,
  freeGlows: FreeGlow[],
  cell: number,
  openT: number,
): void {
  if (!glowImg.complete || glowImg.naturalWidth <= 0) return;
  if (freeGlows.length === 0) return;
  const t = Math.max(0, Math.min(1, openT));
  if (t <= 0.001) return;

  const base = cell * Math.max(0.4, VIEW_STYLE.glowSize / 100);
  const glowPx = base * t;
  const alpha = Math.max(0, Math.min(1, VIEW_STYLE.glowAlpha));

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alpha;
  ctx.filter = LIGHT_FILTER;
  for (const g of freeGlows) {
    ctx.drawImage(
      glowImg,
      g.designX - glowPx / 2,
      g.designY - glowPx / 2,
      glowPx,
      glowPx,
    );
  }
}

/**
 * 挂到 #ui-root：全 design 画布 + 顶层 Additive
 */
export function mountLightFx(uiRoot: HTMLElement): LightFxHandle {
  const canvas = document.createElement('canvas');
  canvas.className = 'board-light-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  uiRoot.append(canvas);

  const layout = () => {
    // 全设计空间，不被棋盘框裁切
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = `${DESIGN_W}px`;
    canvas.style.height = `${DESIGN_H}px`;
    void BOARD_LAYOUT; // 布局依赖由外部 apply 触发
  };

  const paint = (drag: DragGhost | null, freeGlows: FreeGlow[]) => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pw = Math.round(DESIGN_W * dpr);
    const ph = Math.round(DESIGN_H * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, DESIGN_W, DESIGN_H);

    // 仅拿起手电
    if (!drag || drag.type !== 'light') {
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      return;
    }

    const cell = cellSize();
    const openT = drag.openT ?? 1;
    // 连接：从手电端 scaleX；光斑：整体 scale
    paintBeam(ctx, drag.designX, drag.designY, drag.facing, cell, openT);
    paintGlow(ctx, freeGlows, cell, openT);

    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  layout();

  const onReady = () => {
    /* 图片就绪后由外部下一次 paint 刷新 */
  };
  glowImg.onload = onReady;
  beamImg.onload = onReady;

  return {
    canvas,
    layout,
    paint,
    dispose: () => canvas.remove(),
  };
}
