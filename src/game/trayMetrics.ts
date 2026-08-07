/**
 * 托盘几何（对齐 BlockBlast_2 tray-layout 思路，DOM 版）
 *
 * - 图标尺寸 = traySlotScale 定稿值，**不**为塞进一屏而缩小
 * - 内容窄于视口：pad 居中，scroll=0
 * - 内容宽于视口：可横滑，scroll ∈ [0, contentW - viewW]
 */

import { TRAY_LAYOUT } from './layout';
import { traySlotScalePercent } from './propStyle';
import { cellSize } from './layout';

/** 进入横滑的水平位移阈值（design px） */
export const TRAY_SCROLL_SLOP_PX = 12;
/** 横滑轴锁：absDx ≥ absDy * AXIS 才认横滑 */
export const TRAY_SCROLL_AXIS = 1.35;

export type TrayMetrics = {
  n: number;
  slotPx: number;
  gapPx: number;
  viewW: number;
  viewH: number;
  contentW: number;
  /** 内容居中时左侧空白（fits 时） */
  pad: number;
  fits: boolean;
  maxScroll: number;
};

/** 逻辑 scroll（design px，向左滚为正） */
let trayScrollX = 0;

export function getTrayScrollX(): number {
  return trayScrollX;
}

export function setTrayScrollX(x: number): void {
  trayScrollX = Number.isFinite(x) ? x : 0;
}

export function resetTrayScroll(): void {
  trayScrollX = 0;
}

export function clampTrayScroll(maxScroll: number): number {
  const hi = Math.max(0, maxScroll);
  trayScrollX = Math.min(hi, Math.max(0, trayScrollX));
  return trayScrollX;
}

export function preferredTraySlotPx(): number {
  const cs = cellSize();
  return Math.max(24, Math.round(cs * (traySlotScalePercent() / 100)));
}

export function preferredTrayGapPx(slotPx: number): number {
  return Math.max(4, Math.round(slotPx * 0.06));
}

/** 托盘内可见道具个数（按 count 展开） */
export function countTrayItems(
  tray: readonly { count: number }[],
): number {
  let n = 0;
  for (const t of tray) n += Math.max(0, t.count | 0);
  return n;
}

/**
 * @param n 槽数（展开后的道具数）
 * @param slotPx 固定图标边长；默认读 traySlotScale
 */
export function createTrayMetrics(
  n: number,
  slotPx: number = preferredTraySlotPx(),
  gapPx: number = preferredTrayGapPx(slotPx),
): TrayMetrics {
  const viewW = Math.max(1, TRAY_LAYOUT.width);
  const viewH = Math.max(1, TRAY_LAYOUT.height);
  const count = Math.max(0, n | 0);
  const slot = Math.max(24, slotPx);
  const gap = Math.max(0, gapPx);
  const contentW =
    count <= 0 ? 0 : count * slot + Math.max(0, count - 1) * gap;
  const fits = contentW <= viewW + 0.5;
  const pad = fits ? Math.max(0, (viewW - contentW) / 2) : 0;
  const maxScroll = fits ? 0 : Math.max(0, contentW - viewW);
  return {
    n: count,
    slotPx: slot,
    gapPx: gap,
    viewW,
    viewH,
    contentW,
    pad,
    fits,
    maxScroll,
  };
}

/** track 的 translateX：pad 居中 − scroll */
export function trayTrackOffsetX(m: TrayMetrics, scrollX: number): number {
  const s = Number.isFinite(scrollX) ? scrollX : 0;
  const clamped = Math.min(m.maxScroll, Math.max(0, s));
  return m.pad - clamped;
}
