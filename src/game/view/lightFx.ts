/**
 * 光效层（扫描 + 放置发射）
 *
 * 设计（A1）：
 * - **拖灯全程同一套跟手照射**：beam/glow 锚 designX/Y，长度 = 朝向障碍/盘边
 * - 未找全鬼：短距固定 glowForward×格；找全后：≤ glowForwardLong×格（近墙再截）
 * - 可放：仅多 snap 框；落盘后才切「格心放置光」
 * - 全 design canvas；mix-blend-mode: plus-lighter → 对背景 Additive
 */

import {
  BOARD_LAYOUT,
  cellSize,
  cellToDesignCenter,
  designToCell,
} from '../layout';
import {
  DELTA,
  Dir,
  type DirValue,
  type DragGhost,
  type Occupant,
} from '../types';
import { VIEW_STYLE } from '../viewStyle';

const LIGHT_GLOW_SRC = './light-glow.png';
const LIGHT_BEAM_SRC = './light-beam.png';
const SNAP_FRAME_SRC = './snap-frame.png';

/** 与光斑同色 */
const LIGHT_FILTER = 'brightness(1.2) sepia(1) saturate(9) hue-rotate(3deg)';

const DESIGN_W = 390;
const DESIGN_H = 844;

const glowImg = new Image();
glowImg.src = LIGHT_GLOW_SRC;
const beamImg = new Image();
beamImg.src = LIGHT_BEAM_SRC;
const snapImg = new Image();
snapImg.src = SNAP_FRAME_SRC;

export type FreeGlow = { designX: number; designY: number };

/** 盘上已放置的光源 + 折线路径（含镜） */
export type PlacedLightFx = {
  x: number;
  y: number;
  facing: DirValue;
  /** 折线段（格点：灯/镜 → 尽头亮格或下一镜） */
  segments: Array<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }>;
  /** 光斑：最后一段尽头亮格 */
  endX: number | null;
  endY: number | null;
  litCount: number;
};

export type LightFxPaintInput = {
  drag: DragGhost | null;
  freeGlows: FreeGlow[];
  /** 盘上 light 发射（不含正被拖起的那盏） */
  placedLights: PlacedLightFx[];
  /**
   * 可放格预览：拖灯且合法吸附时，按该格+朝向画完整折线光（动态长度/光斑）
   */
  previewLight: PlacedLightFx | null;
};

export type LightFxHandle = {
  canvas: HTMLCanvasElement;
  /** 布局（全屏 design，避免裁切） */
  layout: () => void;
  /** 扫描 + 放置发射；无内容时清空 */
  paint: (input: LightFxPaintInput) => void;
  dispose: () => void;
};

/**
 * 画布旋转角：与 paintBeam 一致（DELTA 朝向 + 素材 +90°）。
 * facing N → 0，E → π/2，S → π，W → -π/2|3π/2
 */
function facingDrawAngleRad(facing: number): number {
  const f = ((facing % 4) + 4) % 4;
  const fwd = DELTA[f as Dir] ?? DELTA[Dir.N];
  return Math.atan2(fwd.dy, fwd.dx) + Math.PI / 2;
}

/**
 * 将「朝北/默认」下调的本地偏移转到当前朝向。
 * 旧实现把 beamOffset / glowOffset 当屏幕坐标，旋转后再拿起会偏。
 */
function rotateLocalOffset(
  ox: number,
  oy: number,
  facing: number,
): { x: number; y: number } {
  const ang = facingDrawAngleRad(facing);
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return {
    x: ox * c - oy * s,
    y: ox * s + oy * c,
  };
}

/**
 * 光斑中心（连续）= 手电中心 + 朝向前/侧 + 本地 px 偏移（随 facing 旋转）
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
  const off = rotateLocalOffset(glowOffsetX, glowOffsetY, facing);
  return {
    designX:
      designX +
      fwd.dx * cs * glowForward +
      right.dx * cs * glowSide +
      off.x,
    designY:
      designY +
      fwd.dy * cs * glowForward +
      right.dy * cs * glowSide +
      off.y,
  };
}

/**
 * 光斑跟手、**不吸附格心**：始终沿 facing 连续偏移。
 * lengthPx = 灯心→光斑沿朝向的距离（由光路算出标量，不朝格心拉）。
 */
