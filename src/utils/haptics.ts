/**
 * Game-facing haptics bridge (AdvancedHaptics Capacitor plugin).
 * Native iOS: Core Haptics + UIKit fallbacks.
 * Web: navigator.vibrate when available; otherwise soft no-op.
 *
 * True source: plugins/native-haptics/*.swift → npm run ios:bootstrap
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
type NotificationType = 'success' | 'warning' | 'error';

export type HapticEvent = {
  type: 'transient' | 'continuous';
  relativeTime?: number;
  duration?: number;
  intensity?: number;
  sharpness?: number;
  attackTime?: number;
  decayTime?: number;
  releaseTime?: number;
};

export type HapticCurve = {
  parameterID: 'hapticIntensity' | 'hapticSharpness';
  relativeTime: number;
  controlPoints: { relativeTime: number; parameterValue: number }[];
};

type AdvancedHapticsPlugin = {
  impact(opts?: {
    style?: ImpactStyle;
    intensity?: number;
    withBuzz?: boolean;
  }): Promise<unknown>;
  notification(opts?: { type?: NotificationType }): Promise<unknown>;
  selection(): Promise<unknown>;
  playPattern(opts: {
    events: HapticEvent[];
    parameterCurves?: HapticCurve[];
  }): Promise<unknown>;
  stackImpact(opts: { intensity: number; sharpness: number }): Promise<unknown>;
  startContinuousHaptic(opts: {
    intensity: number;
    sharpness: number;
    duration?: number;
  }): Promise<unknown>;
  updateContinuousHaptic(opts: {
    intensity: number;
    sharpness: number;
  }): Promise<unknown>;
  stopContinuousHaptic(): Promise<unknown>;
  setKeepAwake(opts: { enabled: boolean }): Promise<{ enabled: boolean }>;
  diagnose(): Promise<Record<string, unknown>>;
  buzz(opts?: { style?: ImpactStyle }): Promise<unknown>;
  prepare?(): Promise<{ supported?: boolean; fallback?: boolean }>;
};

/**
 * Do NOT register a `web` impl that no-ops — on iOS, if PluginHeaders
 * miss the native plugin, Capacitor would silently use web and never
 * hit Swift. Prefer UNIMPLEMENTED so we can see failures.
 */
const AdvancedHaptics = registerPlugin<AdvancedHapticsPlugin>('AdvancedHaptics');

let enabled = true;
let lastError = '';

const isNativeIos = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

/**
 * Local plugins registered in BridgeViewController may report
 * isPluginAvailable=false on some Capacitor builds — still call native.
 */
const pluginReady = () => isNativeIos();

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

async function safely(fn: () => Promise<unknown>): Promise<{ ok: boolean; reason?: string }> {
  if (!enabled) {
    lastError = 'disabled';
    return { ok: false, reason: lastError };
  }
  if (!pluginReady()) {
    lastError = isNativeIos() ? 'plugin_unavailable' : 'not_native_ios';
    return { ok: false, reason: lastError };
  }
  try {
    await fn();
    lastError = '';
    return { ok: true };
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.warn('[haptics]', lastError);
    return { ok: false, reason: lastError };
  }
}

