/**
 * 假灵动岛位置调参：FAB + 滑条；预览岛位置。
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
};

const SLIDERS: SliderDef[] = [
  { key: 'islandTop', label: '岛 top (px)', min: 0, max: 200, step: 1 },
  { key: 'islandCenterX', label: '岛中心 X (px)', min: 40, max: 350, step: 1 },
  { key: 'islandWidth', label: '岛宽 (px)', min: 60, max: 220, step: 1 },
  { key: 'islandHeight', label: '岛高 (px)', min: 20, max: 56, step: 1 },
  { key: 'slideOutMs', label: '滑出时长 (ms)', min: 300, max: 2000, step: 50 },
  { key: 'flyMs', label: '放大飞入 (ms)', min: 300, max: 2000, step: 50 },
  { key: 'phase1WidthRatio', label: '出岛宽度/岛宽', min: 0.3, max: 1, step: 0.01 },
  { key: 'finalTopPercent', label: '终点 top (%)', min: 25, max: 60, step: 1 },
];

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
  fab.title = '假灵动岛位置';
  fab.setAttribute('aria-label', '假灵动岛调参');

  const panel = document.createElement('div');
  panel.id = 'island-tuner';
  panel.className = 'island-tuner layout-tuner';
  panel.hidden = true;

  const title = document.createElement('div');
  title.className = 'layout-tuner-title';
  title.textContent = '假灵动岛';

  const body = document.createElement('div');
  body.className = 'layout-tuner-body';

  const valueEls = new Map<keyof PrintLayout, HTMLSpanElement>();

  for (const s of SLIDERS) {
    const row = document.createElement('label');
    row.className = 'layout-tuner-row';
    const lab = document.createElement('span');
    lab.className = 'layout-tuner-label';
    lab.textContent = s.label;
    const val = document.createElement('span');
    val.className = 'layout-tuner-val';
    val.textContent = String(PRINT_LAYOUT[s.key]);
    valueEls.set(s.key, val);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(s.min);
    input.max = String(s.max);
    input.step = String(s.step);
    input.value = String(PRINT_LAYOUT[s.key]);
    input.addEventListener('pointerdown', (e) => e.stopPropagation());
    input.addEventListener('input', () => {
      const n = Number(input.value);
      setPrintLayout({ [s.key]: n });
      val.textContent = String(n);
      applyPrintLayoutCss(uiRoot);
      opts?.onChange?.();
    });
    row.append(lab, val, input);
    body.append(row);
  }

  const actions = document.createElement('div');
  actions.className = 'layout-tuner-actions';

  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.textContent = '预览岛';
  let previewOn = false;
  previewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    previewOn = !previewOn;
    previewBtn.textContent = previewOn ? '关预览' : '预览岛';
    previewBtn.classList.toggle('is-active', previewOn);
    opts?.onPreview?.(previewOn);
  });

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = '重置';
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetPrintLayout();
    applyPrintLayoutCss(uiRoot);
    const inputs = body.querySelectorAll<HTMLInputElement>('input[type=range]');
    SLIDERS.forEach((s, i) => {
      const inp = inputs[i];
      if (inp) inp.value = String(PRINT_LAYOUT[s.key]);
      valueEls.get(s.key)!.textContent = String(PRINT_LAYOUT[s.key]);
    });
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

  actions.append(previewBtn, resetBtn, dumpBtn);
  panel.append(title, body, actions);

  const wrap = document.createElement('div');
  wrap.className = 'island-tuner-wrap';
  wrap.dataset.captureIgnore = '1';
  wrap.append(fab, panel);
  uiRoot.append(wrap);

  const toggle = (e: Event) => {
    e.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    fab.classList.toggle('is-open', open);
    if (!open && previewOn) {
      previewOn = false;
      previewBtn.textContent = '预览岛';
      previewBtn.classList.remove('is-active');
      opts?.onPreview?.(false);
    }
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
