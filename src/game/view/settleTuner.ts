/**
 * 挑战结算调参：最终照片位置/大小/旋转、抓到了、再玩一次位置。
 */

import {
  applyPrintLayoutCss,
  DEFAULT_PRINT_LAYOUT,
  PRINT_LAYOUT,
  setPrintLayout,
  type PrintLayout,
} from '../printLayout';

export type SettleTunerHandle = {
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
  { section: '① 最终照片', key: 'finalCenterX', label: '中心 X', min: 60, max: 330, step: 1 },
  { section: '① 最终照片', key: 'finalTop', label: '中心 Y', min: 80, max: 720, step: 1 },
  { section: '① 最终照片', key: 'polaroidMaxWidth', label: '宽度', min: 100, max: 360, step: 2 },
  { section: '① 最终照片', key: 'finalRotateDeg', label: '旋转°', min: -30, max: 30, step: 0.5 },

  { section: '② 抓到了', key: 'titleCenterX', label: '中心 X', min: 40, max: 350, step: 1 },
  { section: '② 抓到了', key: 'titleCenterY', label: '中心 Y', min: 40, max: 780, step: 1 },
  { section: '② 抓到了', key: 'titleFontSize', label: '字号', min: 14, max: 48, step: 1 },

  { section: '③ 再玩一次', key: 'replayCenterX', label: '中心 X', min: 40, max: 350, step: 1 },
  { section: '③ 再玩一次', key: 'replayCenterY', label: '中心 Y', min: 100, max: 800, step: 1 },
  { section: '③ 再玩一次', key: 'replayFontSize', label: '字号', min: 11, max: 28, step: 1 },
  { section: '③ 再玩一次', key: 'replayMinHeight', label: '高度', min: 36, max: 72, step: 1 },
  { section: '③ 再玩一次', key: 'replayMinWidth', label: '宽度', min: 100, max: 300, step: 2 },
];

function formatVal(key: keyof PrintLayout, n: number): string {
  if (key === 'finalRotateDeg') return n.toFixed(1);
  return String(Math.round(n * 10) / 10);
}

export function mountSettleTuner(
  uiRoot: HTMLElement,
  opts?: {
    onChange?: () => void;
    /** 打开面板时预览结算布局 */
    onPreview?: (on: boolean) => void;
  },
): SettleTunerHandle {
  applyPrintLayoutCss(uiRoot);

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.id = 'settle-tuner-fab';
  fab.className = 'settle-tuner-fab';
  fab.textContent = '挑战';
  fab.title = '挑战结算调参';
  fab.setAttribute('aria-label', '挑战结算调参');

  const panel = document.createElement('div');
  panel.id = 'settle-tuner';
  panel.className = 'settle-tuner layout-tuner';
  panel.hidden = true;

  const title = document.createElement('div');
  title.className = 'layout-tuner-title';
  title.textContent = '挑战结算';

  const body = document.createElement('div');
  body.className = 'layout-tuner-body';

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
    const cur = Number(PRINT_LAYOUT[s.key]);
    val.textContent = formatVal(s.key, cur);
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
      setPrintLayout({ [s.key]: n } as Partial<PrintLayout>);
      val.textContent = formatVal(s.key, n);
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
  }

  const actions = document.createElement('div');
  actions.className = 'layout-tuner-actions';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = '重置';
  resetBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // 只重置结算相关字段，保留岛/Mask
    setPrintLayout({
      polaroidMaxWidth: DEFAULT_PRINT_LAYOUT.polaroidMaxWidth,
      finalCenterX: DEFAULT_PRINT_LAYOUT.finalCenterX,
      finalTop: DEFAULT_PRINT_LAYOUT.finalTop,
      finalRotateDeg: DEFAULT_PRINT_LAYOUT.finalRotateDeg,
      titleCenterX: DEFAULT_PRINT_LAYOUT.titleCenterX,
      titleCenterY: DEFAULT_PRINT_LAYOUT.titleCenterY,
      titleFontSize: DEFAULT_PRINT_LAYOUT.titleFontSize,
      replayCenterX: DEFAULT_PRINT_LAYOUT.replayCenterX,
      replayCenterY: DEFAULT_PRINT_LAYOUT.replayCenterY,
      replayFontSize: DEFAULT_PRINT_LAYOUT.replayFontSize,
      replayMinHeight: DEFAULT_PRINT_LAYOUT.replayMinHeight,
      replayMinWidth: DEFAULT_PRINT_LAYOUT.replayMinWidth,
    });
    applyPrintLayoutCss(uiRoot);
    syncSliderValues();
    opts?.onChange?.();
  });

  const dumpBtn = document.createElement('button');
  dumpBtn.type = 'button';
  dumpBtn.textContent = '复制';
  dumpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const h = PRINT_LAYOUT;
    const text = JSON.stringify(
      {
        polaroidMaxWidth: h.polaroidMaxWidth,
        finalCenterX: h.finalCenterX,
        finalTop: h.finalTop,
        finalRotateDeg: h.finalRotateDeg,
        titleCenterX: h.titleCenterX,
        titleCenterY: h.titleCenterY,
        titleFontSize: h.titleFontSize,
        replayCenterX: h.replayCenterX,
        replayCenterY: h.replayCenterY,
        replayFontSize: h.replayFontSize,
        replayMinHeight: h.replayMinHeight,
        replayMinWidth: h.replayMinWidth,
      },
      null,
      2,
    );
    void navigator.clipboard?.writeText(text);
    console.info('[settleLayout]', text);
  });

  actions.append(resetBtn, dumpBtn);
  panel.append(title, body, actions);

  const wrap = document.createElement('div');
  wrap.className = 'settle-tuner-wrap';
  wrap.dataset.captureIgnore = '1';
  wrap.append(fab, panel);
  uiRoot.append(wrap);

  let previewOn = false;

  const setPreview = (on: boolean) => {
    previewOn = on;
    fab.classList.toggle('is-open', on);
    applyPrintLayoutCss(uiRoot);
    opts?.onPreview?.(on);
  };

  const toggle = (e: Event) => {
    e.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
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
