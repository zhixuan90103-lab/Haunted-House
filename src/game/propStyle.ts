/** Mutable prop visual params (tuned live, then bake into defaults). */

export type PropStyle = {
  /** Board cell sprite scale % (100 = fill cell) */
  boardScale: number;
  /** Extra scale for light on board / drag */
  lightBoardScale: number;
  /** Drag size multiplier on top of lightBoardScale */
  dragScale: number;
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
  lightBoardScale: 108,
  dragScale: 2,
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
    `  lightBoardScale: ${p.lightBoardScale},`,
    `  dragScale: ${p.dragScale},`,
    `  rotateOffset: ${p.rotateOffset},`,
    `  defaultFacing: ${p.defaultFacing}, // 0=N 1=E 2=S 3=W`,
    `  trayFacing: ${p.trayFacing},`,
  ].join('\n');
}

export function applyPropStyleCss(
  root: HTMLElement = document.documentElement,
): void {
  const p = PROP_STYLE;
  root.style.setProperty('--prop-board-scale', `${p.boardScale}%`);
  root.style.setProperty('--prop-light-board-scale', `${p.lightBoardScale}%`);
}
