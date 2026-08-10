/**
 * 假灵动岛 + Mask + 吐相布局 SSOT（设计坐标 390×844）。
 */

export type PrintLayout = {
  // —— 岛 ——
  /** 岛上边缘 top */
  islandTop: number;
  islandCenterX: number;
  islandWidth: number;
  islandHeight: number;
  /** 上下半切割 0~1（相对岛高，0.5=正中） */
  seamRatio: number;
  /** 岛颜色 */
  islandColor: string;

  // —— Mask（出岛可见区，默认整屏宽）——
  maskWidth: number;
  /** Mask 左边缘；居中时 = (390-width)/2 */
  maskLeft: number;
  /**
   * Mask 顶边。
   * 若 maskFollowIslandTop=true，应用时强制 = islandTop。
   */
  maskTop: number;
  maskHeight: number;
  /** Mask 顶是否跟随岛上边缘 */
  maskFollowIslandTop: boolean;

  // —— 照片（出岛过程）——
  /** 出岛时视觉宽 / 岛宽 */
  phase1WidthRatio: number;
  /** 终点最大宽 */
  polaroidMaxWidth: number;
  finalCenterX: number;
  /** 终点 top（相纸中心），design px */
  finalTop: number;
  /** 终点旋转角 deg（负=逆时针） */
  finalRotateDeg: number;

  // —— 结算文案 / 再玩一次（绝对定位，中心点）——
  titleCenterX: number;
  titleCenterY: number;
  /** 「抓到了」字号 design px */
  titleFontSize: number;
  replayCenterX: number;
  replayCenterY: number;
  /** 「再玩一次」字号 design px */
  replayFontSize: number;
  /** 按钮最小高度 design px */
  replayMinHeight: number;
  /** 按钮最小宽度 design px */
  replayMinWidth: number;

  // —— 时间 ——
  slideOutMs: number;
  flyMs: number;
  /** = slide + fly，兼容 */
  ejectMs: number;
};

export const DEFAULT_PRINT_LAYOUT: PrintLayout = {
  islandTop: 10,
  islandCenterX: 195,
  islandWidth: 160,
  islandHeight: 36,
  seamRatio: 0.5,
  islandColor: '#000000',

  maskWidth: 390,
  maskLeft: 0,
  maskTop: 10,
  maskHeight: 834,
  maskFollowIslandTop: true,

  phase1WidthRatio: 0.75,
  polaroidMaxWidth: 330,
  finalCenterX: 195,
  finalTop: 385,
  finalRotateDeg: -6,

  titleCenterX: 195,
  titleCenterY: 166,
  titleFontSize: 40,
  replayCenterX: 195,
  replayCenterY: 653,
  replayFontSize: 22,
  replayMinHeight: 55,
  replayMinWidth: 212,

  slideOutMs: 1400,
  flyMs: 1100,
  ejectMs: 2500,
};

export const PRINT_LAYOUT: PrintLayout = { ...DEFAULT_PRINT_LAYOUT };

export function setPrintLayout(partial: Partial<PrintLayout>): void {
  Object.assign(PRINT_LAYOUT, partial);
  if (PRINT_LAYOUT.maskFollowIslandTop) {
    PRINT_LAYOUT.maskTop = PRINT_LAYOUT.islandTop;
  }
  // mask 高默认贴底（若跟随时）
  if (
    partial.islandTop != null ||
    partial.maskTop != null ||
    partial.maskFollowIslandTop != null
  ) {
    const top = PRINT_LAYOUT.maskFollowIslandTop
      ? PRINT_LAYOUT.islandTop
      : PRINT_LAYOUT.maskTop;
    if (partial.maskHeight == null && PRINT_LAYOUT.maskFollowIslandTop) {
      PRINT_LAYOUT.maskHeight = Math.max(40, 844 - top);
    }
  }
  PRINT_LAYOUT.ejectMs = PRINT_LAYOUT.slideOutMs + PRINT_LAYOUT.flyMs;
}

export function resetPrintLayout(): void {
  Object.assign(PRINT_LAYOUT, { ...DEFAULT_PRINT_LAYOUT });
}

