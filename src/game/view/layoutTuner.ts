/**
 * Live layout tuner: board rect + tray position.
 * Mount under #ui-root; does not affect letterbox input rules.
 */

import {
  BOARD_LAYOUT,
  layoutSnapshot,
  resetLayouts,
  setBoardLayout,
  setTrayLayout,
  TRAY_LAYOUT,
} from '../layout';

export type LayoutTunerCallbacks = {
  onChange: () => void;
};

type SliderDef = {
  group: 'board' | 'tray';
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
};

const SLIDERS: SliderDef[] = [
  { group: 'board', key: 'left', label: '棋盘 left', min: 0, max: 120, step: 1 },
  { group: 'board', key: 'top', label: '棋盘 top', min: 40, max: 400, step: 1 },
  { group: 'board', key: 'size', label: '棋盘 size', min: 180, max: 380, step: 1 },
  { group: 'board', key: 'padding', label: '内边距', min: 0, max: 40, step: 1 },
  { group: 'tray', key: 'left', label: '托盘 left', min: 0, max: 100, step: 1 },
  { group: 'tray', key: 'top', label: '托盘 top', min: 300, max: 780, step: 1 },
  { group: 'tray', key: 'width', label: '托盘 width', min: 200, max: 390, step: 1 },
  { group: 'tray', key: 'height', label: '托盘 height', min: 60, max: 160, step: 1 },
];

function readValue(def: SliderDef): number {
  if (def.group === 'board') {
    return (BOARD_LAYOUT as Record<string, number>)[def.key] ?? 0;
  }
  return (TRAY_LAYOUT as Record<string, number>)[def.key] ?? 0;
}

export function mountLayoutTuner(
  parent: HTMLElement,
  cb: LayoutTunerCallbacks,
): { dispose: () => void; el: HTMLElement } {
  const root = document.createElement('div');
  root.className = 'layout-tuner';
  root.id = 'layout-tuner';

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'layout-tuner-toggle';
  header.textContent = '⚙ 调参';

  const body = document.createElement('div');
  body.className = 'layout-tuner-body';

  const valueEls = new Map<string, HTMLSpanElement>();
  const rangeEls = new Map<string, HTMLInputElement>();

  for (const def of SLIDERS) {
    const row = document.createElement('label');
    row.className = 'layout-tuner-row';

    const name = document.createElement('span');
    name.className = 'layout-tuner-label';
    name.textContent = def.label;

    const val = document.createElement('span');
    val.className = 'layout-tuner-val';
    val.textContent = String(readValue(def));
    valueEls.set(`${def.group}.${def.key}`, val);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    input.value = String(readValue(def));
    rangeEls.set(`${def.group}.${def.key}`, input);

    input.addEventListener('input', () => {
      const n = Number(input.value);
      if (def.group === 'board') {
        setBoardLayout({ [def.key]: n });
      } else {
        setTrayLayout({ [def.key]: n });
      }
      val.textContent = String(n);
      cb.onChange();
    });

    // Prevent board drag when scrubbing sliders
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
    const text = layoutSnapshot();
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = '已复制';
      setTimeout(() => {
        copyBtn.textContent = '复制参数';
      }, 1200);
    } catch {
      console.info('[layout]', text);
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
    resetLayouts();
    for (const def of SLIDERS) {
      const id = `${def.group}.${def.key}`;
      const v = readValue(def);
      valueEls.get(id)!.textContent = String(v);
      rangeEls.get(id)!.value = String(v);
    }
    cb.onChange();
  });

  actions.append(copyBtn, resetBtn);
  body.append(actions);

  let open = true;
  header.addEventListener('click', (e) => {
    e.stopPropagation();
    open = !open;
    body.hidden = !open;
    header.textContent = open ? '⚙ 调参' : '⚙ 调参…';
  });

  root.append(header, body);
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  parent.append(root);

  return {
    el: root,
    dispose: () => root.remove(),
  };
}
