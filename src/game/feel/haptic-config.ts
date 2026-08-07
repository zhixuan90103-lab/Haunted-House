/**
 * 扫描震动参数表（设计见 docs/HAPTICS_SPEC.md）。
 * 调参面板实时改写；复制后回写 DEFAULT。
 */

export type ScanHapticConfig = {
  // —— 开灯 ——
  openIntensity: number;
  openSharpness: number;
  openToContinuousMs: number;

  // —— 出场三连：t=0 → #1；+#1→#2 ms → #2；+#2→#3 ms → #3 ——
  reveal1Intensity: number;
  reveal1Sharpness: number;
  reveal1to2Ms: number;
  reveal2Intensity: number;
  reveal2Sharpness: number;
  reveal2to3Ms: number;
  reveal3Intensity: number;
  reveal3Sharpness: number;

  // —— continuous：底噪 / 贴鬼 peak / 线性半径（曼哈顿格）——
  floorIntensity: number;
  floorSharpness: number;
  peakIntensity: number;
  peakSharpness: number;
  nearRadius: number;

  /**
   * 首次出场蓄光（压住未发现鬼格、与 dwell 同钟）：
   * progress 0→1 时 continuous 从 peak 线性爬到 chargePeak
   */
  chargePeakIntensity: number;
  chargePeakSharpness: number;

  // —— 过未发现鬼格 ——
  ghostPassIntensity: number;
  ghostPassSharpness: number;
  ghostPassCooldownMs: number;

  // —— 引擎 ——
  updateIntervalMs: number;
  continuousDurationS: number;
  renewBeforeMs: number;
  pulseFallbackMs: number;

  // —— UIKit 叠加（0/1）——
  useImpactOpen: number;
  useImpactReveal: number;
  useImpactGhostPass: number;
};

/** 定稿默认（真机调参回写） */
export const SCAN_HAPTIC: ScanHapticConfig = {
  openIntensity: 0.6,
  openSharpness: 0.8,
  openToContinuousMs: 65,

  reveal1Intensity: 0.53,
  reveal1Sharpness: 0.46,
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

  chargePeakIntensity: 0.35,
  chargePeakSharpness: 0.15,

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
};

export const DEFAULT_SCAN_HAPTIC: ScanHapticConfig = { ...SCAN_HAPTIC };

export function setScanHaptic(partial: Partial<ScanHapticConfig>): void {
  Object.assign(SCAN_HAPTIC, partial);
  if (SCAN_HAPTIC.continuousDurationS > 30) {
    SCAN_HAPTIC.continuousDurationS = 30;
  }
  if (SCAN_HAPTIC.nearRadius < 1) SCAN_HAPTIC.nearRadius = 1;
  for (const k of [
    'openToContinuousMs',
    'reveal1to2Ms',
    'reveal2to3Ms',
    'ghostPassCooldownMs',
    'updateIntervalMs',
    'renewBeforeMs',
    'pulseFallbackMs',
  ] as const) {
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
    `  chargePeakIntensity: ${h.chargePeakIntensity}, chargePeakSharpness: ${h.chargePeakSharpness},`,
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
