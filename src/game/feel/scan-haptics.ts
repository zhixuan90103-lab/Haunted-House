/**
 * Scan-session haptics (hand-held light only).
 *
 * ① open: one transient
 * ② continuous: shallow fixed base; slight bump when minDist ≤ nearRadius
 * ③ ghost cell pass: light transient on entering a ghost cell
 * ④ first everLit: reveal spike (kept)
 */

import { haptics } from '../../utils/haptics';
import type { Ghost } from '../types';
import { cellKey } from '../types';
import { SCAN_HAPTIC } from './haptic-config';

export type ScanHapticsHandle = {
  onScanFrame: (args: {
    spotCell: { x: number; y: number } | null;
    ghostsPrev: Ghost[];
    ghosts: Ghost[];
    nowMs?: number;
  }) => void;
  end: () => void;
  isActive: () => boolean;
};

/** 仅未发现的鬼（Hidden / !everLit）参与近距与过格震动 */
function undiscoveredGhosts(ghosts: Ghost[]): Ghost[] {
  return ghosts.filter((g) => !g.everLit);
}

function minManhattanToGhosts(
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

function isUndiscoveredGhostCell(
  cell: { x: number; y: number } | null,
  ghosts: Ghost[],
): boolean {
  if (!cell) return false;
  return undiscoveredGhosts(ghosts).some(
    (g) => g.x === cell.x && g.y === cell.y,
  );
}

/**
 * Continuous level vs nearest-ghost manhattan distance:
 * - dist >= nearRadius（或更远）→ 底噪 floor
 * - dist == 0 → peak（光斑在鬼格）
 * - 中间线性插值（格点离散，手感为分档爬升）
 */
export function intensityFromDist(dist: number): {
  intensity: number;
  sharpness: number;
} {
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

  // t: 1 at dist 0, 0 at dist == r  → linear in dist
  const t = 1 - dist / r;
  return {
    intensity: floorIntensity + (peakIntensity - floorIntensity) * t,
    sharpness: floorSharpness + (peakSharpness - floorSharpness) * t,
  };
}

function impactStyleFromLevel(
  level: number,
): 'soft' | 'light' | 'medium' | 'heavy' {
  if (level < 0.28) return 'soft';
  if (level < 0.5) return 'light';
  if (level < 0.75) return 'medium';
  return 'heavy';
}

function everLitMap(ghosts: Ghost[]): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const g of ghosts) m.set(g.id, g.everLit);
  return m;
}

