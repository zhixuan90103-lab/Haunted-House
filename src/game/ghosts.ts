/** Ghost state machine (OPTICS_SPEC R07 + 首次出场 dwell). Pure functions. */

import { cellKey, GhostState, type Ghost } from './types';

/** 首次出场：光需连续照在鬼格上的最短时间（ms）；离开则重置 */
export const GHOST_REVEAL_DWELL_MS = 1000;

/**
 * Advance all ghosts after a lit recompute.
 * Caught is sticky until restart / photo flow writes it.
 * @param nowMs performance.now() — 用于 dwell 计时
 */
export function stepGhosts(
  ghosts: Ghost[],
  lit: Set<string>,
  nowMs: number = performance.now(),
): Ghost[] {
  return ghosts.map((g) => stepGhost(g, lit, nowMs));
}

export function stepGhost(
  g: Ghost,
  lit: Set<string>,
  nowMs: number = performance.now(),
): Ghost {
  if (g.state === GhostState.Caught) return g;

  const isLit = lit.has(cellKey(g.x, g.y));

  if (isLit) {
    // —— 已出过场：再被照到立刻 Revealed ——
    if (g.everLit) {
      return {
        ...g,
        state: GhostState.Revealed,
        litSince: g.litSince ?? nowMs,
      };
    }

    // —— 首次出场：连续照亮满 GHOST_REVEAL_DWELL_MS ——
    const litSince = g.litSince ?? nowMs;
    if (nowMs - litSince >= GHOST_REVEAL_DWELL_MS) {
      return {
        ...g,
        everLit: true,
        litSince,
        state: GhostState.Revealed,
      };
    }
    // 仍在蓄光：保持 Hidden，不显示
    return {
      ...g,
      litSince,
      state: GhostState.Hidden,
    };
  }

  // —— 离开光格：计时清零 ——
  if (g.everLit) {
    return {
      ...g,
      litSince: undefined,
      state: GhostState.Transparent,
    };
  }
  return {
    ...g,
    litSince: undefined,
    state: GhostState.Hidden,
  };
}

/** 是否有鬼正在首次出场蓄光（需要 rAF 推进计时） */
export function anyGhostCharging(ghosts: Ghost[]): boolean {
  return ghosts.some(
    (g) =>
      g.state !== GhostState.Caught &&
      !g.everLit &&
      g.litSince != null,
  );
}

export function allRevealed(ghosts: Ghost[]): boolean {
  return ghosts.length > 0 && ghosts.every((g) => g.state === GhostState.Revealed);
}

/**
 * 全部「找出来」= 每只鬼至少 everLit 一次（含 Transparent / Revealed）。
 * 用于：未全发现前禁止把手电放到格子上（仅扫描）。
 */
export function allGhostsFound(ghosts: Ghost[]): boolean {
  return ghosts.length > 0 && ghosts.every((g) => g.everLit);
}

export function resetGhosts(ghosts: Array<{ id: string; x: number; y: number }>): Ghost[] {
  return ghosts.map((g) => ({
    id: g.id,
    x: g.x,
    y: g.y,
    state: GhostState.Hidden,
    everLit: false,
    litSince: undefined,
  }));
}
