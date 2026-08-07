/**
 * 扫描震动可播放模式（无会话状态）。
 * 供 scan-haptics 与调参试振共用。
 */

import { haptics } from '../../utils/haptics';
import { SCAN_HAPTIC } from './haptic-config';
import { impactStyleFromLevel } from './haptic-math';

export type TransientHit = {
  intensity: number;
  sharpness: number;
  /** 是否叠 UIKit impact */
  withUiKit?: boolean;
};

function playHit(hit: TransientHit): void {
  void haptics.playTransient(hit.intensity, hit.sharpness);
  if (hit.withUiKit) {
    void haptics.impact(impactStyleFromLevel(hit.intensity), 10, {
      intensity: hit.intensity,
    });
  }
}

/** 开灯一次 */
export function playOpenPattern(): void {
  const i = SCAN_HAPTIC.openIntensity;
  const s = SCAN_HAPTIC.openSharpness;
  playHit({
    intensity: i,
    sharpness: s,
    withUiKit: SCAN_HAPTIC.useImpactOpen >= 0.5,
  });
}

/** 过未发现鬼格：轻瞬态 */
export function playGhostPassPattern(): void {
  const i = SCAN_HAPTIC.ghostPassIntensity;
  const s = SCAN_HAPTIC.ghostPassSharpness;
  playHit({
    intensity: i,
    sharpness: s,
    withUiKit: SCAN_HAPTIC.useImpactGhostPass >= 0.5,
  });
}

/**
 * 出场三连。返回 timeout id，便于会话 end 时 cancel。
 * onComplete：#3 触发后调用（底噪恢复等）。
 */
export function playRevealPattern(onComplete?: () => void): number[] {
  const h = SCAN_HAPTIC;
  const t12 = Math.max(0, h.reveal1to2Ms);
  const t23 = Math.max(0, h.reveal2to3Ms);
  const totalMs = t12 + t23;

  const hits: TransientHit[] = [
    {
      intensity: h.reveal1Intensity,
      sharpness: h.reveal1Sharpness,
      withUiKit: h.useImpactReveal >= 0.5,
    },
    {
      intensity: h.reveal2Intensity,
      sharpness: h.reveal2Sharpness,
      withUiKit: false,
    },
    {
      intensity: h.reveal3Intensity,
      sharpness: h.reveal3Sharpness,
      withUiKit: false,
    },
  ];

  playHit(hits[0]!);
  const ids: number[] = [];
  ids.push(
    window.setTimeout(() => {
      playHit(hits[1]!);
    }, t12),
  );
  ids.push(
    window.setTimeout(() => {
      playHit(hits[2]!);
      onComplete?.();
    }, totalMs),
  );
  return ids;
}

/** 三连总时长（到 #3 触发时刻，ms） */
export function revealPatternDurationMs(): number {
  return (
    Math.max(0, SCAN_HAPTIC.reveal1to2Ms) +
    Math.max(0, SCAN_HAPTIC.reveal2to3Ms)
  );
}

/** 异步版：试振按钮 await 完整三连 */
export async function playRevealPatternAsync(): Promise<void> {
  const h = SCAN_HAPTIC;
  const hit = async (i: number, s: number, ui: boolean) => {
    await haptics.playTransient(i, s);
    if (ui && h.useImpactReveal >= 0.5) {
      await haptics.impact(impactStyleFromLevel(i), 10, { intensity: i });
    }
  };
  await hit(h.reveal1Intensity, h.reveal1Sharpness, true);
  await new Promise((r) => setTimeout(r, Math.max(0, h.reveal1to2Ms)));
  await hit(h.reveal2Intensity, h.reveal2Sharpness, false);
  await new Promise((r) => setTimeout(r, Math.max(0, h.reveal2to3Ms)));
  await hit(h.reveal3Intensity, h.reveal3Sharpness, false);
}

/** continuous：base=1，level 为绝对 0…1 */
export async function startLeveledContinuous(
  level: { intensity: number; sharpness: number },
): Promise<boolean> {
  const r = await haptics.startContinuous({
    intensity: 1,
    sharpness: 1,
    duration: Math.min(30, SCAN_HAPTIC.continuousDurationS),
  });
  if (!r.ok) return false;
  await haptics.updateContinuous(level);
  return true;
}