export function freeBeamSpotWithLengthPx(
  designX: number,
  designY: number,
  facing: number,
  lengthPx: number,
): FreeGlow {
  const cs = cellSize();
  const f = ((facing % 4) + 4) % 4;
  const fwd = DELTA[f as Dir] ?? DELTA[Dir.N];
  const right = DELTA[((f + 1) % 4) as Dir];
  const { glowSide, glowOffsetX, glowOffsetY } = VIEW_STYLE;
  const off = rotateLocalOffset(glowOffsetX, glowOffsetY, facing);
  const len = Math.max(0, lengthPx);
  return {
    designX:
      designX +
      fwd.dx * len +
      right.dx * cs * glowSide +
      off.x,
    designY:
      designY +
      fwd.dy * len +
      right.dy * cs * glowSide +
      off.y,
  };
}

/**
 * A1 跟手照射长度（px）：从灯心沿 facing。
 * - longRange=false（扫鬼）：**固定** glowForward×格，不因墙/道具/位置变短变长
 * - longRange=true（找全后）：可随障碍略变长，但 **≤ glowForwardLong×格**，
 *   避免光斑贴到远墙导致横移不像跟手
 */
export function freeShineLengthPx(opts: {
  lightX: number;
  lightY: number;
  facing: number;
  width: number;
  height: number;
  get: (x: number, y: number) => Occupant;
  longRange: boolean;
}): number {
  const { lightX, lightY, facing, width, height, get, longRange } = opts;
  const cs = cellSize();
  const shortCap = cs * Math.max(0.25, VIEW_STYLE.glowForward);
  const longCap = cs * Math.max(VIEW_STYLE.glowForward, VIEW_STYLE.glowForwardLong);

  // 扫鬼阶段：视觉长度恒定，不读障碍
  if (!longRange) return shortCap;

  const f = ((facing % 4) + 4) % 4;
  const fwd = DELTA[f as Dir] ?? DELTA[Dir.N];

  const { left, top, size } = BOARD_LAYOUT;
  let edgeMax = 0;
  if (fwd.dx > 0) edgeMax = left + size - lightX;
  else if (fwd.dx < 0) edgeMax = lightX - left;
  else if (fwd.dy > 0) edgeMax = top + size - lightY;
  else if (fwd.dy < 0) edgeMax = lightY - top;
  edgeMax = Math.max(0, edgeMax);

  const start = designToCell(lightX, lightY);
  let envLen = edgeMax;

  if (start) {
    let x = start.x;
    let y = start.y;
    let lastEnd: { x: number; y: number } | null = null;
    for (;;) {
      const nx = x + fwd.dx;
      const ny = y + fwd.dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) break;
      const occ = get(nx, ny);
      if (occ?.kind === 'wall') break;
      if (occ?.kind === 'prop') {
        lastEnd = { x: nx, y: ny };
        break;
      }
      // 空 / 鬼：可穿透继续
      lastEnd = { x: nx, y: ny };
      x = nx;
      y = ny;
    }
    if (lastEnd) {
      const end = cellToDesignCenter(lastEnd.x, lastEnd.y);
      const proj =
        (end.dx - lightX) * fwd.dx + (end.dy - lightY) * fwd.dy;
      envLen = Math.max(0, Math.min(proj, edgeMax));
    }
  }

  // 找全后仍跟手：长度 ≤ longCap；近墙时再被 env 截短
  return Math.min(envLen, longCap);
}

/**
 * 连接光绘制约定（扫描 + 放置共用）：
 * - **锚点 = 灯头节点**（灯心 + 朝向本地 beamOffset），不是贴图中心
 * - 贴图沿本地 -Y（前方）从锚点画出，**长度/宽度缩放不移动锚点**
 * - 避免中点锚定导致半截 beam 盖住手电、改长度时两端漂移
 */
function paintBeamFromPivot(
  ctx: CanvasRenderingContext2D,
  pivotX: number,
  pivotY: number,
  angleRad: number,
  thickness: number,
  length: number,
  alpha: number,
): void {
  if (thickness < 0.5 || length < 1) return;
  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(angleRad);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.filter = LIGHT_FILTER;
  // 锚点在近端：y=0 → y=-length（前方），宽以 x=0 对称
  ctx.drawImage(beamImg, -thickness / 2, -length, thickness, length);
  ctx.restore();
}

/** 灯心 + 朝向本地 offset → 世界坐标灯头锚点 */
function beamPivotWorld(
  lightX: number,
  lightY: number,
  facing: number,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } {
  const off = rotateLocalOffset(offsetX, offsetY, facing);
  return { x: lightX + off.x, y: lightY + off.y };
}

