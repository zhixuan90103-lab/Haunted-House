/**
 * 扫描震动参数（R12）。
 *
 * 模型：
 *  - 开灯：一次瞬态
 *  - 扫描中：固定很浅 continuous 底噪
 *  - 近鬼：按曼哈顿线性抬升 continuous
 *  - 光斑滑入未发现鬼格：轻瞬态
 *  - 鬼首次 everLit：三段可调瞬态
 */

export type ScanHapticConfig = {
  openIntensity: number;
  openSharpness: number;
  openToContinuousMs: number;

  /**
   * 出场三段瞬态：
   * t=0 → #1；+reveal1to2Ms → #2；+reveal2to3Ms → #3
   */
  reveal1Intensity: number;
  reveal1Sharpness: number;
  reveal1to2Ms: number;
  reveal2Intensity: number;
  reveal2Sharpness: number;
  reveal2to3Ms: number;
  reveal3Intensity: number;
  reveal3Sharpness: number;

  floorIntensity: number;
  floorSharpness: number;
  peakIntensity: number;
  peakSharpness: number;
  nearRadius: number;

  ghostPassIntensity: number;
  ghostPassSharpness: number;
  ghostPassCooldownMs: number;

  updateIntervalMs: number;
  continuousDurationS: number;
  renewBeforeMs: number;
  pulseFallbackMs: number;

  useImpactOpen: number;
  /** 出场第 1 下是否叠 UIKit（避免三连 UIKit 过吵） */
  useImpactReveal: number;
  useImpactGhostPass: number;

  farDist: number;
};

export const SCAN_HAPTIC: ScanHapticConfig = {
  openIntensity: 0.6,
  openSharpness: 0.8,
  openToContinuousMs: 65,

  // 出场三连
  reveal1Intensity: 0.6,
  reveal1Sharpness: 0.2,
  reveal1to2Ms: 40,
  reveal2Intensity: 0.4,
  reveal2Sharpness: 0.29,
  reveal2to3Ms: 40,
  reveal3Intensity: 0.33,
  reveal3Sharpness: 0.62,

  floorIntensity: 0.15,
  floorSharpness: 0.01,
  peakIntensity: 0.2,
  peakSharpness: 0.1,
  nearRadius: 3,

  ghostPassIntensity: 0.51,
  ghostPassSharpness: 0.18,
  ghostPassCooldownMs: 180,

  updateIntervalMs: 50,
  continuousDurationS: 30,
  renewBeforeMs: 2500,
  pulseFallbackMs: 90,

  useImpactOpen: 1,
  useImpactReveal: 1,
  useImpactGhostPass: 0,

  farDist: 5,
};

export const DEFAULT_SCAN_HAPTIC: ScanHapticConfig = { ...SCAN_HAPTIC };

export function setScanHaptic(partial: Partial<ScanHapticConfig>): void {
  Object.assign(SCAN_HAPTIC, partial);
  if (SCAN_HAPTIC.continuousDurationS > 30) {
    SCAN_HAPTIC.continuousDurationS = 30;
  }
  if (SCAN_HAPTIC.nearRadius < 0) SCAN_HAPTIC.nearRadius = 0;
  if (SCAN_HAPTIC.farDist < 1) SCAN_HAPTIC.farDist = 1;
  for (const k of ['reveal1to2Ms', 'reveal2to3Ms'] as const) {
    if (SCAN_HAPTIC[k] < 0) SCAN_HAPTIC[k] = 0;
  }
}

export function resetScanHaptic(): void {
  Object.assign(SCAN_HAPTIC, DEFAULT_SCAN_HAPTIC);
}

export function scanHapticSnapshot(): string {
  const h = SCAN_HAPTIC;
  return [
    `SCAN_HAPTIC:`,
    `  openIntensity: ${h.openIntensity}, openSharpness: ${h.openSharpness},`,
    `  openToContinuousMs: ${h.openToContinuousMs},`,
    `  floorIntensity: ${h.floorIntensity}, floorSharpness: ${h.floorSharpness},`,
    `  peakIntensity: ${h.peakIntensity}, peakSharpness: ${h.peakSharpness},`,
    `  nearRadius: ${h.nearRadius},`,
    `  ghostPassIntensity: ${h.ghostPassIntensity}, ghostPassSharpness: ${h.ghostPassSharpness},`,
    `  ghostPassCooldownMs: ${h.ghostPassCooldownMs},`,
    `  reveal1Intensity: ${h.reveal1Intensity}, reveal1Sharpness: ${h.reveal1Sharpness},`,
    `  reveal1to2Ms: ${h.reveal1to2Ms},`,
    `  reveal2Intensity: ${h.reveal2Intensity}, reveal2Sharpness: ${h.reveal2Sharpness},`,
    `  reveal2to3Ms: ${h.reveal2to3Ms},`,
    `  reveal3Intensity: ${h.reveal3Intensity}, reveal3Sharpness: ${h.reveal3Sharpness},`,
    `  updateIntervalMs: ${h.updateIntervalMs},`,
    `  continuousDurationS: ${h.continuousDurationS},`,
    `  useImpactOpen: ${h.useImpactOpen}, useImpactReveal: ${h.useImpactReveal}, useImpactGhostPass: ${h.useImpactGhostPass},`,
  ].join('\n');
}
