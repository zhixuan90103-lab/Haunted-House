/** Design-space board layout (INTERACTION_SPEC R09). Mutable for live tuning. */

export type BoardLayout = {
  left: number;
  top: number;
  size: number;
  cols: number;
  rows: number;
  padding: number;
};

export type TrayLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Defaults — tune via debug panel or setLayout. */
export const BOARD_LAYOUT: BoardLayout = {
  left: 20,
  top: 190,
  size: 350,
  cols: 5,
  rows: 5,
  padding: 8,
};

export const TRAY_LAYOUT: TrayLayout = {
  left: 24,
  top: 640,
  width: 342,
  height: 80,
};

export const DEFAULT_BOARD_LAYOUT: BoardLayout = { ...BOARD_LAYOUT };
export const DEFAULT_TRAY_LAYOUT: TrayLayout = { ...TRAY_LAYOUT };

export function cellSize(): number {
  return (BOARD_LAYOUT.size - BOARD_LAYOUT.padding * 2) / BOARD_LAYOUT.cols;
}

export function designToCell(
  dx: number,
  dy: number,
): { x: number; y: number } | null {
  const { left, top, size, padding, cols, rows } = BOARD_LAYOUT;
  const ix = dx - left - padding;
  const iy = dy - top - padding;
  const usable = size - padding * 2;
  if (ix < 0 || iy < 0 || ix >= usable || iy >= usable) return null;
  const cs = usable / cols;
  const x = Math.floor(ix / cs);
  const y = Math.floor(iy / cs);
  if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
  return { x, y };
}

export function cellToDesignCenter(
  x: number,
  y: number,
): { dx: number; dy: number } {
  const cs = cellSize();
  return {
    dx: BOARD_LAYOUT.left + BOARD_LAYOUT.padding + (x + 0.5) * cs,
    dy: BOARD_LAYOUT.top + BOARD_LAYOUT.padding + (y + 0.5) * cs,
  };
}

export function setBoardLayout(partial: Partial<BoardLayout>): void {
  Object.assign(BOARD_LAYOUT, partial);
}

export function setTrayLayout(partial: Partial<TrayLayout>): void {
  Object.assign(TRAY_LAYOUT, partial);
}

export function resetLayouts(): void {
  Object.assign(BOARD_LAYOUT, DEFAULT_BOARD_LAYOUT);
  Object.assign(TRAY_LAYOUT, DEFAULT_TRAY_LAYOUT);
}

/** Snapshot for copy-paste into layout.ts */
export function layoutSnapshot(): string {
  return [
    `BOARD_LAYOUT: left=${BOARD_LAYOUT.left}, top=${BOARD_LAYOUT.top}, size=${BOARD_LAYOUT.size}, padding=${BOARD_LAYOUT.padding}`,
    `TRAY_LAYOUT: left=${TRAY_LAYOUT.left}, top=${TRAY_LAYOUT.top}, width=${TRAY_LAYOUT.width}, height=${TRAY_LAYOUT.height}`,
    `cellSize≈${cellSize().toFixed(1)}`,
  ].join('\n');
}

export const DRAG_THRESHOLD_PX = 8;
