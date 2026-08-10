/**
 * 假灵动岛 + 吐相布局 SSOT（设计坐标 390×844）。
 * 调参面板写这里；cameraSession / CSS vars 读取。
 */

export type PrintLayout = {
  /** 岛顶边距 design px */
  islandTop: number;
  /** 岛水平中心 0–390（默认 195） */
  islandCenterX: number;
  /** 岛宽 */
  islandWidth: number;
  /** 岛高 */
  islandHeight: number;
  /** 阶段1：从岛缝滑出（定宽=岛宽）ms */
  slideOutMs: number;
  /** 阶段2：滑出后放大飞到终点 ms */
  flyMs: number;
  /** @deprecated 兼容旧调参，= slideOutMs + flyMs */
  ejectMs: number;
  /** 结算相纸垂直位置 %（相对舞台高度，用于 top） */
  finalTopPercent: number;
  /** 定稿相纸宽 design px */
  polaroidWidth: number;
  /**
   * 阶段1 视觉宽度占岛宽比例（0–1）。
   * 例如 0.55 → 出岛时比岛窄一截，更小。
   */
  phase1WidthRatio: number;
};

export const DEFAULT_PRINT_LAYOUT: PrintLayout = {
  islandTop: 48,
  islandCenterX: 195,
  islandWidth: 120,
  islandHeight: 36,
  /** 从 Mask 滑出 */
  slideOutMs: 1400,
  /** 飞向终点：稍长 + 缓动在 CSS/WAAPI */
  flyMs: 1100,
  ejectMs: 2500,
  finalTopPercent: 42,
  polaroidWidth: 220,
  /** 出岛时视觉宽 ≈ 岛宽 × 0.75 */
  phase1WidthRatio: 0.75,
};

export const PRINT_LAYOUT: PrintLayout = { ...DEFAULT_PRINT_LAYOUT };

export function setPrintLayout(partial: Partial<PrintLayout>): void {
  Object.assign(PRINT_LAYOUT, partial);
}

export function resetPrintLayout(): void {
  Object.assign(PRINT_LAYOUT, DEFAULT_PRINT_LAYOUT);
}

/** 写到元素 / :root 上的 CSS 变量 */
export function applyPrintLayoutCss(el: HTMLElement = document.documentElement): void {
  const L = PRINT_LAYOUT;
  // 若只改了 ejectMs，按比例拆两段；优先独立 slide/fly
  const slide = L.slideOutMs;
  const fly = L.flyMs;
  L.ejectMs = slide + fly;

  const islandHalf = L.islandHeight / 2;
  const seamY = L.islandTop + islandHalf;
  const islandBottom = L.islandTop + L.islandHeight;
  // 阶段1：更小，视觉宽 = 岛宽 * ratio（不超过岛）
  const ratio = Math.min(1, Math.max(0.25, L.phase1WidthRatio));
  const s = Math.min(1, (L.islandWidth * ratio) / L.polaroidWidth);
  // 相纸在阶段1 的总高（上12 + 图方 + 下36）* s
  const cardH = (12 + L.polaroidWidth + 36) * s;

  el.style.setProperty('--print-island-top', `${L.islandTop}px`);
  el.style.setProperty('--print-island-cx', `${L.islandCenterX}px`);
  el.style.setProperty('--print-island-w', `${L.islandWidth}px`);
  el.style.setProperty('--print-island-h', `${L.islandHeight}px`);
  el.style.setProperty('--print-island-half', `${islandHalf}px`);
  el.style.setProperty('--print-seam-y', `${seamY}px`);
  el.style.setProperty('--print-island-bottom', `${islandBottom}px`);
  el.style.setProperty('--print-slide-ms', `${slide}ms`);
  el.style.setProperty('--print-fly-ms', `${fly}ms`);
  el.style.setProperty('--print-polaroid-w', `${L.polaroidWidth}px`);
  el.style.setProperty('--print-phase1-scale', String(s));
  el.style.setProperty('--print-phase1-card-h', `${cardH}px`);
  // 裁切窗：从缝线向下，遮住仍在岛内/上方的部分
  el.style.setProperty('--print-clip-top', `${seamY}px`);
  el.style.setProperty(
    '--print-clip-h',
    `${Math.max(cardH + islandHalf + 24, 844 - seamY)}px`,
  );
  // 阶段1 结束（在 clip 内）：相纸顶边越过岛底 = 完全滑出
  // clip 顶 = seam，相纸 top=0 时 translateY = islandBottom - seam = islandHalf + 4
  el.style.setProperty(
    '--print-slide-end-ty',
    `${islandHalf + 4}px`,
  );
  // 阶段2 起点（挂回 printLayer 后的 design 坐标）
  el.style.setProperty(
    '--print-slide-end-top',
    `${islandBottom + 4}px`,
  );
  const finalTopPx = (L.finalTopPercent / 100) * 844;
  el.style.setProperty('--print-final-top', `${finalTopPx}px`);
  el.style.setProperty('--print-final-cx', `195px`);
}
