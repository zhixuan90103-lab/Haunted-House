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

  // —— 手电投影换格（拖灯吸附格变化）——
  lightProjIntensity: number;
  lightProjSharpness: number;
  lightProjCooldownMs: number;

  // —— 镜子投影换格 ——
  mirrorProjIntensity: number;
  mirrorProjSharpness: number;
  mirrorProjCooldownMs: number;

  // —— 点击旋转 ——
  rotateIntensity: number;
  rotateSharpness: number;

  // —— 引擎 ——
  updateIntervalMs: number;
  continuousDurationS: number;
  renewBeforeMs: number;
  pulseFallbackMs: number;

  // —— UIKit 叠加（0/1）——
  useImpactOpen: number;
  useImpactReveal: number;
  useImpactGhostPass: number;
  useImpactLightProj: number;
  useImpactMirrorProj: number;
  useImpactRotate: number;
};

/** 定稿默认（真机调参回写） */
export const SCAN_HAPTIC: ScanHapticConfig = {
  openIntensity: 0.6,
  openSharpness: 0.8,
  openToContinuousMs: 65,

  reveal1Intensity: 0.53,
  reveal1Sharpness: 0.46,
  reveal1to2Ms: 50,
  reveal2Intensity: 0.17,
  reveal2Sharpness: 0.29,
  reveal2to3Ms: 40,
  reveal3Intensity: 0.2,
  reveal3Sharpness: 0.47,

  floorIntensity: 0.12,
  floorSharpness: 0.44,
  peakIntensity: 0.2,
  peakSharpness: 0.1,
  nearRadius: 3,

  chargePeakIntensity: 0.35,
  chargePeakSharpness: 0.58,

  ghostPassIntensity: 0.39,
  ghostPassSharpness: 0.26,
  ghostPassCooldownMs: 180,

  // 仅「可落格」投影吸附时用；扫描光斑换格不震
  lightProjIntensity: 0.35,
  lightProjSharpness: 0.6,
  lightProjCooldownMs: 50,

  mirrorProjIntensity: 0.35,
  mirrorProjSharpness: 0.61,
  mirrorProjCooldownMs: 50,

  rotateIntensity: 0.53,
  rotateSharpness: 0.55,

  updateIntervalMs: 50,
  continuousDurationS: 30,
  renewBeforeMs: 2500,
  pulseFallbackMs: 90,

  useImpactOpen: 1,
  useImpactReveal: 1,
  useImpactGhostPass: 0,
  useImpactLightProj: 0,
  useImpactMirrorProj: 0,
  useImpactRotate: 0,
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
    'lightProjCooldownMs',
    'mirrorProjCooldownMs',
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
    `  lightProjIntensity: ${h.lightProjIntensity}, lightProjSharpness: ${h.lightProjSharpness},`,
    `  lightProjCooldownMs: ${h.lightProjCooldownMs},`,
    `  mirrorProjIntensity: ${h.mirrorProjIntensity}, mirrorProjSharpness: ${h.mirrorProjSharpness},`,
    `  mirrorProjCooldownMs: ${h.mirrorProjCooldownMs},`,
    `  rotateIntensity: ${h.rotateIntensity}, rotateSharpness: ${h.rotateSharpness},`,
    `  reveal1Intensity: ${h.reveal1Intensity}, reveal1Sharpness: ${h.reveal1Sharpness},`,
    `  reveal1to2Ms: ${h.reveal1to2Ms},`,
    `  reveal2Intensity: ${h.reveal2Intensity}, reveal2Sharpness: ${h.reveal2Sharpness},`,
    `  reveal2to3Ms: ${h.reveal2to3Ms},`,
    `  reveal3Intensity: ${h.reveal3Intensity}, reveal3Sharpness: ${h.reveal3Sharpness},`,
    `  updateIntervalMs: ${h.updateIntervalMs},`,
    `  continuousDurationS: ${h.continuousDurationS},`,
    `  useImpactOpen: ${h.useImpactOpen}, useImpactReveal: ${h.useImpactReveal}, useImpactGhostPass: ${h.useImpactGhostPass},`,
    `  useImpactLightProj: ${h.useImpactLightProj}, useImpactMirrorProj: ${h.useImpactMirrorProj}, useImpactRotate: ${h.useImpactRotate},`,
  ].join('\n');
}
