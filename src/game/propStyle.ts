/**
 * 道具外观参数 — 四层互不耦合
 *
 * 1. **托盘视口** → `layout.TRAY_LAYOUT` 只定裁剪框；多件横滑见 `trayMetrics`
 * 2. **托盘图标** → `traySlotScale` 固定边长（% 格），**不**为塞屏缩小
 * 3. **拿起本体** → `*Lift*` 只定拖影跟手（镜=立式图）
 * 4. **盘上 / 投影** → `*Placed*` + `mirrorProjectionAlpha`（镜=斜置图；投影透明度独立）
 *
 * 手电 light* 数据保留，调参面板可隐藏。
 */

export type PropStyle = {
  /** 非 light/mirror 盘上 fallback % 格 */
  boardScale: number;

  // ── ② 托盘图标（仅托盘槽视觉，与容器布局数字无关）──
  /** 托盘内图标边长，相对格边 %（100=一格） */
  traySlotScale: number;

  // ── 手电（面板可隐藏）──
  lightLiftScale: number;
  lightPlacedScale: number;
  rotateOffset: number;
  defaultFacing: 0 | 1 | 2 | 3;
  trayFacing: 0 | 1 | 2 | 3;

  // ── ③ 镜子 · 拿起本体（立式 tray 图，跟手）──
  mirrorLiftScale: number;
  mirrorLiftOffsetX: number;
  mirrorLiftOffsetY: number;

  // ── ④ 镜子 · 盘上精灵 + 拿起时格上投影（斜置 board 图）──
  mirrorPlacedScale: number;
  mirrorPlacedOffsetX: number;
  mirrorPlacedOffsetY: number;
  /** 拿起时格上投影透明度 0–1（盘上已放下仍用 1） */
  mirrorProjectionAlpha: number;
  mirrorRotateOffset: number;
  mirrorDefaultFacing: 0 | 1 | 2 | 3;
};

export const PROP_STYLE: PropStyle = {
  boardScale: 96,

  // 调参定稿 2026-08
  traySlotScale: 180,

  lightLiftScale: 220,
  lightPlacedScale: 200,
  rotateOffset: 180,
  defaultFacing: 0,
  trayFacing: 0,

  mirrorLiftScale: 250,
  mirrorLiftOffsetX: 0,
  mirrorLiftOffsetY: -20,

  mirrorPlacedScale: 130,
  mirrorPlacedOffsetX: 0,
  mirrorPlacedOffsetY: 0,
  mirrorProjectionAlpha: 0.5,
  mirrorRotateOffset: 0,
  mirrorDefaultFacing: 0,
};

export const DEFAULT_PROP_STYLE: PropStyle = { ...PROP_STYLE };

export function setPropStyle(partial: Partial<PropStyle>): void {
  Object.assign(PROP_STYLE, partial);
}

export function resetPropStyle(): void {
  Object.assign(PROP_STYLE, DEFAULT_PROP_STYLE);
}

export function propStyleSnapshot(): string {
  const p = PROP_STYLE;
  return [
    `PROP_STYLE:`,
    `  // ① 托盘容器 → layout.TRAY_LAYOUT`,
    `  // ② 托盘图标`,
    `  traySlotScale: ${p.traySlotScale},`,
    `  // ③ 拿起本体`,
    `  mirrorLiftScale: ${p.mirrorLiftScale},`,
    `  mirrorLiftOffsetX: ${p.mirrorLiftOffsetX},`,
    `  mirrorLiftOffsetY: ${p.mirrorLiftOffsetY},`,
    `  // ④ 盘上/投影`,
    `  mirrorPlacedScale: ${p.mirrorPlacedScale},`,
    `  mirrorPlacedOffsetX: ${p.mirrorPlacedOffsetX},`,
    `  mirrorPlacedOffsetY: ${p.mirrorPlacedOffsetY},`,
    `  mirrorProjectionAlpha: ${p.mirrorProjectionAlpha},`,
    `  mirrorRotateOffset: ${p.mirrorRotateOffset},`,
    `  mirrorDefaultFacing: ${p.mirrorDefaultFacing},`,
    `  // 手电（隐藏调参）`,
    `  lightLiftScale: ${p.lightLiftScale},`,
    `  lightPlacedScale: ${p.lightPlacedScale},`,
    `  boardScale: ${p.boardScale},`,
  ].join('\n');
}

export function lightPlacedScalePercent(): number {
  return Math.max(40, PROP_STYLE.lightPlacedScale);
}

export function lightLiftScalePercent(): number {
  return Math.max(40, PROP_STYLE.lightLiftScale);
}

export function mirrorPlacedScalePercent(): number {
  return Math.max(40, PROP_STYLE.mirrorPlacedScale);
}

export function mirrorLiftScalePercent(): number {
  return Math.max(40, PROP_STYLE.mirrorLiftScale);
}

export function traySlotScalePercent(): number {
  return Math.max(30, PROP_STYLE.traySlotScale);
}

/** 拖影尺寸：只读拿起，不读托盘 */
export function propLiftScalePercent(type: string): number {
  if (type === 'light') return lightLiftScalePercent();
  if (type === 'mirror') return mirrorLiftScalePercent();
  return Math.max(40, PROP_STYLE.boardScale);
}

export function propPlacedScalePercent(type: string): number {
  if (type === 'light') return lightPlacedScalePercent();
  if (type === 'mirror') return mirrorPlacedScalePercent();
  return Math.max(40, PROP_STYLE.boardScale);
}

export function applyPropStyleCss(
  root: HTMLElement = document.documentElement,
): void {
  const p = PROP_STYLE;
  root.style.setProperty('--prop-board-scale', `${p.boardScale}%`);
  root.style.setProperty(
    '--prop-light-board-scale',
    `${lightPlacedScalePercent()}%`,
  );
  root.style.setProperty(
    '--prop-mirror-board-scale',
    `${mirrorPlacedScalePercent()}%`,
  );
}
