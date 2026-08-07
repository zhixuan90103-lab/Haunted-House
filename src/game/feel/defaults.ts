/**
 * 手感2 操作参数（对齐 BlockBlast_2 applyFeel2OpParams）。
 * 可被道具调参面板实时修改；复制参数后可回写本文默认值。
 */

export type FeelConfig = {
  DRAG_OFFSET_Y: number;
  DRAG_OFFSET_X: number;
  DRAG_OFFSET_Y_MIN: number;
  DRAG_OFFSET_Y_MAX: number;
  DRAG_LIFT_TRAVEL_CELLS: number;
  DRAG_LIFT_POWER: number;
  POINTER_GAIN_K: number;
  SMOOTH_TIME: number;
  TRAY_SCALE: number;
  BOARD_SCALE: number;
  DRAG_SCALE_POP: number;
  SCALE_POP_MS: number;
  /** 拿起手电：Y 轴开灯动画时长（ms），从 0→满尺寸 */
  LIGHT_OPEN_MS: number;
};

export const FEEL: FeelConfig = {
  DRAG_OFFSET_Y: -1.0,
  DRAG_OFFSET_X: 0,
  DRAG_OFFSET_Y_MIN: -1.0,
  DRAG_OFFSET_Y_MAX: -1.0,
  DRAG_LIFT_TRAVEL_CELLS: 1.0,
  DRAG_LIFT_POWER: 1.0,
  POINTER_GAIN_K: 1.6,
  SMOOTH_TIME: 0.012,
  TRAY_SCALE: 1.2,
  BOARD_SCALE: 1.0,
  DRAG_SCALE_POP: 1.0,
  SCALE_POP_MS: 90,
  LIGHT_OPEN_MS: 100,
};

export const DEFAULT_FEEL: FeelConfig = { ...FEEL };

export function setFeel(partial: Partial<FeelConfig>): void {
  Object.assign(FEEL, partial);
  // 手感2：固定抬升时保持 MIN=MAX=OFFSET_Y
  if (
    partial.DRAG_OFFSET_Y !== undefined &&
    partial.DRAG_OFFSET_Y_MIN === undefined &&
    partial.DRAG_OFFSET_Y_MAX === undefined
  ) {
    FEEL.DRAG_OFFSET_Y_MIN = partial.DRAG_OFFSET_Y;
    FEEL.DRAG_OFFSET_Y_MAX = partial.DRAG_OFFSET_Y;
  }
}

export function resetFeel(): void {
  Object.assign(FEEL, DEFAULT_FEEL);
}

export function feelSnapshot(): string {
  const f = FEEL;
  return [
    `FEEL (手感2):`,
    `  POINTER_GAIN_K: ${f.POINTER_GAIN_K},`,
    `  DRAG_OFFSET_Y: ${f.DRAG_OFFSET_Y},`,
    `  TRAY_SCALE: ${f.TRAY_SCALE},`,
    `  BOARD_SCALE: ${f.BOARD_SCALE},`,
    `  DRAG_SCALE_POP: ${f.DRAG_SCALE_POP},`,
    `  SCALE_POP_MS: ${f.SCALE_POP_MS},`,
    `  LIGHT_OPEN_MS: ${f.LIGHT_OPEN_MS},`,
    `  SMOOTH_TIME: ${f.SMOOTH_TIME},`,
  ].join('\n');
}
