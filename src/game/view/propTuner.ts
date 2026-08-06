/**
 * 统一调参：外观 · 手感2 · 棋盘/托盘布局 · 表现
 */

import {
  FEEL,
  feelSnapshot,
  resetFeel,
  setFeel,
  type FeelConfig,
} from '../feel/defaults';
import {
  BOARD_LAYOUT,
  layoutSnapshot,
  resetLayouts,
  setBoardLayout,
  setTrayLayout,
  TRAY_LAYOUT,
  type BoardLayout,
  type TrayLayout,
} from '../layout';
import {
  PROP_STYLE,
  propStyleSnapshot,
  resetPropStyle,
  setPropStyle,
  type PropStyle,
} from '../propStyle';
import {
  resetViewStyle,
  setViewStyle,
  VIEW_STYLE,
  viewStyleSnapshot,
  type ViewStyle,
} from '../viewStyle';

export type PropTunerCallbacks = {
  onChange: () => void;
};

type Group = 'prop' | 'feel' | 'board' | 'tray' | 'view';

type SliderDef =
  | { group: 'prop'; key: keyof PropStyle; label: string; min: number; max: number; step: number }
  | { group: 'feel'; key: keyof FeelConfig; label: string; min: number; max: number; step: number }
  | { group: 'board'; key: keyof BoardLayout; label: string; min: number; max: number; step: number }
  | { group: 'tray'; key: keyof TrayLayout; label: string; min: number; max: number; step: number }
  | { group: 'view'; key: keyof ViewStyle; label: string; min: number; max: number; step: number };

const SECTION_TITLE: Record<Group, string> = {
  prop: '外观·拿起',
  feel: '手感2',
  board: '棋盘布局',
  tray: '托盘布局',
  view: '表现·调试',
};

