/**
 * 假灵动岛 / Mask / 照片 调参面板。
 * 点「岛」：开面板并预览岛 + Mask 轮廓。
 */

import {
  applyPrintLayoutCss,
  DEFAULT_PRINT_LAYOUT,
  PRINT_LAYOUT,
  resetPrintLayout,
  setPrintLayout,
  type PrintLayout,
} from '../printLayout';

export type IslandTunerHandle = {
  dispose: () => void;
  el: HTMLElement;
};

type SliderDef = {
  key: keyof PrintLayout;
  label: string;
  min: number;
  max: number;
  step: number;
  section: string;
};

const SLIDERS: SliderDef[] = [
  { section: '① 岛', key: 'islandTop', label: '岛上边缘 (px)', min: 0, max: 200, step: 1 },
  { section: '① 岛', key: 'islandCenterX', label: '岛中心 X', min: 40, max: 350, step: 1 },
  { section: '① 岛', key: 'islandWidth', label: '岛宽', min: 60, max: 280, step: 1 },
  { section: '① 岛', key: 'islandHeight', label: '岛高', min: 20, max: 60, step: 1 },
  { section: '① 岛', key: 'seamRatio', label: '切割位置 (0–1)', min: 0.1, max: 0.9, step: 0.01 },

  { section: '② Mask', key: 'maskWidth', label: 'Mask 宽', min: 100, max: 390, step: 2 },
  { section: '② Mask', key: 'maskLeft', label: 'Mask 左', min: 0, max: 200, step: 1 },
  { section: '② Mask', key: 'maskTop', label: 'Mask 顶', min: 0, max: 400, step: 1 },
  { section: '② Mask', key: 'maskHeight', label: 'Mask 高', min: 80, max: 844, step: 2 },

  { section: '③ 照片', key: 'phase1WidthRatio', label: '出岛宽/岛宽', min: 0.3, max: 1, step: 0.01 },
  { section: '③ 照片', key: 'polaroidMaxWidth', label: '最大宽 (px)', min: 120, max: 320, step: 2 },
  { section: '③ 照片', key: 'finalCenterX', label: '终点中心 X', min: 80, max: 310, step: 1 },
  { section: '③ 照片', key: 'finalTop', label: '终点中心 Y', min: 120, max: 700, step: 2 },

  { section: '④ 时间', key: 'slideOutMs', label: '滑出 (ms)', min: 300, max: 2500, step: 50 },
  { section: '④ 时间', key: 'flyMs', label: '飞入 (ms)', min: 300, max: 2500, step: 50 },
];

function formatVal(key: keyof PrintLayout, n: number): string {
  if (key === 'seamRatio' || key === 'phase1WidthRatio') return n.toFixed(2);
  return String(Math.round(n * 1000) / 1000);
}

