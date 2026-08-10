/**
 * 扫描震动会话状态机（HAPTICS_SPEC）。
 *
 * ① open → ② continuous（近鬼线性 + 蓄光爬升）→ ③ 过格 → ④ 出场三连（关底噪）→ ⑤ end
 */

import { haptics } from '../../utils/haptics';
import { GHOST_REVEAL_DWELL_MS } from '../ghosts';
import type { Ghost } from '../types';
import { cellKey } from '../types';
import { SCAN_HAPTIC } from './haptic-config';
import {
  everLitMap,
  impactStyleFromLevel,
  isUndiscoveredGhostCell,
  minManhattanToUndiscovered,
  scanContinuousLevel,
} from './haptic-math';
import {
  playGhostPassPattern,
  playOpenPattern,
  playRevealPattern,
  startLeveledContinuous,
} from './haptic-patterns';

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

/** @deprecated 使用 haptic-math.intensityFromDist；保留 re-export 兼容 */
export { intensityFromDist } from './haptic-math';

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
  let lastSpotKey: string | null = null;
  let lastGhostPassAt = 0;
  let revealTimeoutIds: number[] = [];
  /** 出场三连期间：停 continuous / 禁止重开底噪 */
  let revealGate = false;

  const clearOpenTimer = () => {
    if (openTimer != null) {
      clearTimeout(openTimer);
      openTimer = null;
    }
  };

  const clearRevealTimeouts = () => {
    for (const id of revealTimeoutIds) window.clearTimeout(id);
    revealTimeoutIds = [];
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

    const ok = await startLeveledContinuous({ intensity, sharpness });
    if (!active || myGen !== gen) {
      void haptics.stopContinuous();
      return;
    }

    if (ok) {
      continuousOn = true;
      pulseFallback = false;
      continuousStartedAt = now;
      lastI = intensity;
      lastS = sharpness;
      lastUpdateAt = now;
    } else {
      continuousOn = false;
      pulseFallback = true;
      console.warn(
        '[scan-haptics] continuous failed, pulse fallback',
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

  /**
   * 出场三连：瞬间关 continuous，三连结束后若仍握灯再开底噪。
   */
  const beginRevealSequence = (myGen: number) => {
    clearRevealTimeouts();
    revealGate = true;
    continuousOn = false;
    pulseFallback = false;
    lastI = -1;
    lastS = -1;
    void haptics.stopContinuous();

    const ids = playRevealPattern(() => {
      if (!active || myGen !== gen) return;
      revealGate = false;
      // 仍在扫描会话：按当前近鬼电平重开底噪
      void startContinuousAt(
        desiredI,
        desiredS,
        performance.now(),
        myGen,
      );
    });
    revealTimeoutIds.push(...ids);
  };

  const fireRevealSpikes = (prev: Ghost[], next: Ghost[]) => {
    const before = everLitMap(prev);
    let any = false;
    for (const g of next) {
      if (g.everLit && before.get(g.id) === false) any = true;
    }
    if (any) beginRevealSequence(gen);
  };

  /**
   * 过未发现鬼格：光斑中心换到鬼格时轻震。
   * 扫描中普通换格不震（手电投影换格仅在可落格吸附时由 placement-haptics 处理）。
   */
  const maybeGhostPass = (
    spotCell: { x: number; y: number } | null,
    ghosts: Ghost[],
    now: number,
  ) => {
    const key = spotCell ? cellKey(spotCell.x, spotCell.y) : null;
    if (key === lastSpotKey) return;
    const entered =
      key != null && isUndiscoveredGhostCell(spotCell, ghosts);
    lastSpotKey = key;
    if (!entered) return;
    if (now - lastGhostPassAt < SCAN_HAPTIC.ghostPassCooldownMs) return;
    lastGhostPassAt = now;
    playGhostPassPattern();
  };

  const beginSession = () => {
    if (active || starting) return;
    starting = true;
    active = true;
    const myGen = ++gen;
    lastSpotKey = null;

    playOpenPattern();

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
    clearRevealTimeouts();
    starting = false;
    revealGate = false;
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
      const dist = minManhattanToUndiscovered(spotCell, ghosts);
      // 近鬼线性 + 压格蓄光时 peak→chargePeak（与 dwell 1s 同步）
      const { intensity, sharpness } = scanContinuousLevel({
        dist,
        spotCell,
        ghosts,
        nowMs: now,
        dwellMs: GHOST_REVEAL_DWELL_MS,
      });
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

      // 出场三连期间：不维持/不更新 continuous 底噪
      if (!revealGate) {
        if (continuousOn) {
          renewIfNeeded(intensity, sharpness, now, gen);
          applyLevel(intensity, sharpness, now);
        } else {
          pulseFallback = true;
          pulseTick(intensity, now);
        }
      }

      maybeGhostPass(spotCell, ghosts, now);
      fireRevealSpikes(ghostsPrev, ghosts);
    },

    end,
  };
}