const SLIDERS: SliderDef[] = [
  // —— 外观 / 拿起 ——
  { group: 'prop', key: 'boardScale', label: '盘上大小%', min: 40, max: 160, step: 1 },
  { group: 'prop', key: 'lightBoardScale', label: '拿起基准%', min: 50, max: 220, step: 1 },
  { group: 'prop', key: 'dragScale', label: '拿起大小×', min: 0.5, max: 2.2, step: 0.01 },
  { group: 'prop', key: 'rotateOffset', label: '旋转偏移°', min: -180, max: 180, step: 1 },
  { group: 'prop', key: 'defaultFacing', label: '默认朝向', min: 0, max: 3, step: 1 },
  { group: 'prop', key: 'trayFacing', label: '托盘朝向', min: 0, max: 3, step: 1 },

  // —— 手感2 ——
  { group: 'feel', key: 'POINTER_GAIN_K', label: '跟手倍率K', min: 0.6, max: 2.8, step: 0.05 },
  { group: 'feel', key: 'DRAG_OFFSET_Y', label: '抬升Y(格)', min: -5, max: 0.5, step: 0.1 },
  { group: 'feel', key: 'DRAG_OFFSET_X', label: '偏移X(格)', min: -2, max: 2, step: 0.1 },
  { group: 'feel', key: 'TRAY_SCALE', label: '托盘尺度', min: 0.25, max: 1.2, step: 0.05 },
  { group: 'feel', key: 'BOARD_SCALE', label: '盘上尺度', min: 0.6, max: 1.4, step: 0.05 },
  { group: 'feel', key: 'DRAG_SCALE_POP', label: '拿起pop×', min: 0.7, max: 2.0, step: 0.02 },
  { group: 'feel', key: 'SCALE_POP_MS', label: '放大时长ms', min: 0, max: 300, step: 5 },
  { group: 'feel', key: 'SMOOTH_TIME', label: '平滑(秒)', min: 0, max: 0.1, step: 0.002 },
  { group: 'feel', key: 'DRAG_LIFT_TRAVEL_CELLS', label: '抬升行程', min: 0.5, max: 8, step: 0.1 },
  { group: 'feel', key: 'DRAG_LIFT_POWER', label: '抬升曲线', min: 0.5, max: 3, step: 0.05 },

  // —— 棋盘 ——
  { group: 'board', key: 'left', label: '棋盘 left', min: 0, max: 80, step: 1 },
  { group: 'board', key: 'top', label: '棋盘 top', min: 40, max: 360, step: 1 },
  { group: 'board', key: 'size', label: '棋盘 size', min: 200, max: 380, step: 1 },
  { group: 'board', key: 'padding', label: '内边距', min: 0, max: 40, step: 1 },

  // —— 托盘 ——
  { group: 'tray', key: 'left', label: '托盘 left', min: 0, max: 120, step: 1 },
  { group: 'tray', key: 'top', label: '托盘 top', min: 400, max: 800, step: 1 },
  { group: 'tray', key: 'width', label: '托盘 width', min: 120, max: 390, step: 1 },
  { group: 'tray', key: 'height', label: '托盘 height', min: 48, max: 160, step: 1 },

  // —— 表现：光斑 ——
  { group: 'view', key: 'glowSize', label: '光斑大小%', min: 60, max: 280, step: 5 },
  { group: 'view', key: 'glowAlpha', label: '光斑透明度', min: 0, max: 1, step: 0.02 },
  { group: 'view', key: 'glowForward', label: '光斑前移(格)', min: -1.5, max: 3, step: 0.05 },
  { group: 'view', key: 'glowSide', label: '光斑侧移(格)', min: -1.5, max: 1.5, step: 0.05 },
  { group: 'view', key: 'glowOffsetX', label: '光斑偏移Xpx', min: -80, max: 80, step: 1 },
  { group: 'view', key: 'glowOffsetY', label: '光斑偏移Ypx', min: -80, max: 80, step: 1 },
  // —— 表现：连接（纯显示：宽、长、位置、透明度）——
  { group: 'view', key: 'beamWidth', label: '连接宽度%', min: 10, max: 250, step: 5 },
  { group: 'view', key: 'beamLength', label: '连接长度%', min: 10, max: 300, step: 5 },
  { group: 'view', key: 'beamOffsetX', label: '连接位置X', min: -120, max: 120, step: 1 },
  { group: 'view', key: 'beamOffsetY', label: '连接位置Y', min: -120, max: 120, step: 1 },
  { group: 'view', key: 'beamAlpha', label: '连接透明度', min: 0, max: 1, step: 0.02 },
  { group: 'view', key: 'ghostTransparentAlpha', label: '透明鬼α', min: 0.1, max: 1, step: 0.05 },
  { group: 'view', key: 'ghostRevealedAlpha', label: '显示鬼α', min: 0.3, max: 1, step: 0.05 },
  { group: 'view', key: 'snapOutlineAlpha', label: '吸附描边', min: 0, max: 1, step: 0.05 },
  { group: 'view', key: 'showGrid', label: '显示格线', min: 0, max: 1, step: 1 },
  { group: 'view', key: 'showCoords', label: '显示坐标', min: 0, max: 1, step: 1 },
  { group: 'view', key: 'showHud', label: '显示标题', min: 0, max: 1, step: 1 },
];

const FACING_LABEL = ['N↑', 'E→', 'S↓', 'W←'] as const;

const FLOAT_KEYS = new Set([
  'dragScale',
  'POINTER_GAIN_K',
  'TRAY_SCALE',
  'BOARD_SCALE',
  'DRAG_SCALE_POP',
  'DRAG_OFFSET_Y',
  'DRAG_OFFSET_X',
  'SMOOTH_TIME',
  'DRAG_LIFT_TRAVEL_CELLS',
  'DRAG_LIFT_POWER',
  'glowAlpha',
  'glowForward',
  'glowSide',
  'beamAlpha',
  'ghostTransparentAlpha',
  'ghostRevealedAlpha',
  'snapOutlineAlpha',
]);

function readVal(def: SliderDef): number {
  switch (def.group) {
    case 'prop':
      return PROP_STYLE[def.key] as number;
    case 'feel':
      return FEEL[def.key] as number;
    case 'board':
      return BOARD_LAYOUT[def.key] as number;
    case 'tray':
      return TRAY_LAYOUT[def.key] as number;
    case 'view':
      return VIEW_STYLE[def.key] as number;
  }
}

function formatVal(def: SliderDef, n: number): string {
  if (def.group === 'prop' && (def.key === 'defaultFacing' || def.key === 'trayFacing')) {
    return `${n} ${FACING_LABEL[n as 0 | 1 | 2 | 3] ?? ''}`;
  }
  if (def.group === 'view' && (def.key === 'showGrid' || def.key === 'showCoords' || def.key === 'showHud')) {
    return n >= 0.5 ? '开' : '关';
  }
  if (FLOAT_KEYS.has(def.key as string)) {
    if (def.key === 'SMOOTH_TIME') return n.toFixed(3);
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }
  return String(Math.round(n * 1000) / 1000);
}

