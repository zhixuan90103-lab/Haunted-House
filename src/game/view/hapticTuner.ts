/**
 * 扫描震动调参面板：滑条 + 试振按钮。
 * FAB 在左下，与右下 ⚙ 外观调参错开。
 */

import { haptics } from '../../utils/haptics';
import {
  DEFAULT_SCAN_HAPTIC,
  resetScanHaptic,
  SCAN_HAPTIC,
  scanHapticSnapshot,
  setScanHaptic,
  type ScanHapticConfig,
} from '../feel/haptic-config';
import {
  playGhostPassPattern,
  playOpenPattern,
  playRevealPatternAsync,
  startLeveledContinuous,
} from '../feel/haptic-patterns';

export type HapticTunerHandle = {
  dispose: () => void;
  el: HTMLElement;
};

type SliderDef = {
  key: keyof ScanHapticConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  section: string;
};

const SLIDERS: SliderDef[] = [
  { section: '① 开灯', key: 'openIntensity', label: '开灯 intensity', min: 0, max: 1, step: 0.01 },
  { section: '① 开灯', key: 'openSharpness', label: '开灯 sharpness', min: 0, max: 1, step: 0.01 },
  { section: '① 开灯', key: 'openToContinuousMs', label: '开灯→持续 ms', min: 0, max: 300, step: 5 },
  { section: '① 开灯', key: 'useImpactOpen', label: '开灯 UIKit', min: 0, max: 1, step: 1 },

  { section: '② 底噪 continuous', key: 'floorIntensity', label: '底噪 intensity', min: 0, max: 0.5, step: 0.01 },
  { section: '② 底噪 continuous', key: 'floorSharpness', label: '底噪 sharpness', min: 0, max: 1, step: 0.01 },
  { section: '② 底噪 continuous', key: 'peakIntensity', label: '近鬼 intensity', min: 0, max: 0.5, step: 0.01 },
  { section: '② 底噪 continuous', key: 'peakSharpness', label: '近鬼 sharpness', min: 0, max: 1, step: 0.01 },
  { section: '② 底噪 continuous', key: 'nearRadius', label: '线性半径(格)', min: 1, max: 6, step: 1 },
  { section: '② 底噪 continuous', key: 'chargePeakIntensity', label: '蓄光满 intensity', min: 0, max: 1, step: 0.01 },
  { section: '② 底噪 continuous', key: 'chargePeakSharpness', label: '蓄光满 sharpness', min: 0, max: 1, step: 0.01 },
  { section: '② 底噪 continuous', key: 'updateIntervalMs', label: '更新间隔 ms', min: 16, max: 200, step: 2 },

  { section: '③ 过鬼格', key: 'ghostPassIntensity', label: '过鬼 intensity', min: 0, max: 1, step: 0.01 },
  { section: '③ 过鬼格', key: 'ghostPassSharpness', label: '过鬼 sharpness', min: 0, max: 1, step: 0.01 },
  { section: '③ 过鬼格', key: 'ghostPassCooldownMs', label: '过鬼冷却 ms', min: 50, max: 600, step: 10 },
  { section: '③ 过鬼格', key: 'useImpactGhostPass', label: '过鬼 UIKit', min: 0, max: 1, step: 1 },

  { section: '④ 出场三连 #1', key: 'reveal1Intensity', label: '#1 intensity', min: 0, max: 1, step: 0.01 },
  { section: '④ 出场三连 #1', key: 'reveal1Sharpness', label: '#1 sharpness', min: 0, max: 1, step: 0.01 },
  { section: '④ 出场三连 #1', key: 'reveal1to2Ms', label: '#1→#2 间隔 ms', min: 0, max: 300, step: 5 },
  { section: '④ 出场三连 #2', key: 'reveal2Intensity', label: '#2 intensity', min: 0, max: 1, step: 0.01 },
  { section: '④ 出场三连 #2', key: 'reveal2Sharpness', label: '#2 sharpness', min: 0, max: 1, step: 0.01 },
  { section: '④ 出场三连 #2', key: 'reveal2to3Ms', label: '#2→#3 间隔 ms', min: 0, max: 300, step: 5 },
  { section: '④ 出场三连 #3', key: 'reveal3Intensity', label: '#3 intensity', min: 0, max: 1, step: 0.01 },
  { section: '④ 出场三连 #3', key: 'reveal3Sharpness', label: '#3 sharpness', min: 0, max: 1, step: 0.01 },
  { section: '④ 出场三连 #3', key: 'useImpactReveal', label: '#1 叠 UIKit', min: 0, max: 1, step: 1 },

  { section: '引擎', key: 'continuousDurationS', label: 'continuous 秒', min: 2, max: 30, step: 1 },
  { section: '引擎', key: 'renewBeforeMs', label: '续播提前 ms', min: 500, max: 8000, step: 100 },
  { section: '引擎', key: 'pulseFallbackMs', label: '脉冲兜底 ms', min: 40, max: 250, step: 5 },
];