export function createScanHaptics(): ScanHapticsHandle {
  let active = false;
  let continuousOn = false;
  let pulseFallback = false;
  let continuousStartedAt = 0;
  let lastUpdateAt = 0;
  let lastI = -1;
  let lastS = -1;
  let desiredI = SCAN_HAPTIC.floorIntensity;
  let desiredS = SCAN_HAPTIC.floorSharpness;
  let openTimer: ReturnType<typeof setTimeout> | null = null;
  let starting = false;
  let gen = 0;

  /** Last spot cell key for ghost-pass edge */
  let lastSpotKey: string | null = null;
  let lastGhostPassAt = 0;

  const clearOpenTimer = () => {
    if (openTimer != null) {
      clearTimeout(openTimer);
      openTimer = null;
    }
  };

  const fireOpen = () => {
    const i = SCAN_HAPTIC.openIntensity;
    const s = SCAN_HAPTIC.openSharpness;
    void haptics.playTransient(i, s);
    if (SCAN_HAPTIC.useImpactOpen >= 0.5) {
      void haptics.impact(impactStyleFromLevel(i), 10, { intensity: i });
    }
  };

  /**
   * 出场三段瞬态：#1 立即，#2 在 +reveal1to2Ms，#3 再 +reveal2to3Ms。
   * 每下独立 intensity/sharpness；UIKit 仅叠在第 1 下（可关）。
   */
  const fireReveal = () => {
    const h = SCAN_HAPTIC;
    const hit = (intensity: number, sharpness: number, withUiKit: boolean) => {
      void haptics.playTransient(intensity, sharpness);
      if (withUiKit && h.useImpactReveal >= 0.5) {
        void haptics.impact(impactStyleFromLevel(intensity), 10, {
          intensity,
        });
      }
    };

    hit(h.reveal1Intensity, h.reveal1Sharpness, true);

    const t12 = Math.max(0, h.reveal1to2Ms);
    const t23 = Math.max(0, h.reveal2to3Ms);

    window.setTimeout(() => {
      hit(h.reveal2Intensity, h.reveal2Sharpness, false);
    }, t12);

    window.setTimeout(() => {
      hit(h.reveal3Intensity, h.reveal3Sharpness, false);
    }, t12 + t23);
  };

  /** Light tick when light spot enters a ghost cell */
  const fireGhostPass = (now: number) => {
    if (now - lastGhostPassAt < SCAN_HAPTIC.ghostPassCooldownMs) return;
    lastGhostPassAt = now;
    const i = SCAN_HAPTIC.ghostPassIntensity;
    const s = SCAN_HAPTIC.ghostPassSharpness;
    void haptics.playTransient(i, s);
    if (SCAN_HAPTIC.useImpactGhostPass >= 0.5) {
      void haptics.impact('soft', 6, { intensity: i });
    }
  };

  const applyLevel = (intensity: number, sharpness: number, now: number) => {
    if (!continuousOn) return;
    if (now - lastUpdateAt < SCAN_HAPTIC.updateIntervalMs) return;
    if (
      Math.abs(intensity - lastI) < 0.008 &&
      Math.abs(sharpness - lastS) < 0.008
    ) {
      return;
    }
    lastUpdateAt = now;
    lastI = intensity;
    lastS = sharpness;
    void haptics.updateContinuous({ intensity, sharpness });
  };

  const startContinuousAt = async (
    intensity: number,
    sharpness: number,
    now: number,
    myGen: number,
  ) => {
    if (!active || myGen !== gen) return;

    const r = await haptics.startContinuous({
      intensity: 1,
      sharpness: 1,
      duration: Math.min(30, SCAN_HAPTIC.continuousDurationS),
    });

    if (!active || myGen !== gen) {
      void haptics.stopContinuous();
      return;
    }

    if (r.ok) {
      continuousOn = true;
      pulseFallback = false;
      continuousStartedAt = now;
      lastI = -1;
      lastS = -1;
      lastUpdateAt = 0;
      void haptics.updateContinuous({ intensity, sharpness });
      lastI = intensity;
      lastS = sharpness;
      lastUpdateAt = now;
    } else {
      continuousOn = false;
      pulseFallback = true;
      console.warn(
        '[scan-haptics] continuous failed, pulse fallback',
        r.reason,
        haptics.getLastError(),
      );
    }
  };

  const renewIfNeeded = (
    intensity: number,
    sharpness: number,
    now: number,
    myGen: number,
  ) => {
    if (!continuousOn) return;
    const maxMs = Math.min(30, SCAN_HAPTIC.continuousDurationS) * 1000;
    if (now - continuousStartedAt < maxMs - SCAN_HAPTIC.renewBeforeMs) {
      return;
    }
    void startContinuousAt(intensity, sharpness, now, myGen);
  };

  const pulseTick = (intensity: number, now: number) => {
    if (!pulseFallback && continuousOn) return;
    if (now - lastUpdateAt < SCAN_HAPTIC.pulseFallbackMs) return;
    lastUpdateAt = now;
    void haptics.impact(impactStyleFromLevel(intensity), 8, {
      intensity: Math.max(0.12, intensity),
    });
  };

  const fireRevealSpikes = (prev: Ghost[], next: Ghost[]) => {
    const before = everLitMap(prev);
    for (const g of next) {
      if (g.everLit && before.get(g.id) === false) {
        fireReveal();
      }
    }
  };

  const maybeGhostPass = (
    spotCell: { x: number; y: number } | null,
    ghosts: Ghost[],
    now: number,
  ) => {
    const key = spotCell ? cellKey(spotCell.x, spotCell.y) : null;
    if (key !== lastSpotKey) {
      // 已发现（everLit）的鬼：路过不叠过格瞬态
      const entered =
        key != null && isUndiscoveredGhostCell(spotCell, ghosts);
      lastSpotKey = key;
      if (entered) fireGhostPass(now);
    }
  };

  const beginSession = () => {
    if (active || starting) return;
    starting = true;
    active = true;
    const myGen = ++gen;
    lastSpotKey = null;

    fireOpen();

    clearOpenTimer();
    openTimer = setTimeout(() => {
      openTimer = null;
      starting = false;
      if (!active || myGen !== gen) return;
      void startContinuousAt(
        desiredI,
        desiredS,
        performance.now(),
        myGen,
      );
    }, Math.max(0, SCAN_HAPTIC.openToContinuousMs));
  };

  const end = () => {
    gen += 1;
    clearOpenTimer();
    starting = false;
    if (!active && !continuousOn && !pulseFallback) return;
    active = false;
    continuousOn = false;
    pulseFallback = false;
    continuousStartedAt = 0;
    lastI = -1;
    lastS = -1;
    lastSpotKey = null;
    void haptics.stopContinuous();
  };

  return {
    isActive: () => active,

    onScanFrame: ({ spotCell, ghostsPrev, ghosts, nowMs }) => {
      const now = nowMs ?? performance.now();
      const dist = minManhattanToGhosts(spotCell, ghosts);
      const { intensity, sharpness } = intensityFromDist(dist);
      desiredI = intensity;
      desiredS = sharpness;

      if (!active) {
        beginSession();
        maybeGhostPass(spotCell, ghosts, now);
        fireRevealSpikes(ghostsPrev, ghosts);
        return;
      }

      if (starting) {
        maybeGhostPass(spotCell, ghosts, now);
        fireRevealSpikes(ghostsPrev, ghosts);
        return;
      }

      if (continuousOn) {
        renewIfNeeded(intensity, sharpness, now, gen);
        applyLevel(intensity, sharpness, now);
      } else {
        pulseFallback = true;
        pulseTick(intensity, now);
      }

      maybeGhostPass(spotCell, ghosts, now);
      fireRevealSpikes(ghostsPrev, ghosts);
    },

    end,
  };
}
