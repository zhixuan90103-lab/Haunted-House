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

export type DomBoardElements = {
  root: HTMLElement;
  boardHit: HTMLElement;
  grid: HTMLElement;
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
  els.grid.style.left = `${b.padding}px`;
  els.grid.style.top = `${b.padding}px`;
  els.grid.style.right = `${b.padding}px`;
  els.grid.style.bottom = `${b.padding}px`;
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
  boardHit.append(grid);

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

function ghostEl(g: Ghost): HTMLElement | null {
  if (g.state === GhostState.Hidden) return null;
  const el = document.createElement('div');
  el.className = 'ghost-sprite';
  el.dataset.state = g.state;
  if (g.state === GhostState.Transparent) {
    el.classList.add('ghost-transparent');
  } else if (g.state === GhostState.Revealed) {
    el.classList.add('ghost-revealed');
  }
  const img = document.createElement('img');
  img.src = GHOST_SRC;
  img.alt = 'ghost';
  img.draggable = false;
  el.append(img);
  return el;
}

export function renderBoard(els: DomBoardElements, state: RenderState): void {
  const { board, ghosts, lit, tray, drag, hidePropId } = state;
  const cs = cellSize();
  const ghostByCell = new Map(ghosts.map((g) => [`${g.x},${g.y}`, g]));

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
      paintOccupant(cell, occ, hidePropId, ghostByCell.get(key));

      if (drag?.cell && drag.cell.x === x && drag.cell.y === y) {
        cell.classList.add('snap-ok');
      }

      els.grid.append(cell);
    }
  }

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
  ghost: Ghost | undefined,
): void {
  if (occ?.kind === 'wall') {
    cell.classList.add('wall');
    const w = document.createElement('div');
    w.className = 'wall-mark';
    cell.append(w);
    return;
  }

  if (ghost) {
    const ge = ghostEl(ghost);
    if (ge) cell.append(ge);
  }

  if (occ?.kind === 'prop') {
    if (hidePropId && occ.id === hidePropId) return;
    cell.append(propImg(occ.type, occ.facing));
  }
}
