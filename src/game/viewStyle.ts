/** View / FX knobs (CSS vars + debug flags). */

import { cellSize } from './layout';

export type ViewStyle = {
  /**
   * 光斑大小：相对格子边长的百分比（100 = 一格宽）
   */
  glowSize: number;
  /** 光斑透明度 0–1 */
  glowAlpha: number;
  /**
   * 拖动手电时：光斑沿朝向的前移距离（格）
   * 扫鬼阶段固定用此值
   */
  glowForward: number;
  /**
   * 找全鬼后：光斑前移上限（格）。可大于 glowForward，但须有限，
   * 否则 env 拉到墙时光斑贴远墙、横移不像跟手。
   */
  glowForwardLong: number;
  /**
   * 拖动手电时：光斑相对朝向的侧移（格）
   * + = 朝向右侧；− = 左侧
   */
  glowSide: number;
  /** 额外 design px 偏移（不随朝向转） */
  glowOffsetX: number;
  glowOffsetY: number;
  /**
   * 连接条（纯显示）— light-beam.png，染色/Additive 与光斑一致
   * beamWidth / beamLength：仅**拿起/扫描**（宽% 格 · 长% 格）
   * beamOffsetX/Y：拿起灯头锚点（朝向本地 px）
   * beamPlacedWidth：放下连接宽% 格（独立可调）
   * beamPlacedOffsetX/Y：放下灯头锚点
   * beamPlacedLengthScale：放下长度 = 灯头→最远格 × 本值%（100=到尽头，可 >100）
   * beamAlpha：连接透明度 0–1（拿起/放下共用）
   */
  beamWidth: number;
  beamLength: number;
  beamOffsetX: number;
  beamOffsetY: number;
  beamPlacedWidth: number;
  beamPlacedOffsetX: number;
  beamPlacedOffsetY: number;
  beamPlacedLengthScale: number;
  beamAlpha: number;
  /**
   * 鬼（格内显示）
   * ghostSize：相对格子 %
   * ghostOffsetX / Y：格内偏移 px
   * 待机：幅度 px · 周期 ms · 挤压强度（0～0.15）
   */
  ghostSize: number;
  ghostOffsetX: number;
  ghostOffsetY: number;
  /**
   * 动态质心：transform-origin 的 Y（0=顶，50=中，100=底）
   * 待机挤压/拉伸绕此点，略低于中心更像身体重心
   */
  ghostPivotY: number;
  ghostIdleAmp: number;
  ghostIdlePeriodMs: number;
  ghostIdleSquash: number;
  /** 透明态鬼 opacity 0–1 */
  ghostTransparentAlpha: number;
  /** 完全显示鬼 opacity 0–1 */
  ghostRevealedAlpha: number;
  /**
   * 可落格吸附框（snap-frame.png · Additive）
   * snapAlpha：透明度 0–1
   * snapSize：相对格边 %（100 = 铺满一格）
   */
  snapAlpha: number;
  snapSize: number;
  /** 显示格线调试 */
  showGrid: number; // 0 | 1
  /** 显示坐标 */
  showCoords: number; // 0 | 1
  /** HUD 标题/提示显隐 */
  showHud: number; // 0 | 1
};

export const VIEW_STYLE: ViewStyle = {
  glowSize: 210,
  glowAlpha: 0.5,
  glowForward: 2,
  glowForwardLong: 4,
  glowSide: 0,
  glowOffsetX: 0,
  glowOffsetY: 0,
  beamWidth: 160,
  beamLength: 150,
  beamOffsetX: 0,
  beamOffsetY: -35, // 拿起连接锚点
  beamPlacedWidth: 180, // 放下连接宽%
  beamPlacedOffsetX: 0,
  beamPlacedOffsetY: -30, // 放下连接锚点
  beamPlacedLengthScale: 130, // 放下长度：路径距离 × %
  beamAlpha: 0.64,
  ghostSize: 170,
  ghostOffsetX: 8,
  ghostOffsetY: 8,
  ghostPivotY: 50, // 贴图正中心做待机 S&S
  ghostIdleAmp: 6,
  ghostIdlePeriodMs: 1800,
  ghostIdleSquash: 0.06,
  ghostTransparentAlpha: 0.35,
  ghostRevealedAlpha: 1,
  /** 调参定稿：吸附框 透明度 0.4 · 大小 150% */
  snapAlpha: 0.4,
  snapSize: 150,
  showGrid: 0,
  showCoords: 0,
  showHud: 1,
};

