/**
 * 拖拽会话 · 手感2 only
 * 锚点中心 + 固定抬升 + 指移积分 × K + 短视觉平滑 + 拿起放大
 */

import { FEEL } from './defaults';

export type DragSession = {
  targetCx: number;
  targetCy: number;
  frameCx: number;
  frameCy: number;
  baseCx: number;
  baseCy: number;
  accX: number;
  accY: number;
  startFx: number;
  startFy: number;
  lastFx: number;
  lastFy: number;
  lastT: number;
  smoothLastT: number;
  snapVisualOnce: boolean;
  cell: number;
  extraLiftCells: number;
  /**
   * 平面尺度：拿起即满尺寸（手电本体不缩）
   */
  scale: number;
  scaleTarget: number;
  scaleFrom: number;
  scaleStartedAt: number;
  /**
   * 开灯动画进度 0→1：
   * 光斑 = 整体 scale；连接 = 沿长度从手电端 scaleX
   */
  openT: number;
  /** 盘上拖动目标边长（design px），含 light 比例与 pop */
  dragSizePx: number;
};

export type CreateDragSessionOpts = {
  anchorCx: number;
  anchorCy: number;
  fx: number;
  fy: number;
  cell: number;
  /** 保留字段：曾用于托盘缩放动画，现已取消 */
  fromTray: boolean;
  /** 盘上拖动边长（已算好：cell * boardScale * light * pop） */
  dragSizePx: number;
};

export function createDragSession(opts: CreateDragSessionOpts): DragSession {
  const { anchorCx, anchorCy, fx, fy, cell, dragSizePx } = opts;
  const baseCx = anchorCx + FEEL.DRAG_OFFSET_X * cell;
  const baseCy = anchorCy + FEEL.DRAG_OFFSET_Y_MIN * cell;
  const now = performance.now();
  // 手电本体瞬间满尺寸；光效 openT 0→1 快速开灯
  const scaleTarget = FEEL.BOARD_SCALE; // 1.0
  return {
    baseCx,
    baseCy,
    accX: 0,
    accY: 0,
    targetCx: baseCx,
    targetCy: baseCy,
    frameCx: baseCx,
    frameCy: baseCy,
    startFx: fx,
    startFy: fy,
    lastFx: fx,
    lastFy: fy,
    lastT: now,
    smoothLastT: now,
    snapVisualOnce: true,
    cell,
    extraLiftCells: 0,
    scale: scaleTarget,
    scaleFrom: scaleTarget,
    scaleTarget,
    scaleStartedAt: now,
    openT: 0,
    dragSizePx,
  };
}

function gainK(): number {
  const k = FEEL.POINTER_GAIN_K;
  return typeof k === 'number' && k > 0 ? k : 1;
}

function tickScale(session: DragSession, now: number): void {
  session.scale = session.scaleTarget;
  // 开灯进度 0 → 1，ease-out，较快
  const ms = Math.max(1, FEEL.LIGHT_OPEN_MS);
  const t = Math.min(1, (now - session.scaleStartedAt) / ms);
  session.openT = 1 - (1 - t) * (1 - t);
}

export function samplePointer(session: DragSession, fx: number, fy: number): void {
  const now = performance.now();
  const dx = fx - session.lastFx;
  const dy = fy - session.lastFy;
  const gain = gainK();

  session.accX += dx * gain;
  session.accY += dy * gain;
  session.lastFx = fx;
  session.lastFy = fy;
  session.lastT = now;

  const cell = session.cell;
  const upCells = Math.max(0, (session.startFy - fy) / cell);
  const range = FEEL.DRAG_LIFT_TRAVEL_CELLS;
  const tRaw = range > 0 ? upCells / range : 1;
  const t = Math.min(1, Math.max(0, tRaw));
  const power = FEEL.DRAG_LIFT_POWER;
  const eased = t === 0 ? 0 : t === 1 ? 1 : t ** power;
  session.extraLiftCells =
    (FEEL.DRAG_OFFSET_Y_MAX - FEEL.DRAG_OFFSET_Y_MIN) * eased;

  session.targetCx = session.baseCx + session.accX;
  session.targetCy =
    session.baseCy + session.accY + session.extraLiftCells * cell;

  tickScale(session, now);
}

export function chaseTargetOnPointer(session: DragSession): void {
  tickScale(session, performance.now());
  const tau = Math.max(0, FEEL.SMOOTH_TIME);
  if (tau <= 0.0005 || session.snapVisualOnce) {
    session.frameCx = session.targetCx;
    session.frameCy = session.targetCy;
    session.snapVisualOnce = false;
    return;
  }
  const k = Math.min(1, 1 - Math.exp(-0.016 / Math.max(0.004, tau * 0.45)));
  session.frameCx += (session.targetCx - session.frameCx) * k;
  session.frameCy += (session.targetCy - session.frameCy) * k;
}

export function tickSmooth(session: DragSession): void {
  const now = performance.now();
  tickScale(session, now);
  const dt = Math.min(
    0.05,
    Math.max(0.001, (now - session.smoothLastT) / 1000),
  );
  session.smoothLastT = now;

  const tau = Math.max(0, FEEL.SMOOTH_TIME);
  const tx = session.targetCx;
  const ty = session.targetCy;

  if (tau <= 0.0005) {
    session.frameCx = tx;
    session.frameCy = ty;
    return;
  }
  const k = 1 - Math.exp(-dt / tau);
  session.frameCx += (tx - session.frameCx) * k;
  session.frameCy += (ty - session.frameCy) * k;
  if (Math.hypot(tx - session.frameCx, ty - session.frameCy) < 0.35) {
    session.frameCx = tx;
    session.frameCy = ty;
  }
}

/** 盘上拖动目标边长 = cell × light比例 × pop */
export function computeDragSizePx(
  cell: number,
  lightBoardScalePercent: number,
  dragScale: number,
): number {
  const light = Math.max(0.4, lightBoardScalePercent / 100);
  const pop = FEEL.DRAG_SCALE_POP * Math.max(0.5, dragScale);
  return cell * FEEL.BOARD_SCALE * light * pop;
}