export function mountIslandTuner(
  uiRoot: HTMLElement,
  opts?: { onChange?: () => void; onPreview?: (on: boolean) => void },
): IslandTunerHandle {
  applyPrintLayoutCss(uiRoot);

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.id = 'island-tuner-fab';
  fab.className = 'island-tuner-fab';
  fab.textContent = '岛';
  fab.title = '假灵动岛 / Mask 调参';
  fab.setAttribute('aria-label', '假灵动岛调参');

  const panel = document.createElement('div');
  panel.id = 'island-tuner';
  panel.className = 'island-tuner layout-tuner';
  panel.hidden = true;

  const title = document.createElement('div');
  title.className = 'layout-tuner-title';
  title.textContent = '岛 · Mask · 照片';

  const body = document.createElement('div');
  body.className = 'layout-tuner-body';

  // 颜色 + 跟随
  const colorRow = document.createElement('label');
  colorRow.className = 'layout-tuner-row island-tuner-color-row';
  const colorLab = document.createElement('span');
  colorLab.className = 'layout-tuner-label';
  colorLab.textContent = '岛颜色';
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = /^#/.test(PRINT_LAYOUT.islandColor)
    ? PRINT_LAYOUT.islandColor
    : '#000000';
  colorInput.addEventListener('pointerdown', (e) => e.stopPropagation());
  colorInput.addEventListener('input', () => {
    setPrintLayout({ islandColor: colorInput.value });
    applyPrintLayoutCss(uiRoot);
    opts?.onChange?.();
  });
  colorRow.append(colorLab, colorInput);
  body.append(colorRow);

  const followRow = document.createElement('label');
  followRow.className = 'layout-tuner-row island-tuner-check-row';
  const followLab = document.createElement('span');
  followLab.className = 'layout-tuner-label';
  followLab.textContent = 'Mask顶=岛上边缘';
  const followCb = document.createElement('input');
  followCb.type = 'checkbox';
  followCb.checked = PRINT_LAYOUT.maskFollowIslandTop;
  followCb.addEventListener('pointerdown', (e) => e.stopPropagation());
  followCb.addEventListener('change', () => {
    setPrintLayout({ maskFollowIslandTop: followCb.checked });
    if (followCb.checked) {
      setPrintLayout({
        maskTop: PRINT_LAYOUT.islandTop,
        maskHeight: Math.max(40, 844 - PRINT_LAYOUT.islandTop),
      });
    }
    applyPrintLayoutCss(uiRoot);
    syncSliderValues();
    opts?.onChange?.();
  });
  followRow.append(followLab, followCb);
  body.append(followRow);

  const valueEls = new Map<keyof PrintLayout, HTMLSpanElement>();
  const inputEls = new Map<keyof PrintLayout, HTMLInputElement>();
  let lastSection = '';

  for (const s of SLIDERS) {
    if (s.section !== lastSection) {
      lastSection = s.section;
      const sec = document.createElement('div');
      sec.className = 'layout-tuner-section';
      sec.textContent = s.section;
      body.append(sec);
    }
    const row = document.createElement('label');
    row.className = 'layout-tuner-row';
    const lab = document.createElement('span');
    lab.className = 'layout-tuner-label';
    lab.textContent = s.label;
    const val = document.createElement('span');
    val.className = 'layout-tuner-val';
    const cur = PRINT_LAYOUT[s.key];
    val.textContent = formatVal(s.key, Number(cur));
    valueEls.set(s.key, val);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(s.min);
    input.max = String(s.max);
    input.step = String(s.step);
    input.value = String(cur);
    inputEls.set(s.key, input);
    input.addEventListener('pointerdown', (e) => e.stopPropagation());
    input.addEventListener('input', () => {
      const n = Number(input.value);
      const patch: Partial<PrintLayout> = { [s.key]: n };
      // 岛上边缘变化且跟随 → 同步 mask
      if (s.key === 'islandTop' && PRINT_LAYOUT.maskFollowIslandTop) {
        patch.maskTop = n;
        patch.maskHeight = Math.max(40, 844 - n);
      }
      setPrintLayout(patch);
      val.textContent = formatVal(s.key, n);
      if (s.key === 'islandTop' && PRINT_LAYOUT.maskFollowIslandTop) {
        syncSliderValues();
      }
      applyPrintLayoutCss(uiRoot);
      opts?.onChange?.();
    });
    row.append(lab, val, input);
    body.append(row);
  }

  function syncSliderValues(): void {
    for (const s of SLIDERS) {
      const v = Number(PRINT_LAYOUT[s.key]);
      const inp = inputEls.get(s.key);
      const lab = valueEls.get(s.key);
      if (inp) inp.value = String(v);
      if (lab) lab.textContent = formatVal(s.key, v);
    }
    followCb.checked = PRINT_LAYOUT.maskFollowIslandTop;
    colorInput.value = /^#/.test(PRINT_LAYOUT.islandColor)
      ? PRINT_LAYOUT.islandColor
      : '#000000';
  }

  const actions = document.createElement('div');
  actions.className = 'layout-tuner-actions';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = '重置';
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetPrintLayout();
    applyPrintLayoutCss(uiRoot);
    syncSliderValues();
    opts?.onChange?.();
  });

  const dumpBtn = document.createElement('button');
  dumpBtn.type = 'button';
  dumpBtn.textContent = '复制';
  dumpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const text = JSON.stringify({ ...PRINT_LAYOUT }, null, 2);
    void navigator.clipboard?.writeText(text);
    console.info('[printLayout]', PRINT_LAYOUT);
  });

  actions.append(resetBtn, dumpBtn);
  panel.append(title, body, actions);

  const wrap = document.createElement('div');
  wrap.className = 'island-tuner-wrap';
  wrap.dataset.captureIgnore = '1';
  wrap.append(fab, panel);
  uiRoot.append(wrap);

  let previewOn = false;

  const setPreview = (on: boolean) => {
    previewOn = on;
    fab.classList.toggle('is-previewing', on);
    applyPrintLayoutCss(uiRoot);
    opts?.onPreview?.(on);
  };

  const toggle = (e: Event) => {
    e.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    fab.classList.toggle('is-open', open);
    setPreview(open);
  };
  fab.addEventListener('click', toggle);
  fab.addEventListener('pointerdown', (e) => e.stopPropagation());
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());

  return {
    el: wrap,
    dispose: () => {
      if (previewOn) opts?.onPreview?.(false);
      wrap.remove();
    },
  };
}

export { DEFAULT_PRINT_LAYOUT };
