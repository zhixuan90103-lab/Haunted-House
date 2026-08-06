/**
 * DOM 棋盘 + 托盘 + 拖动手电精灵。
 * 扫描光效见 lightFx.ts（独立层，拿起时显示，Additive 叠背景）。
 */

import type { Board } from '../board';
import { get } from '../board';
import { FEEL } from '../feel/defaults';
import { BOARD_LAYOUT, cellSize, TRAY_LAYOUT } from '../layout';
import { applyPropStyleCss, PROP_STYLE } from '../propStyle';
import {
  Dir,
  GhostState,
  type DragGhost,
  type Ghost,
  type Occupant,
  type PropType,
  type TrayItem,
} from '../types';
import { freeBeamSpot, type FreeGlow } from './lightFx';

export type { FreeGlow };
export { freeBeamSpot };

const PROP_SRC: Partial<Record<PropType, string>> = {
  light: './prop-light.png',
};

const GHOST_SRC = './ghost.png';
const BOARD_BG = './board-bg.jpg';

/** 入场动画时长（须与 style.css @keyframes ghost-appear 一致） */
export const GHOST_APPEAR_MS = 640;

/**
 * 鬼 DOM 池：打灯/拖拽每帧 repaint 时复用节点，
 * 避免 replaceChildren 掐断入场 CSS 与待机 CSS 变量。
 */
const ghostPool = new Map<string, HTMLElement>();

/** 各鬼首次可见时刻（入场→待机混合用） */
const ghostAppearT0 = new Map<string, number>();

function releaseGhost(id: string): void {
  const el = ghostPool.get(id);
  if (el) {
    el.remove();
    ghostPool.delete(id);
  }
  ghostAppearT0.delete(id);
}

/** 重开关卡：清池 + 入场时钟 */
export function resetGhostAppear(): void {
  for (const id of [...ghostPool.keys()]) releaseGhost(id);
  ghostAppearT0.clear();
}

/** 供待机混合：该鬼入场开始时间戳；无则已结束/未出场 */
export function getGhostAppearT0(id: string): number | undefined {
  return ghostAppearT0.get(id);
}

export type DomBoardElements = {
  root: HTMLElement;
  boardHit: HTMLElement;
  grid: HTMLElement;
  /** 鬼专用层：与 grid 同框，不随格子 replaceChildren 销毁 */
  ghostLayer: HTMLElement;
  tray: HTMLElement;
  hud: HTMLElement;
  dragLayer: HTMLElement;
  titleEl: HTMLElement;
  hintEl: HTMLElement;
};

/** Apply current BOARD/TRAY layout numbers onto shell elements. */
export function applyLayoutToDom(els: DomBoardElements): void {
  const b = BOARD_LAYOUT;
  const t = TRAY_LAYOUT;
  els.boardHit.style.left = `${b.left}px`;
  els.boardHit.style.top = `${b.top}px`;
  els.boardHit.style.width = `${b.size}px`;
  els.boardHit.style.height = `${b.size}px`;
  for (const layer of [els.grid, els.ghostLayer]) {
    layer.style.left = `${b.padding}px`;
    layer.style.top = `${b.padding}px`;
    layer.style.right = `${b.padding}px`;
    layer.style.bottom = `${b.padding}px`;
  }
  els.grid.style.gridTemplateColumns = `repeat(${b.cols}, 1fr)`;
  els.grid.style.gridTemplateRows = `repeat(${b.rows}, 1fr)`;
  els.tray.style.left = `${t.left}px`;
  els.tray.style.top = `${t.top}px`;
  els.tray.style.width = `${t.width}px`;
  els.tray.style.height = `${t.height}px`;
  applyPropStyleCss(els.root);
}