function formatVal(key: keyof ScanHapticConfig, n: number): string {
  if (
    key === 'useImpactOpen' ||
    key === 'useImpactReveal' ||
    key === 'useImpactGhostPass'
  ) {
    return n >= 0.5 ? '开' : '关';
  }
  if (
    key === 'openToContinuousMs' ||
    key === 'updateIntervalMs' ||
    key === 'pulseFallbackMs' ||
    key === 'renewBeforeMs' ||
    key === 'nearRadius' ||
    key === 'ghostPassCooldownMs' ||
    key === 'reveal1to2Ms' ||
    key === 'reveal2to3Ms' ||
    key === 'continuousDurationS'
  ) {
    return String(Math.round(n));
  }
  return n.toFixed(2);
}

export function mountHapticTuner(parent: HTMLElement): HapticTunerHandle {
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.id = 'haptic-tuner-fab';
  fab.className = 'haptic-tuner-fab';
  fab.setAttribute('aria-label', '震动调参');
  fab.textContent = '📳';
  fab.title = '震动调参';

  const root = document.createElement('div');
  root.className = 'layout-tuner haptic-tuner';
  root.id = 'haptic-tuner';
  root.hidden = true;

  const header = document.createElement('div');
  header.className = 'layout-tuner-header';

  const title = document.createElement('span');
  title.className = 'layout-tuner-title';
  title.textContent = '📳 震动';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'layout-tuner-close';
  closeBtn.textContent = '隐藏';

  header.append(title, closeBtn);

  const body = document.createElement('div');
  body.className = 'layout-tuner-body';

  // —— 诊断 + 试振 ——
  const testSec = document.createElement('div');
  testSec.className = 'layout-tuner-section';
  testSec.textContent = '试振 / 诊断（真机）';
  body.append(testSec);

  const status = document.createElement('div');
  status.className = 'haptic-tuner-status';
  status.textContent = '点「诊断」检查原生插件是否接通';
  body.append(status);

  const setStatus = (msg: string) => {
    status.textContent = msg;
    console.info('[haptic-tuner]', msg);
  };

  const tests = document.createElement('div');
  tests.className = 'haptic-tuner-tests';

  let testContinuous = false;

  const mkTest = (label: string, fn: () => void | Promise<void>) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      void Promise.resolve(fn()).catch((err) => {
        setStatus(`错误: ${err instanceof Error ? err.message : String(err)}`);
      });
    });
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    tests.append(b);
    return b;
  };

  mkTest('诊断', async () => {
    setStatus('诊断中…');
    const d = await haptics.diagnose();
    const lines = [
      d.ok ? '✅ 原生有响应' : '❌ 未接通',
      `platform=${d.platform} native=${d.isNative}`,
      `pluginAvailable=${d.pluginAvailable}`,
      d.native ? `coreHaptics=${String(d.native.supportsCoreHaptics)} engine=${String(d.native.engineRunning)}` : '',
      d.impactResult ? `impact.ok=${d.impactResult.ok}` : '',
      d.buzzResult ? `buzz.ok=${d.buzzResult.ok}` : '',
      d.note,
      d.lastError ? `err=${d.lastError}` : '',
    ].filter(Boolean);
    setStatus(lines.join(' · '));
  });

  mkTest('Buzz硬件', async () => {
    const r = await haptics.buzz('heavy');
    setStatus(r.ok ? 'buzz ok（AudioServices）' : `buzz fail: ${r.reason ?? haptics.getLastError()}`);
  });

  mkTest('开灯', async () => {
    playOpenPattern();
    setStatus(
      `开灯 i=${SCAN_HAPTIC.openIntensity.toFixed(2)} s=${SCAN_HAPTIC.openSharpness.toFixed(2)}`,
    );
  });

  mkTest('底噪持续', async () => {
    testContinuous = true;
    const ok = await startLeveledContinuous({
      intensity: SCAN_HAPTIC.floorIntensity,
      sharpness: SCAN_HAPTIC.floorSharpness,
    });
    setStatus(
      ok
        ? `底噪 i=${SCAN_HAPTIC.floorIntensity.toFixed(2)}`
        : `continuous fail: ${haptics.getLastError()}`,
    );
  });

  mkTest('近鬼持续', async () => {
    testContinuous = true;
    const ok = await startLeveledContinuous({
      intensity: SCAN_HAPTIC.peakIntensity,
      sharpness: SCAN_HAPTIC.peakSharpness,
    });
    setStatus(
      ok
        ? `近鬼 i=${SCAN_HAPTIC.peakIntensity.toFixed(2)}`
        : `continuous fail: ${haptics.getLastError()}`,
    );
  });

  mkTest('过鬼格', async () => {
    playGhostPassPattern();
    setStatus(`过鬼 i=${SCAN_HAPTIC.ghostPassIntensity.toFixed(2)}`);
  });

  mkTest('出场三连', async () => {
    await playRevealPatternAsync();
    const h = SCAN_HAPTIC;
    setStatus(
      `出场 ${h.reveal1to2Ms}+${h.reveal2to3Ms}ms · ${h.reveal1Intensity.toFixed(2)}/${h.reveal2Intensity.toFixed(2)}/${h.reveal3Intensity.toFixed(2)}`,
    );
  });

  mkTest('停持续', async () => {
    testContinuous = false;
    await haptics.stopContinuous();
    setStatus('stopped');
  });

  mkTest('soft/med/hvy', async () => {
    const a = await haptics.impact('soft');
    await new Promise((r) => setTimeout(r, 120));
    const b = await haptics.impact('medium');
    await new Promise((r) => setTimeout(r, 120));
    const c = await haptics.impact('heavy');
    setStatus(`soft=${a.ok} med=${b.ok} hvy=${c.ok}`);
  });

  body.append(tests);

  const valueEls = new Map<string, HTMLSpanElement>();
  const rangeEls = new Map<string, HTMLInputElement>();

  let lastSection = '';
  for (const def of SLIDERS) {
    if (def.section !== lastSection) {
      lastSection = def.section;
      const sec = document.createElement('div');
      sec.className = 'layout-tuner-section';
      sec.textContent = def.section;
      body.append(sec);
    }

    const row = document.createElement('label');
    row.className = 'layout-tuner-row';

    const name = document.createElement('span');
    name.className = 'layout-tuner-label';
    name.textContent = def.label;

    const val = document.createElement('span');
    val.className = 'layout-tuner-val';
    val.textContent = formatVal(def.key, SCAN_HAPTIC[def.key]);
    valueEls.set(def.key, val);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    input.value = String(SCAN_HAPTIC[def.key]);
    rangeEls.set(def.key, input);

    input.addEventListener('input', () => {
      const n = Number(input.value);
      setScanHaptic({ [def.key]: n });
      val.textContent = formatVal(def.key, SCAN_HAPTIC[def.key]);
      // Live retune continuous if a floor/peak test is running
      if (
        testContinuous &&
        (def.key === 'floorIntensity' ||
          def.key === 'floorSharpness' ||
          def.key === 'peakIntensity' ||
          def.key === 'peakSharpness')
      ) {
        const usePeak = def.key.startsWith('peak');
        void haptics.updateContinuous({
          intensity: usePeak
            ? SCAN_HAPTIC.peakIntensity
            : SCAN_HAPTIC.floorIntensity,
          sharpness: usePeak
            ? SCAN_HAPTIC.peakSharpness
            : SCAN_HAPTIC.floorSharpness,
        });
      }
    });
    input.addEventListener('pointerdown', (e) => e.stopPropagation());

    row.append(name, val, input);
    body.append(row);
  }

  const actions = document.createElement('div');
  actions.className = 'layout-tuner-actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = '复制参数';
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const text = scanHapticSnapshot();
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = '已复制';
      setTimeout(() => {
        copyBtn.textContent = '复制参数';
      }, 1200);
    } catch {
      console.info('[haptic-tune]', text);
      copyBtn.textContent = '见控制台';
      setTimeout(() => {
        copyBtn.textContent = '复制参数';
      }, 1200);
    }
  });

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = '重置';
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetScanHaptic();
    for (const def of SLIDERS) {
      const v = SCAN_HAPTIC[def.key];
      valueEls.get(def.key)!.textContent = formatVal(def.key, v);
      rangeEls.get(def.key)!.value = String(v);
    }
  });

  actions.append(copyBtn, resetBtn);
  body.append(actions);

  // 默认值提示（便于对照 DEFAULT）
  const hint = document.createElement('div');
  hint.className = 'haptic-tuner-hint';
  hint.textContent = `默认 peak ${DEFAULT_SCAN_HAPTIC.peakIntensity} / floor ${DEFAULT_SCAN_HAPTIC.floorIntensity}`;
  body.append(hint);

  const setVisible = (visible: boolean) => {
    root.hidden = !visible;
    fab.classList.toggle('is-open', visible);
    if (!visible && testContinuous) {
      testContinuous = false;
      void haptics.stopContinuous();
    }
  };

  fab.addEventListener('click', (e) => {
    e.stopPropagation();
    setVisible(root.hidden);
  });
  fab.addEventListener('pointerdown', (e) => e.stopPropagation());
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setVisible(false);
  });

  root.append(header, body);
  parent.append(fab, root);

  return {
    el: root,
    dispose: () => {
      if (testContinuous) void haptics.stopContinuous();
      fab.remove();
      root.remove();
    },
  };
}
