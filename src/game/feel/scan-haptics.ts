/**
 * Scan-session haptics (hand-held light only).
 *
 * ① open: one soft transient when lamp session starts
 * ② continuous: weak floor far → stronger near ghost (spot cell, manhattan)
 * ③ reveal spike: each ghost everLit false→true once
 * ④ end: stop continuous on drop (placed lights do not rumble)
 *
 * Native: Core Haptics continuous + sendParameters.
 * Web: weak pulse throttle only (no true continuous).
 */

import { haptics } from '../../utils/haptics';
import type { Ghost } from '../types';

/** Continuous clip max (Core Haptics); renew before expiry */
const CONTINUOUS_DURATION_S = 30;
const RENEW_BEFORE_MS = 2000;

/** How often to push intensity (ms); not every cell change */
const UPDATE_INTERVAL_MS = 60;

/** Open pulse then start continuous */
const OPEN_TO_CONTINUOUS_MS = 70;

// —— Feel anchors (tunable; intensity is perceptual, non-linear in dist) ——
const OPEN_INTENSITY = 0.42;
const OPEN_SHARPNESS = 0.32;

const REVEAL_INTENSITY = 0.78;
const REVEAL_SHARPNESS = 0.55;

/** Far floor (always on while scanning — avoid sudden spike) */
const FLOOR_INTENSITY = 0.1;
const FLOOR_SHARPNESS = 0.18;

/** On ghost cell (dist 0) */
const PEAK_INTENSITY = 0.62;
const PEAK_SHARPNESS = 0.28;

/** dist ≥ this uses pure floor */
const FAR_DIST = 5;

export type ScanHapticsHandle = {
  /** Call each frame while dragging a light (after stepGhosts). */
  onScanFrame: (args: {
    spotCell: { x: number; y: number } | null;
    ghostsPrev: Ghost[];
    ghosts: Ghost[];
    nowMs?: number;
  }) => void;
  /** Drop / cancel / dispose — stop session. */
  end: () => void;
  isActive: () => boolean;
};

function minManhattanToGhosts(
  cell: { x: number; y: number } | null,
  ghosts: Ghost[],
): number {
  if (!cell || ghosts.length === 0) return FAR_DIST + 1;
  let min = Infinity;
  for (const g of ghosts) {
    const d = Math.abs(g.x - cell.x) + Math.abs(g.y - cell.y);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Map manhattan dist → intensity/sharpness.
 * Smooth ease: closer ramps up; far stays on floor.
 */
export function intensityFromDist(dist: number): {
  intensity: number;
  sharpness: number;
} {
  if (!Number.isFinite(dist) || dist >= FAR_DIST) {
    return { intensity: FLOOR_INTENSITY, sharpness: FLOOR_SHARPNESS };
  }
  // t: 1 at dist0, 0 at FAR_DIST
  const t = 1 - dist / FAR_DIST;
  // ease-in so near range has more resolution (matches log-ish feel)
  const w = t * t;
  return {
    intensity: FLOOR_INTENSITY + (PEAK_INTENSITY - FLOOR_INTENSITY) * w,
    sharpness: FLOOR_SHARPNESS + (PEAK_SHARPNESS - FLOOR_SHARPNESS) * w,
  };
}

function everLitMap(ghosts: Ghost[]): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const g of ghosts) m.set(g.id, g.everLit);
  return m;
}

export function createScanHaptics(): ScanHapticsHandle {
  let active = false;
  let continuousOn = false;
  let continuousStartedAt = 0;
  let lastUpdateAt = 0;
  let lastI = -1;
  let lastS = -1;
  let openTimer: ReturnType<typeof setTimeout> | null = null;
  let starting = false;

  const clearOpenTimer = () => {
    if (openTimer != null) {
      clearTimeout(openTimer);
      openTimer = null;
    }
  };

  const applyLevel = (intensity: number, sharpness: number, now: number) => {
    if (!continuousOn) return;
    if (now - lastUpdateAt < UPDATE_INTERVAL_MS) return;
    // skip tiny deltas to reduce IPC noise
    if (
      Math.abs(intensity - lastI) < 0.02 &&
      Math.abs(sharpness - lastS) < 0.02
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
  ) => {
    if (!active) return;
    const r = await haptics.startContinuous({
      // Base full; live level via updateContinuous multipliers
      intensity: 1,
      sharpness: 1,
      duration: CONTINUOUS_DURATION_S,
    });
    if (!active) {
      void haptics.stopContinuous();
      return;
    }
    continuousOn = r.ok;
    continuousStartedAt = now;
    lastI = -1;
    lastS = -1;
    lastUpdateAt = 0;
    if (continuousOn) {
      void haptics.updateContinuous({ intensity, sharpness });
      lastI = intensity;
      lastS = sharpness;
      lastUpdateAt = now;
    }
  };

  const renewIfNeeded = (intensity: number, sharpness: number, now: number) => {
    if (!continuousOn) return;
    if (now - continuousStartedAt < CONTINUOUS_DURATION_S * 1000 - RENEW_BEFORE_MS) {
      return;
    }
    void startContinuousAt(intensity, sharpness, now);
  };

  const fireRevealSpikes = (prev: Ghost[], next: Ghost[]) => {
    const before = everLitMap(prev);
    for (const g of next) {
      if (g.everLit && before.get(g.id) === false) {
        void haptics.playTransient(REVEAL_INTENSITY, REVEAL_SHARPNESS);
      }
    }
  };

  const webPulse = (intensity: number, now: number) => {
    if (haptics.isNativeIos()) return;
    if (now - lastUpdateAt < 120) return;
    lastUpdateAt = now;
    // Pattern length scales weakly with intensity
    const ms = Math.round(8 + intensity * 28);
    void haptics.stackImpact(intensity, FLOOR_SHARPNESS, ms);
  };

  const beginSession = (intensity: number, sharpness: number) => {
    if (active || starting) return;
    starting = true;
    active = true;
    // ① open lamp
    void haptics.playTransient(OPEN_INTENSITY, OPEN_SHARPNESS);
    clearOpenTimer();
    openTimer = setTimeout(() => {
      openTimer = null;
      starting = false;
      void startContinuousAt(intensity, sharpness, performance.now());
    }, OPEN_TO_CONTINUOUS_MS);
  };

  const end = () => {
    clearOpenTimer();
    starting = false;
    if (!active && !continuousOn) return;
    active = false;
    continuousOn = false;
    continuousStartedAt = 0;
    lastI = -1;
    lastS = -1;
    void haptics.stopContinuous();
  };

  return {
    isActive: () => active,

    onScanFrame: ({ spotCell, ghostsPrev, ghosts, nowMs }) => {
      const now = nowMs ?? performance.now();
      const dist = minManhattanToGhosts(spotCell, ghosts);
      const { intensity, sharpness } = intensityFromDist(dist);

      if (!active) {
        beginSession(intensity, sharpness);
        // still check reveal in same frame (rare)
        fireRevealSpikes(ghostsPrev, ghosts);
        return;
      }

      if (starting) {
        fireRevealSpikes(ghostsPrev, ghosts);
        return;
      }

      if (continuousOn) {
        renewIfNeeded(intensity, sharpness, now);
        applyLevel(intensity, sharpness, now);
      } else {
        webPulse(intensity, now);
      }

      fireRevealSpikes(ghostsPrev, ghosts);
    },

    end,
  };
}