export function buildUiShell(uiRoot: HTMLElement): DomBoardElements {
  uiRoot.replaceChildren();
  uiRoot.classList.add('game-ui');

  const bg = document.createElement('div');
  bg.className = 'stage-bg';
  bg.style.backgroundImage = `url(${BOARD_BG})`;

  const hud = document.createElement('div');
  hud.id = 'hud';
  hud.className = 'game-hud';
  const titleEl = document.createElement('h1');
  titleEl.className = 'game-title';
  titleEl.textContent = 'Haunted House';
  const hintEl = document.createElement('p');
  hintEl.className = 'game-hint';
  hintEl.textContent = '从托盘拖出手电 · 点旋改朝向 · 光照显鬼';
  hud.append(titleEl, hintEl);

  const boardHit = document.createElement('div');
  boardHit.id = 'board-hit';
  boardHit.className = 'board-hit';

  const grid = document.createElement('div');
  grid.className = 'board-grid';

  const ghostLayer = document.createElement('div');
  ghostLayer.className = 'board-ghost-layer';
  ghostLayer.setAttribute('aria-hidden', 'true');

  boardHit.append(grid, ghostLayer);

  const tray = document.createElement('div');
  tray.id = 'tray';
  tray.className = 'game-tray game-tray-bare';

  const dragLayer = document.createElement('div');
  dragLayer.id = 'drag-layer';
  dragLayer.className = 'drag-layer';

  // 光效由 mountLightFx 单独挂到 uiRoot（在手电层之上）
  uiRoot.append(bg, hud, boardHit, tray, dragLayer);

  const els: DomBoardElements = {
    root: uiRoot,
    boardHit,
    grid,
    ghostLayer,
    tray,
    hud,
    dragLayer,
    titleEl,
    hintEl,
  };
  applyLayoutToDom(els);
  return els;
}

export type RenderState = {
  board: Board;
  ghosts: Ghost[];
  lit: Set<string>;
  tray: TrayItem[];
  drag: DragGhost | null;
  hidePropId?: string;
  freeGlows?: FreeGlow[];
};

function dirRotateDeg(facing: number): number {
  return ((facing - Dir.E + 4) % 4) * 90 + PROP_STYLE.rotateOffset;
}

function propImg(type: PropType, facing: number, extraClass = ''): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = `prop-sprite ${extraClass}`.trim();
  wrap.dataset.propType = type;
  const img = document.createElement('img');
  img.src = PROP_SRC[type] ?? './prop-light.png';
  img.alt = type;
  img.draggable = false;
  img.style.transform = `rotate(${dirRotateDeg(facing)}deg)`;
  wrap.append(img);
  return wrap;
}

function syncGhostVisualState(el: HTMLElement, g: Ghost): void {
  el.dataset.state = g.state;
  el.classList.toggle('ghost-transparent', g.state === GhostState.Transparent);
  el.classList.toggle('ghost-revealed', g.state === GhostState.Revealed);
}

function createGhostEl(g: Ghost): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ghost-sprite';
  el.dataset.ghostId = g.id;

  const t0 = performance.now();
  ghostAppearT0.set(g.id, t0);
  el.dataset.appearT0 = String(t0);

  // 身体层：入场只播一次；待机 bob 在 .ghost-sprite 上，互不覆盖
  const body = document.createElement('div');
  body.className = 'ghost-body ghost-entering';
  body.addEventListener('animationend', (ev) => {
    if (ev.animationName === 'ghost-appear') {
      body.classList.remove('ghost-entering');
    }
  });

  const img = document.createElement('img');
  img.src = GHOST_SRC;
  img.alt = 'ghost';
  img.draggable = false;
  body.append(img);
  el.append(body);
  syncGhostVisualState(el, g);
  return el;
}

/**
 * 复用鬼节点：同 id 不重建，仅更新显隐态 class + 格心坐标。
 * 挂在 ghostLayer 上，不进 cell，避免 repaint 摘挂掐断 CSS 动画。
 */
function ensureGhostEl(g: Ghost): HTMLElement {
  let el = ghostPool.get(g.id);
  if (!el) {
    el = createGhostEl(g);
    ghostPool.set(g.id, el);
  } else {
    syncGhostVisualState(el, g);
  }
  return el;
}

