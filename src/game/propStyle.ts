/** Mutable prop visual params (tuned live, then bake into defaults). */

export type PropStyle = {
  /** Board cell sprite scale % (100 = fill cell); non-light props */
  boardScale: number;
  /**
   * 手电拿起/拖动边长：相对格边 %（100 = 一格宽）
   * 实际 px = cellSize × lightLiftScale / 100
   */
  lightLiftScale: number;
  /**
   * 手电放下（盘上）边长：相对格边 %（100 = 一格宽）
   * 实际 px = cellSize × lightPlacedScale / 100
   */
  lightPlacedScale: number;
  /**
   * Extra CSS degrees after dir mapping.
   * Asset faces East at 0°; Dir.N → -90° before this offset.
   */
  rotateOffset: number;
  /** Default facing when pulling from tray (0=N,1=E,2=S,3=W) */
  defaultFacing: 0 | 1 | 2 | 3;
  /** Tray display facing */
  trayFacing: 0 | 1 | 2 | 3;
};

export const PROP_STYLE: PropStyle = {
  boardScale: 96,
  /** 调参定稿 2026-08（面板：拿起 220 / 放下 200） */
  lightLiftScale: 220,
  lightPlacedScale: 200,
  rotateOffset: 180,
  defaultFacing: 0, // 0=N 1=E 2=S 3=W
  trayFacing: 0,
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
    `  boardScale: ${p.boardScale},`,
    `  lightLiftScale: ${p.lightLiftScale}, // 拿起 % of cell`,
    `  lightPlacedScale: ${p.lightPlacedScale}, // 放下 % of cell`,
    `  rotateOffset: ${p.rotateOffset},`,
    `  defaultFacing: ${p.defaultFacing}, // 0=N 1=E 2=S 3=W`,
    `  trayFacing: ${p.trayFacing},`,
  ].join('\n');
}

/** 放下尺寸：格边百分比（已 clamp） */
export function lightPlacedScalePercent(): number {
  return Math.max(40, PROP_STYLE.lightPlacedScale);
}

/** 拿起尺寸：格边百分比（已 clamp） */
export function lightLiftScalePercent(): number {
  return Math.max(40, PROP_STYLE.lightLiftScale);
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
    '--prop-light-lift-scale',
    `${lightLiftScalePercent()}%`,
  );
}
