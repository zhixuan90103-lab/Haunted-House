/** View / FX knobs (CSS vars + debug flags). */

export type ViewStyle = {
  /**
   * 光斑大小：相对格子边长的百分比（100 = 一格宽）
   */
  glowSize: number;
  /** 光斑透明度 0–1 */
  glowAlpha: number;
  /**
   * 拖动手电时：光斑沿朝向的前移距离（格）
   */
  glowForward: number;
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
   * beamWidth / beamLength：相对格子边长 %
   * beamOffsetX / beamOffsetY：相对手电中心的 design px
   * beamAlpha：连接独立透明度 0–1
   */
  beamWidth: number;
  beamLength: number;
  beamOffsetX: number;
  beamOffsetY: number;
  beamAlpha: number;
  /** 透明态鬼 opacity 0–1 */
  ghostTransparentAlpha: number;
  /** 完全显示鬼 opacity 0–1 */
  ghostRevealedAlpha: number;
  /** 吸附描边强度 0–1 */
  snapOutlineAlpha: number;
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
  glowSide: 0,
  glowOffsetX: 0,
  glowOffsetY: 0,
  beamWidth: 160,
  beamLength: 150,
  beamOffsetX: 0,
  beamOffsetY: -80,
  beamAlpha: 0.64,
  ghostTransparentAlpha: 0.35,
  ghostRevealedAlpha: 1,
  snapOutlineAlpha: 0.7,
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
    `  glowSide: ${v.glowSide},`,
    `  glowOffsetX: ${v.glowOffsetX},`,
    `  glowOffsetY: ${v.glowOffsetY},`,
    `  beamWidth: ${v.beamWidth},`,
    `  beamLength: ${v.beamLength},`,
    `  beamOffsetX: ${v.beamOffsetX},`,
    `  beamOffsetY: ${v.beamOffsetY},`,
    `  beamAlpha: ${v.beamAlpha},`,
    `  ghostTransparentAlpha: ${v.ghostTransparentAlpha},`,
    `  ghostRevealedAlpha: ${v.ghostRevealedAlpha},`,
    `  snapOutlineAlpha: ${v.snapOutlineAlpha},`,
    `  showGrid: ${v.showGrid},`,
    `  showCoords: ${v.showCoords},`,
    `  showHud: ${v.showHud},`,
  ].join('\n');
}

export function applyViewStyleCss(root: HTMLElement): void {
  const v = VIEW_STYLE;
  root.style.setProperty('--glow-size', `${v.glowSize}%`);
  root.style.setProperty('--glow-alpha', String(v.glowAlpha));
  root.style.setProperty('--ghost-transparent-alpha', String(v.ghostTransparentAlpha));
  root.style.setProperty('--ghost-revealed-alpha', String(v.ghostRevealedAlpha));
  root.style.setProperty('--snap-outline-alpha', String(v.snapOutlineAlpha));
  root.classList.toggle('debug-grid', v.showGrid >= 0.5);
  root.classList.toggle('debug-coords', v.showCoords >= 0.5);
  root.classList.toggle('hud-hidden', v.showHud < 0.5);
}