/**
 * 扫描/拿起连接：锚 = beamOffset*（默认 Y=-35），长度 = beamLength% 格。
 */
function paintBeam(
  ctx: CanvasRenderingContext2D,
  lightX: number,
  lightY: number,
  facing: number,
  cell: number,
  openT: number,
  lengthPx?: number,
): void {
  if (!beamImg.complete || beamImg.naturalWidth <= 0) return;
  const t = Math.max(0, Math.min(1, openT));
  if (t <= 0.001) return;

  const { beamWidth, beamLength, beamOffsetX, beamOffsetY, beamAlpha } =
    VIEW_STYLE;
  const thickness = cell * Math.max(0.05, beamWidth / 100) * t;
  const length =
    lengthPx != null && lengthPx > 0
      ? lengthPx
      : cell * Math.max(0.05, beamLength / 100);
  const pivot = beamPivotWorld(
    lightX,
    lightY,
    facing,
    beamOffsetX,
    beamOffsetY,
  );
  paintBeamFromPivot(
    ctx,
    pivot.x,
    pivot.y,
    facingDrawAngleRad(facing),
    thickness,
    length,
    beamAlpha,
  );
}

/**
 * 长光：灯心 + offset → 尽头；长度 = 灯头→尽头 × beamPlacedLengthScale%。
 * @param pivotOffset 默认放下锚点；拖灯跟手预览传 beamOffset*
 */
function paintBeamToEnd(
  ctx: CanvasRenderingContext2D,
  lightX: number,
  lightY: number,
  endX: number,
  endY: number,
  facing: number,
  cell: number,
  openT: number,
  pivotOffset?: { x: number; y: number },
  widthPct?: number,
): void {
  if (!beamImg.complete || beamImg.naturalWidth <= 0) return;
  const t = Math.max(0, Math.min(1, openT));
  if (t <= 0.001) return;

  const {
    beamPlacedWidth,
    beamPlacedOffsetX,
    beamPlacedOffsetY,
    beamPlacedLengthScale,
    beamAlpha,
  } = VIEW_STYLE;
  const ox = pivotOffset?.x ?? beamPlacedOffsetX;
  const oy = pivotOffset?.y ?? beamPlacedOffsetY;
  const pivot = beamPivotWorld(lightX, lightY, facing, ox, oy);
  const dx = endX - pivot.x;
  const dy = endY - pivot.y;
  const fullLen = Math.hypot(dx, dy);
  if (fullLen < 1) return;

  const scale = Math.max(0.05, beamPlacedLengthScale / 100);
  const length = fullLen * scale;
  const wPct = widthPct ?? beamPlacedWidth;
  const thickness = cell * Math.max(0.05, wPct / 100) * t;
  // 朝向仍指向尽头；长度可缩短（scale<1 时远端不到格心）
  const ang = Math.atan2(dy, dx) + Math.PI / 2;
  paintBeamFromPivot(
    ctx,
    pivot.x,
    pivot.y,
    ang,
    thickness,
    length,
    beamAlpha,
  );
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
 * 可落格吸附框：与光斑同 canvas（CSS plus-lighter → 对棋盘/背景 Additive）
 * 尺寸/透明度：VIEW_STYLE.snapSize / snapAlpha
 */
function paintSnapFrame(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  cell: number,
): void {
  if (!snapImg.complete || snapImg.naturalWidth <= 0) return;
  const alpha = Math.max(0, Math.min(1, VIEW_STYLE.snapAlpha));
  if (alpha <= 0.001) return;
  const size = cell * Math.max(0.2, VIEW_STYLE.snapSize / 100);
  if (size < 2) return;
  const { dx, dy } = cellToDesignCenter(cellX, cellY);

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alpha;
  // 略提亮，Additive 层上更接近光效质感
  ctx.filter = 'brightness(1.15)';
  ctx.drawImage(snapImg, dx - size / 2, dy - size / 2, size, size);
}

/** 棋盘外框（design），用于放置态光效裁剪 */
function boardClipRect(): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const { left, top, size } = BOARD_LAYOUT;
  return { x: left, y: top, w: size, h: size };
}

/**
 * 在棋盘矩形内绘制；放置光斑/长 beam 不得画出盘外。
 */
function withBoardClip(
  ctx: CanvasRenderingContext2D,
  draw: () => void,
): void {
  const r = boardClipRect();
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  draw();
  ctx.restore();
}