/** 把可见鬼画到独立层；Hidden 释放（下次再入场） */
function renderGhostLayer(
  layer: HTMLElement,
  ghosts: Ghost[],
  board: Board,
): void {
  const visible = ghosts.filter((g) => g.state !== GhostState.Hidden);
  const visibleIds = new Set(visible.map((g) => g.id));
  const w = Math.max(1, board.width);
  const h = Math.max(1, board.height);

  for (const g of visible) {
    const el = ensureGhostEl(g);
    // 格心：百分比落在 ghostLayer（与 grid 同框）
    el.style.left = `${((g.x + 0.5) / w) * 100}%`;
    el.style.top = `${((g.y + 0.5) / h) * 100}%`;
    if (el.parentElement !== layer) layer.append(el);
  }

  for (const id of [...ghostPool.keys()]) {
    if (!visibleIds.has(id)) releaseGhost(id);
  }
}

export function renderBoard(els: DomBoardElements, state: RenderState): void {
  const { board, ghosts, lit, tray, drag, hidePropId } = state;
  const cs = cellSize();

  els.grid.replaceChildren();
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);

      const key = `${x},${y}`;
      if (lit.has(key)) cell.classList.add('lit');

      const occ = get(board, x, y);
      paintOccupant(cell, occ, hidePropId);

      if (drag?.cell && drag.cell.x === x && drag.cell.y === y) {
        cell.classList.add('snap-ok');
      }

      els.grid.append(cell);
    }
  }

  // 鬼在独立层：打灯每帧 repaint 也不摘节点
  renderGhostLayer(els.ghostLayer, ghosts, board);

  // 托盘：按 count 展开为独立槽位，横向平均分布
  els.tray.replaceChildren();
  for (const item of tray) {
    for (let i = 0; i < item.count; i++) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'tray-item';
      slot.dataset.trayType = item.type;
      slot.setAttribute('aria-label', `${item.type} ${i + 1}`);
      const spr = propImg(item.type, PROP_STYLE.trayFacing, 'tray-prop');
      slot.append(spr);
      els.tray.append(slot);
    }
  }

  els.dragLayer.replaceChildren();
  if (drag) {
    const free = propImg(drag.type, drag.facing, 'drag-follow');
    const full =
      drag.dragSizePx ??
      cs * (PROP_STYLE.lightBoardScale / 100) * PROP_STYLE.dragScale;
    const scale = drag.scale ?? 1;
    const dragSize = full * scale;
    free.style.width = `${dragSize}px`;
    free.style.height = `${dragSize}px`;
    free.style.left = `${drag.designX - dragSize / 2}px`;
    free.style.top = `${drag.designY - dragSize / 2}px`;
    free.style.opacity = '1';
    // 手电本体不参与开灯缩放，瞬间满尺寸
    free.style.transform = '';
    if (!drag.cell) free.classList.add('drag-invalid');
    else free.classList.add('drag-valid');
    els.dragLayer.append(free);
  }

  applyPropStyleCss(els.root);
  const trayVis = cs * (PROP_STYLE.lightBoardScale / 100) * FEEL.TRAY_SCALE;
  const trayHit = Math.max(52, trayVis * 1.25);
  els.root.style.setProperty('--prop-tray-size', `${trayHit}px`);
}

function paintOccupant(
  cell: HTMLElement,
  occ: Occupant,
  hidePropId: string | undefined,
): void {
  if (occ?.kind === 'wall') {
    cell.classList.add('wall');
    const w = document.createElement('div');
    w.className = 'wall-mark';
    cell.append(w);
    return;
  }

  // 鬼在 board-ghost-layer，不进格子

  if (occ?.kind === 'prop') {
    if (hidePropId && occ.id === hidePropId) return;
    cell.append(propImg(occ.type, occ.facing));
  }
}