export const DEFAULT_VIEW_STYLE: ViewStyle = { ...VIEW_STYLE };

export function setViewStyle(partial: Partial<ViewStyle>): void {
  Object.assign(VIEW_STYLE, partial);
}

export function resetViewStyle(): void {
  Object.assign(VIEW_STYLE, DEFAULT_VIEW_STYLE);
}

export function viewStyleSnapshot(): string {
  const v = VIEW_STYLE;
  return [
    `VIEW_STYLE:`,
    `  glowSize: ${v.glowSize},`,
    `  glowAlpha: ${v.glowAlpha},`,
    `  glowForward: ${v.glowForward},`,
    `  glowForwardLong: ${v.glowForwardLong},`,
    `  glowSide: ${v.glowSide},`,
    `  glowOffsetX: ${v.glowOffsetX},`,
    `  glowOffsetY: ${v.glowOffsetY},`,
    `  beamWidth: ${v.beamWidth},`,
    `  beamLength: ${v.beamLength},`,
    `  beamOffsetX: ${v.beamOffsetX},`,
    `  beamOffsetY: ${v.beamOffsetY}, // 拿起`,
    `  beamPlacedWidth: ${v.beamPlacedWidth},`,
    `  beamPlacedOffsetX: ${v.beamPlacedOffsetX},`,
    `  beamPlacedOffsetY: ${v.beamPlacedOffsetY}, // 放下`,
    `  beamPlacedLengthScale: ${v.beamPlacedLengthScale},`,
    `  beamAlpha: ${v.beamAlpha},`,
    `  ghostSize: ${v.ghostSize},`,
    `  ghostOffsetX: ${v.ghostOffsetX},`,
    `  ghostOffsetY: ${v.ghostOffsetY},`,
    `  ghostPivotY: ${v.ghostPivotY},`,
    `  ghostIdleAmp: ${v.ghostIdleAmp},`,
    `  ghostIdlePeriodMs: ${v.ghostIdlePeriodMs},`,
    `  ghostIdleSquash: ${v.ghostIdleSquash},`,
    `  ghostTransparentAlpha: ${v.ghostTransparentAlpha},`,
    `  ghostRevealedAlpha: ${v.ghostRevealedAlpha},`,
    `  snapAlpha: ${v.snapAlpha},`,
    `  snapSize: ${v.snapSize},`,
    `  showGrid: ${v.showGrid},`,
    `  showCoords: ${v.showCoords},`,
    `  showHud: ${v.showHud},`,
  ].join('\n');
}

export function applyViewStyleCss(root: HTMLElement): void {
  const v = VIEW_STYLE;
  root.style.setProperty('--glow-size', `${v.glowSize}%`);
  root.style.setProperty('--glow-alpha', String(v.glowAlpha));
  // ghostSize = 相对单格边长 %；鬼层铺满棋盘后不能再用 % of 整层
  root.style.setProperty('--ghost-size', `${v.ghostSize}%`);
  root.style.setProperty(
    '--ghost-box',
    `${(cellSize() * Math.max(1, v.ghostSize)) / 100}px`,
  );
  root.style.setProperty('--ghost-offset-x', `${v.ghostOffsetX}px`);
  root.style.setProperty('--ghost-offset-y', `${v.ghostOffsetY}px`);
  root.style.setProperty('--ghost-pivot-y', `${v.ghostPivotY}%`);
  root.style.setProperty('--ghost-transparent-alpha', String(v.ghostTransparentAlpha));
  root.style.setProperty('--ghost-revealed-alpha', String(v.ghostRevealedAlpha));
  root.style.setProperty('--snap-alpha', String(v.snapAlpha));
  root.style.setProperty('--snap-size', `${v.snapSize}%`);
  root.classList.toggle('debug-grid', v.showGrid >= 0.5);
  root.classList.toggle('debug-coords', v.showCoords >= 0.5);
  root.classList.toggle('hud-hidden', v.showHud < 0.5);
}