/**
 * 盘上已放灯：折线段 beam（可经镜）+ 尽头光斑；锚在格心。
 * 整体 clip 在棋盘内，光斑/超长 beam 不超出棋盘。
 */
function paintPlacedLight(
  ctx: CanvasRenderingContext2D,
  light: PlacedLightFx,
  cell: number,
  openT: number = 1,
): void {
  if (light.segments.length === 0) return;
  const t = Math.max(0, Math.min(1, openT));
  if (t <= 0.001) return;

  withBoardClip(ctx, () => {
    for (let i = 0; i < light.segments.length; i++) {
      const seg = light.segments[i]!;
      const from = cellToDesignCenter(seg.fromX, seg.fromY);
      const to = cellToDesignCenter(seg.toX, seg.toY);
      const fdx = seg.toX - seg.fromX;
      const fdy = seg.toY - seg.fromY;
      let facing = light.facing;
      if (Math.abs(fdx) + Math.abs(fdy) > 0) {
        if (fdx > 0) facing = 1;
        else if (fdx < 0) facing = 3;
        else if (fdy > 0) facing = 2;
        else facing = 0;
      }
      if (i === 0) {
        paintBeamToEnd(
          ctx,
          from.dx,
          from.dy,
          to.dx,
          to.dy,
          facing as DirValue,
          cell,
          t,
        );
      } else {
        paintBeamSegmentCenters(ctx, from.dx, from.dy, to.dx, to.dy, cell, t);
      }
    }

    if (light.endX != null && light.endY != null) {
      const to = cellToDesignCenter(light.endX, light.endY);
      paintGlow(ctx, [{ designX: to.dx, designY: to.dy }], cell, t);
    }
  });
}

/** 镜后折线段：格心→格心，无灯头 offset */
function paintBeamSegmentCenters(
  ctx: CanvasRenderingContext2D,
  lightX: number,
  lightY: number,
  endX: number,
  endY: number,
  cell: number,
  openT: number,
): void {
  if (!beamImg.complete || beamImg.naturalWidth <= 0) return;
  const t = Math.max(0, Math.min(1, openT));
  if (t <= 0.001) return;
  const dx = endX - lightX;
  const dy = endY - lightY;
  const fullLen = Math.hypot(dx, dy);
  if (fullLen < 1) return;
  const scale = Math.max(0.05, VIEW_STYLE.beamPlacedLengthScale / 100);
  const length = fullLen * scale;
  const thickness =
    cell * Math.max(0.05, VIEW_STYLE.beamPlacedWidth / 100) * t;
  const ang = Math.atan2(dy, dx) + Math.PI / 2;
  paintBeamFromPivot(
    ctx,
    lightX,
    lightY,
    ang,
    thickness,
    length,
    VIEW_STYLE.beamAlpha,
  );
}

/**
 * 挂到 #ui-root：全 design 画布 + Additive（低于 drag-layer）
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

  const paint = (input: LightFxPaintInput) => {
    const { drag, freeGlows, placedLights, previewLight } = input;
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

    const cell = cellSize();
    const scanning = drag?.type === 'light';
    const openT = drag?.openT ?? 1;

    // 1) 盘上已放手电
    for (const L of placedLights) {
      paintPlacedLight(ctx, L, cell, 1);
    }

    // 2) 拖灯 A1：始终跟手一套；可放只加 snap；长度已在 freeGlows 里
    if (scanning && drag) {
      if (drag.cell) {
        paintSnapFrame(ctx, drag.cell.x, drag.cell.y, cell);
      }
      // 连接长度 = 灯心→光斑（与 freeGlow 一致）
      let beamLen: number | undefined;
      const g0 = freeGlows[0];
      if (g0) {
        const f = ((drag.facing % 4) + 4) % 4;
        const fwd = DELTA[f as Dir] ?? DELTA[Dir.N];
        beamLen =
          (g0.designX - drag.designX) * fwd.dx +
          (g0.designY - drag.designY) * fwd.dy;
        if (beamLen < 1) beamLen = undefined;
      }
      paintBeam(
        ctx,
        drag.designX,
        drag.designY,
        drag.facing,
        cell,
        openT,
        beamLen,
      );
      paintGlow(ctx, freeGlows, cell, openT);
    }
    // previewLight 仅逻辑/落盘用，拖灯绘制不读（A1）
    void previewLight;

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
  snapImg.onload = onReady;

  return {
    canvas,
    layout,
    paint,
    dispose: () => canvas.remove(),
  };
}