/** 派生几何（拍照动画用） */
export function getPrintGeometry() {
  const L = PRINT_LAYOUT;
  const seamRatio = Math.min(0.95, Math.max(0.05, L.seamRatio));
  const topH = L.islandHeight * seamRatio;
  const botH = L.islandHeight - topH;
  const seamY = L.islandTop + topH;
  const islandBottom = L.islandTop + L.islandHeight;

  const maskTop = L.maskFollowIslandTop ? L.islandTop : L.maskTop;
  const maskLeft = L.maskLeft;
  const maskW = L.maskWidth;
  const maskH = L.maskHeight;

  const ratio = Math.min(1, Math.max(0.25, L.phase1WidthRatio));
  const phase1Scale = Math.min(1, (L.islandWidth * ratio) / L.polaroidMaxWidth);
  // 相纸总高（padding 12+36 + 方图）
  const cardH = (12 + L.polaroidMaxWidth + 36) * phase1Scale;

  // 相对 Mask 顶的 Y（相纸 top=0 在 clip 内）
  // 起点：整张在缝上方（相对 maskTop）
  const slideStartTy = seamY - maskTop - cardH;
  // 终点：顶边刚过岛底
  const slideEndTy = islandBottom - maskTop + 4;

  return {
    L,
    topH,
    botH,
    seamY,
    islandBottom,
    maskTop,
    maskLeft,
    maskW,
    maskH,
    phase1Scale,
    cardH,
    slideStartTy,
    slideEndTy,
    /** 阶段2 起点：相纸顶边 design Y */
    flyStartTop: islandBottom + 4,
    flyStartCX: L.islandCenterX,
    finalTop: L.finalTop,
    finalCX: L.finalCenterX,
  };
}

/** 写到元素 CSS 变量 */
export function applyPrintLayoutCss(el: HTMLElement = document.documentElement): void {
  if (PRINT_LAYOUT.maskFollowIslandTop) {
    PRINT_LAYOUT.maskTop = PRINT_LAYOUT.islandTop;
  }
  PRINT_LAYOUT.ejectMs = PRINT_LAYOUT.slideOutMs + PRINT_LAYOUT.flyMs;

  const g = getPrintGeometry();
  const { L } = g;

  el.style.setProperty('--print-island-top', `${L.islandTop}px`);
  el.style.setProperty('--print-island-cx', `${L.islandCenterX}px`);
  el.style.setProperty('--print-island-w', `${L.islandWidth}px`);
  el.style.setProperty('--print-island-h', `${L.islandHeight}px`);
  el.style.setProperty('--print-island-top-h', `${g.topH}px`);
  el.style.setProperty('--print-island-bot-h', `${g.botH}px`);
  el.style.setProperty('--print-island-bot-top', `${L.islandTop + g.topH}px`);
  el.style.setProperty('--print-seam-y', `${g.seamY}px`);
  el.style.setProperty('--print-island-bottom', `${g.islandBottom}px`);
  el.style.setProperty('--print-island-color', L.islandColor);

  el.style.setProperty('--print-mask-left', `${g.maskLeft}px`);
  el.style.setProperty('--print-mask-top', `${g.maskTop}px`);
  el.style.setProperty('--print-mask-w', `${g.maskW}px`);
  el.style.setProperty('--print-mask-h', `${g.maskH}px`);

  el.style.setProperty('--print-slide-ms', `${L.slideOutMs}ms`);
  el.style.setProperty('--print-fly-ms', `${L.flyMs}ms`);
  el.style.setProperty('--print-polaroid-w', `${L.polaroidMaxWidth}px`);
  el.style.setProperty('--print-phase1-scale', String(g.phase1Scale));
  el.style.setProperty('--print-phase1-card-h', `${g.cardH}px`);
  el.style.setProperty('--print-slide-start-ty', `${g.slideStartTy}px`);
  el.style.setProperty('--print-slide-end-ty', `${g.slideEndTy}px`);
  el.style.setProperty('--print-fly-start-top', `${g.flyStartTop}px`);
  el.style.setProperty('--print-fly-start-cx', `${g.flyStartCX}px`);
  el.style.setProperty('--print-final-top', `${g.finalTop}px`);
  el.style.setProperty('--print-final-cx', `${g.finalCX}px`);
  el.style.setProperty('--print-final-rot', `${L.finalRotateDeg}deg`);
  el.style.setProperty('--settle-title-x', `${L.titleCenterX}px`);
  el.style.setProperty('--settle-title-y', `${L.titleCenterY}px`);
  el.style.setProperty('--settle-title-size', `${L.titleFontSize}px`);
  el.style.setProperty('--settle-replay-x', `${L.replayCenterX}px`);
  el.style.setProperty('--settle-replay-y', `${L.replayCenterY}px`);
  el.style.setProperty('--settle-replay-font', `${L.replayFontSize}px`);
  el.style.setProperty('--settle-replay-h', `${L.replayMinHeight}px`);
  el.style.setProperty('--settle-replay-w', `${L.replayMinWidth}px`);
  // 内边距随按钮高度略缩放
  const py = Math.max(6, Math.round(L.replayMinHeight * 0.22));
  const px = Math.max(16, Math.round(L.replayMinWidth * 0.16));
  el.style.setProperty('--settle-replay-py', `${py}px`);
  el.style.setProperty('--settle-replay-px', `${px}px`);
}