function writeVal(def: SliderDef, n: number): void {
  switch (def.group) {
    case 'prop':
      if (def.key === 'defaultFacing' || def.key === 'trayFacing') {
        setPropStyle({ [def.key]: n as 0 | 1 | 2 | 3 });
      } else {
        setPropStyle({ [def.key]: n });
      }
      break;
    case 'feel':
      setFeel({ [def.key]: n });
      break;
    case 'board':
      setBoardLayout({ [def.key]: n });
      break;
    case 'tray':
      setTrayLayout({ [def.key]: n });
      break;
    case 'view':
      setViewStyle({ [def.key]: n });
      break;
  }
}

function fullSnapshot(): string {
  return [
    propStyleSnapshot(),
    feelSnapshot(),
    layoutSnapshot(),
    viewStyleSnapshot(),
  ].join('\n');
}

export function mountPropTuner(
  parent: HTMLElement,
  cb: PropTunerCallbacks,
): { dispose: () => void; el: HTMLElement } {
  // 始终可见：显示/隐藏整个调参面板
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.id = 'prop-tuner-fab';
  fab.className = 'prop-tuner-fab';
  fab.setAttribute('aria-label', '显示或隐藏调参面板');
  fab.textContent = '⚙';

  const root = document.createElement('div');
  root.className = 'layout-tuner prop-tuner';
  root.id = 'prop-tuner';
  root.hidden = true; // 默认隐藏，点 FAB 打开

  const header = document.createElement('div');
  header.className = 'layout-tuner-header';

  const title = document.createElement('span');
  title.className = 'layout-tuner-title';
  title.textContent = '⚙ 调参';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'layout-tuner-close';
  closeBtn.textContent = '隐藏';
  closeBtn.setAttribute('aria-label', '隐藏调参面板');

  header.append(title, closeBtn);

  const body = document.createElement('div');
  body.className = 'layout-tuner-body';

  const valueEls = new Map<string, HTMLSpanElement>();
  const rangeEls = new Map<string, HTMLInputElement>();

  let lastGroup: Group | null = null;
  for (const def of SLIDERS) {
    if (def.group !== lastGroup) {
      lastGroup = def.group;
      const sec = document.createElement('div');
      sec.className = 'layout-tuner-section';
      sec.textContent = SECTION_TITLE[def.group];
      body.append(sec);
    }

    const id = `${def.group}.${String(def.key)}`;
    const row = document.createElement('label');
    row.className = 'layout-tuner-row';

    const name = document.createElement('span');
    name.className = 'layout-tuner-label';
    name.textContent = def.label;

    const val = document.createElement('span');
    val.className = 'layout-tuner-val';
    val.textContent = formatVal(def, readVal(def));
    valueEls.set(id, val);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    input.value = String(readVal(def));
    rangeEls.set(id, input);

    input.addEventListener('input', () => {
      const n = Number(input.value);
      writeVal(def, n);
      val.textContent = formatVal(def, n);
      cb.onChange();
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
    const text = fullSnapshot();
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = '已复制';
      setTimeout(() => {
        copyBtn.textContent = '复制参数';
      }, 1200);
    } catch {
      console.info('[tune]', text);
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
    resetPropStyle();
    resetFeel();
    resetLayouts();
    resetViewStyle();
    for (const def of SLIDERS) {
      const id = `${def.group}.${String(def.key)}`;
      const v = readVal(def);
      valueEls.get(id)!.textContent = formatVal(def, v);
      rangeEls.get(id)!.value = String(v);
    }
    cb.onChange();
  });

  actions.append(copyBtn, resetBtn);
  body.append(actions);

  const setVisible = (visible: boolean) => {
    root.hidden = !visible;
    fab.classList.toggle('is-open', visible);
    fab.setAttribute('aria-expanded', visible ? 'true' : 'false');
    fab.title = visible ? '隐藏调参' : '显示调参';
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
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  parent.append(fab, root);
  setVisible(false);

  return {
    el: root,
    dispose: () => {
      fab.remove();
      root.remove();
    },
  };
}
