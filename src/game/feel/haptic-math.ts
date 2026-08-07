/**
 * 扫描震动纯函数：距离与 continuous 强度映射。
 * 无 I/O；参数读 SCAN_HAPTIC 当前值。
 */

import type { Ghost } from '../types';
import { SCAN_HAPTIC } from './haptic-config';

export type HapticLevel = { intensity: number; sharpness: number };

/** 仅未发现的鬼参与近距 / 过格 */
export function undiscoveredGhosts(ghosts: Ghost[]): Ghost[] {
  return ghosts.filter((g) => !g.everLit);
}

/** 光斑格 → 最近未发现鬼的曼哈顿距离；无目标则 +∞ */
export function minManhattanToUndiscovered(
  cell: { x: number; y: number } | null,
  ghosts: Ghost[],
): number {
  const list = undiscoveredGhosts(ghosts);
  if (!cell || list.length === 0) return Number.POSITIVE_INFINITY;
  let min = Infinity;
  for (const g of list) {
    const d = Math.abs(g.x - cell.x) + Math.abs(g.y - cell.y);
    if (d < min) min = d;
  }
  return min;
}

export function isUndiscoveredGhostCell(
  cell: { x: number; y: number } | null,
  ghosts: Ghost[],
): boolean {
  if (!cell) return false;
  return undiscoveredGhosts(ghosts).some(
    (g) => g.x === cell.x && g.y === cell.y,
  );
}

/**
 * continuous 强度：
 * dist ≥ nearRadius → floor；dist ≤ 0 → peak；中间线性。
 */
export function intensityFromDist(dist: number): HapticLevel {
  const {
    floorIntensity,
    floorSharpness,
    peakIntensity,
    peakSharpness,
    nearRadius,
  } = SCAN_HAPTIC;
  const r = Math.max(1, nearRadius);

  if (!Number.isFinite(dist) || dist >= r) {
    return { intensity: floorIntensity, sharpness: floorSharpness };
  }
  if (dist <= 0) {
    return { intensity: peakIntensity, sharpness: peakSharpness };
  }

  const t = 1 - dist / r;
  return {
    intensity: floorIntensity + (peakIntensity - floorIntensity) * t,
    sharpness: floorSharpness + (peakSharpness - floorSharpness) * t,
  };
}

/**
 * 首次出场蓄光：压在未发现鬼格且 litSince 计时中。
 * progress = (now - litSince) / dwellMs → peak 线性 → chargePeak
 */
export function intensityFromCharge(
  progress01: number,
): HapticLevel {
  const p = Math.max(0, Math.min(1, progress01));
  const {
    peakIntensity,
    peakSharpness,
    chargePeakIntensity,
    chargePeakSharpness,
  } = SCAN_HAPTIC;
  return {
    intensity:
      peakIntensity + (chargePeakIntensity - peakIntensity) * p,
    sharpness:
      peakSharpness + (chargePeakSharpness - peakSharpness) * p,
  };
}

/** 光斑格上正在蓄光的未发现鬼（有 litSince） */
export function chargingGhostAt(
  cell: { x: number; y: number } | null,
  ghosts: Ghost[],
): Ghost | null {
  if (!cell) return null;
  return (
    undiscoveredGhosts(ghosts).find(
      (g) => g.x === cell.x && g.y === cell.y && g.litSince != null,
    ) ?? null
  );
}

/**
 * 综合：近鬼距离 + 可选蓄光爬升。
 * dwellMs 应与 GHOST_REVEAL_DWELL_MS 一致。
 */
export function scanContinuousLevel(args: {
  dist: number;
  spotCell: { x: number; y: number } | null;
  ghosts: Ghost[];
  nowMs: number;
  dwellMs: number;
}): HapticLevel {
  const base = intensityFromDist(args.dist);
  const g = chargingGhostAt(args.spotCell, args.ghosts);
  if (!g || g.litSince == null || args.dwellMs <= 0) return base;
  const progress = (args.nowMs - g.litSince) / args.dwellMs;
  return intensityFromCharge(progress);
}

export function impactStyleFromLevel(
  level: number,
): 'soft' | 'light' | 'medium' | 'heavy' {
  if (level < 0.28) return 'soft';
  if (level < 0.5) return 'light';
  if (level < 0.75) return 'medium';
  return 'heavy';
}

export function everLitMap(ghosts: Ghost[]): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const g of ghosts) m.set(g.id, g.everLit);
  return m;
}
