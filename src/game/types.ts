/** Shared game types — pure data, no DOM/Three. Aligned with OPTICS_SPEC + INTERACTION_SPEC. */

export enum Dir {
  N = 0,
  E = 1,
  S = 2,
  W = 3,
}

export type DirValue = 0 | 1 | 2 | 3;

export const DELTA: Record<Dir, { dx: number; dy: number }> = {
  [Dir.N]: { dx: 0, dy: -1 },
  [Dir.E]: { dx: 1, dy: 0 },
  [Dir.S]: { dx: 0, dy: 1 },
  [Dir.W]: { dx: -1, dy: 0 },
};

export function opposite(d: Dir): Dir {
  return ((d + 2) % 4) as Dir;
}

export function rotateCW(d: Dir): Dir {
  return ((d + 1) % 4) as Dir;
}

export type PropType = 'light' | 'mirror' | 'beam_splitter' | 'diffuser';

export enum GhostState {
  Hidden = 'hidden',
  Revealed = 'revealed',
  Transparent = 'transparent',
  Caught = 'caught',
}

export type Occupant =
  | { kind: 'wall' }
  | { kind: 'ghost'; id: string }
  | {
      kind: 'prop';
      id: string;
      type: PropType;
      /** facing 0..3; for light, same as Dir */
      facing: DirValue;
      locked?: boolean;
    }
  | null;

export type Ghost = {
  id: string;
  x: number;
  y: number;
  state: GhostState;
  everLit: boolean;
  /**
   * 当前连续被照亮的起始 performance.now()；
   * 离开光格后清除，用于「停留 1s 才首次出场」。
   */
  litSince?: number;
};

export type TrayItem = {
  type: PropType;
  count: number;
};

export type LevelDef = {
  id: string;
  title?: string;
  intent?: string;
  board: { width: number; height: number };
  walls: Array<{ x: number; y: number }>;
  ghosts: Array<{ id: string; x: number; y: number }>;
  tray: TrayItem[];
  lockedProps?: Array<{
    type: PropType;
    x: number;
    y: number;
    facing: DirValue;
    locked: true;
  }>;
  difficulty?: number;
  tags?: string[];
  teaches?: string[];
  requires?: string[];
  /** Optional note for standard solution (hand-calc). */
  reference?: string;
};

export enum SessionPhase {
  Playing = 'playing',
  Camera = 'camera',
  Won = 'won',
}

export type LightPose = {
  x: number;
  y: number;
  dir: Dir;
  /**
   * 最多照亮的路径格数（不含光源自身）。
   * 扫描阶段拿起手电：1（顶视近照 1 格）；放置布光：不设 = 无限远直线。
   */
  maxSteps?: number;
};

export type DragGhost = {
  /** From tray: no board id yet */
  source: 'tray' | 'board';
  type: PropType;
  facing: DirValue;
  /** When source=board, original prop id */
  propId?: string;
  /** When source=board, original cell (for cancel restore) */
  fromCell?: { x: number; y: number };
  /** Snapped cell if canPlace; null if invalid / off-board */
  cell: { x: number; y: number } | null;
  /**
   * 道具视觉中心（design px）— 手感2 积分+平滑后的 frame，非指尖。
   */
  designX: number;
  designY: number;
  /** 指尖 design（调试/可选） */
  fingerX?: number;
  fingerY?: number;
  /** 平面尺度（手电本体满尺寸） */
  scale?: number;
  /**
   * 开灯进度 0→1（光斑整体 / 连接从手电端 scaleX）
   */
  openT?: number;
  /** 盘上拖动满尺寸边长 px */
  dragSizePx?: number;
};

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseCellKey(key: string): { x: number; y: number } {
  const [xs, ys] = key.split(',');
  return { x: Number(xs), y: Number(ys) };
}