function vibrateWeb(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export type HapticsDiagnose = {
  ok: boolean;
  platform: string;
  isNative: boolean;
  isIos: boolean;
  pluginAvailable: boolean;
  lastError: string;
  native?: Record<string, unknown>;
  impactResult?: { ok: boolean; reason?: string };
  buzzResult?: { ok: boolean; reason?: string };
  note: string;
};

export const haptics = {
  isEnabled: () => enabled,
  setEnabled: (v: boolean) => {
    enabled = v;
  },
  isNativeIos: () => isNativeIos(),
  getLastError: () => lastError,

  /**
   * End-to-end check: platform → PluginHeaders → diagnose → impact → buzz.
   * Surface result in UI / console.
   */
  async diagnose(): Promise<HapticsDiagnose> {
    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();
    const isIos = platform === 'ios';
    const pluginAvailable = Capacitor.isPluginAvailable('AdvancedHaptics');
    const out: HapticsDiagnose = {
      ok: false,
      platform,
      isNative,
      isIos,
      pluginAvailable,
      lastError: lastError,
      note: '',
    };

    if (!isNative || !isIos) {
      out.note =
        '当前不是 iOS Capacitor 壳（浏览器 / 桌面 dev 无真机震动）。请用 Xcode Run 到 iPhone。';
      console.warn('[haptics.diagnose]', out);
      return out;
    }

    if (!pluginAvailable) {
      out.note =
        'Capacitor.isPluginAvailable(AdvancedHaptics)=false：原生未导出 PluginHeaders。检查 BridgeViewController 是否 registerPluginInstance，并重新编译 iOS（非仅 sync web）。';
      console.warn('[haptics.diagnose]', out);
      // still try nativePromise — sometimes header lags
    }

    try {
      out.native = await AdvancedHaptics.diagnose();
    } catch (err) {
      out.note = `diagnose() 调用失败: ${err instanceof Error ? err.message : String(err)}`;
      console.warn('[haptics.diagnose]', out, err);
      return out;
    }

    out.impactResult = await this.impact('medium');
    out.buzzResult = await this.buzz('medium');
    out.lastError = lastError;
    out.ok = !!(out.impactResult?.ok || out.buzzResult?.ok);
    out.note = out.ok
      ? '原生已响应。若仍无感：系统设置→声音与触感→系统触感反馈 打开。'
      : `原生 diagnose 有回包但 impact/buzz 失败: ${lastError}`;
    console.info('[haptics.diagnose]', out);
    return out;
  },

  async buzz(style: ImpactStyle = 'medium'): Promise<{ ok: boolean; reason?: string }> {
    if (!enabled) return { ok: false, reason: 'disabled' };
    if (!pluginReady()) {
      vibrateWeb(20);
      return { ok: false, reason: 'not_native_ios' };
    }
    return safely(() => AdvancedHaptics.buzz({ style }));
  },

  async prepare(): Promise<{ ok: boolean; reason?: string; result?: unknown }> {
    if (!enabled) return { ok: false, reason: 'disabled' };
    if (!pluginReady()) {
      lastError = 'not_native_ios';
      return { ok: false, reason: lastError };
    }
    if (typeof AdvancedHaptics.prepare === 'function') {
      try {
        const result = await AdvancedHaptics.prepare();
        return { ok: true, result };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        return { ok: false, reason: lastError };
      }
    }
    // Warm UIKit path via light impact without strong feedback intent
    return safely(() => AdvancedHaptics.impact({ style: 'soft' }));
  },

  async impact(
    style: ImpactStyle = 'medium',
    webMs = 10,
    opts?: { intensity?: number; withBuzz?: boolean },
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!enabled) return { ok: false, reason: 'disabled' };
    if (!pluginReady()) {
      vibrateWeb(webMs);
      return { ok: false, reason: 'not_native_ios' };
    }
    return safely(() =>
      AdvancedHaptics.impact({
        style,
        intensity: opts?.intensity != null ? clamp01(opts.intensity) : 1,
        withBuzz: opts?.withBuzz ?? false,
      }),
    );
  },

  async notification(
    type: NotificationType = 'success',
    webMs = 16,
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!enabled) return { ok: false, reason: 'disabled' };
    if (!pluginReady()) {
      vibrateWeb(webMs);
      return { ok: false, reason: 'not_native_ios' };
    }
    return safely(() => AdvancedHaptics.notification({ type }));
  },

  async selection(webMs = 6): Promise<{ ok: boolean; reason?: string }> {
    if (!enabled) return { ok: false, reason: 'disabled' };
    if (!pluginReady()) {
      vibrateWeb(webMs);
      return { ok: false, reason: 'not_native_ios' };
    }
    return safely(() => AdvancedHaptics.selection());
  },

  async playTransient(
    intensity = 0.45,
    sharpness = 0.4,
  ): Promise<{ ok: boolean; reason?: string }> {
    return this.stackImpact(intensity, sharpness);
  },

  async stackImpact(
    intensity: number,
    sharpness = 0.15,
    webMs = 8,
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!enabled) return { ok: false, reason: 'disabled' };
    if (!pluginReady()) {
      vibrateWeb(webMs);
      return { ok: false, reason: 'not_native_ios' };
    }
    return safely(() =>
      AdvancedHaptics.stackImpact({
        intensity: clamp01(intensity),
        sharpness: clamp01(sharpness),
      }),
    );
  },

  async playPattern(
    events: HapticEvent[],
    parameterCurves?: HapticCurve[],
    webPattern: number | number[] = 12,
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!enabled) return { ok: false, reason: 'disabled' };
    if (!pluginReady()) {
      vibrateWeb(webPattern);
      return { ok: false, reason: 'not_native_ios' };
    }
    return safely(() =>
      AdvancedHaptics.playPattern(
        parameterCurves ? { events, parameterCurves } : { events },
      ),
    );
  },

  async startContinuous(opts: {
    intensity: number;
    sharpness: number;
    duration?: number;
  }): Promise<{ ok: boolean; reason?: string }> {
    if (!enabled) return { ok: false, reason: 'disabled' };
    if (!pluginReady()) return { ok: false, reason: 'not_native_ios' };
    return safely(() =>
      AdvancedHaptics.startContinuousHaptic({
        intensity: clamp01(opts.intensity),
        sharpness: clamp01(opts.sharpness),
        duration: opts.duration,
      }),
    );
  },

  async updateContinuous(opts: {
    intensity: number;
    sharpness: number;
  }): Promise<{ ok: boolean; reason?: string }> {
    if (!enabled) return { ok: false, reason: 'disabled' };
    if (!pluginReady()) return { ok: false, reason: 'not_native_ios' };
    return safely(() =>
      AdvancedHaptics.updateContinuousHaptic({
        intensity: clamp01(opts.intensity),
        sharpness: clamp01(opts.sharpness),
      }),
    );
  },

  async stopContinuous(): Promise<{ ok: boolean; reason?: string }> {
    // Always attempt stop when native; ignore enabled so end-of-session can mute
    if (!pluginReady()) return { ok: false, reason: 'not_native_ios' };
    try {
      await AdvancedHaptics.stopContinuousHaptic();
      lastError = '';
      return { ok: true };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: lastError };
    }
  },

  async setKeepAwake(keep: boolean): Promise<{ ok: boolean; reason?: string }> {
    if (!pluginReady()) {
      // Best-effort web Wake Lock
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> };
        };
        if (keep && nav.wakeLock) {
          await nav.wakeLock.request('screen');
        }
      } catch {
        /* ignore */
      }
      return { ok: false, reason: 'not_native_ios' };
    }
    return safely(() => AdvancedHaptics.setKeepAwake({ enabled: keep }));
  },
};
