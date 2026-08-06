/** DOM board + tray + drag ghost rendering. All under #ui-root. */

import type { Board } from '../board';
import { get } from '../board';
import { FEEL } from '../feel/defaults';
import { BOARD_LAYOUT, cellSize, TRAY_LAYOUT } from '../layout';
import { applyPropStyleCss, PROP_STYLE } from '../propStyle';
import {
  DELTA,
  Dir,
  GhostState,
  type DragGhost,
  type Ghost,
  type Occupant,
  type PropType,
  type TrayItem,
} from '../types';
import { VIEW_STYLE } from '../viewStyle';

const PROP_SRC: Partial<Record<PropType, string>> = {
  light: './prop-light.png',
};

const GHOST_SRC = './ghost.png';
const BOARD_BG = './board-bg.jpg';
const LIGHT_GLOW_SRC = './light-glow.png';
/** 手电→光斑连接条（独立资源；颜色/Additive 与光斑一致） */
const LIGHT_BEAM_SRC = './light-beam.png';

/** Cached art for light FX canvas（光效层在手电之上） */
const glowImg = new Image();
glowImg.src = LIGHT_GLOW_SRC;
const beamImg = new Image();
beamImg.src = LIGHT_BEAM_SRC;
let imagesReady = false;
let onImagesReady: (() => void) | null = null;

function markImagesReady(): void {
  const ok =
    glowImg.complete &&
    glowImg.naturalWidth > 0 &&
    beamImg.complete &&
    beamImg.naturalWidth > 0;
  if (ok) {
    imagesReady = true;
    onImagesReady?.();
  }
}
glowImg.onload = markImagesReady;
beamImg.onload = markImagesReady;
glowImg.onerror = markImagesReady;
beamImg.onerror = markImagesReady;
markImagesReady();

/**
 * 光斑与连接共用：同一亮黄染色 + Canvas lighter（Additive）
 * 资源仍是两张图：light-glow / light-beam
 */
const LIGHT_FILTER = 'brightness(1.2) sepia(1) saturate(9) hue-rotate(3deg)';

export type DomBoardElements = {
  root: HTMLElement;
  boardHit: HTMLElement;
  /** 光斑 canvas（棋盘内）；连接条另挂在拖动手电 DOM 之上 */
  lightCanvas: HTMLCanvasElement;
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
  els.lightCanvas.style.width = `${b.size}px`;
  els.lightCanvas.style.height = `${b.size}px`;
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

  const lightCanvas = document.createElement('canvas');
  lightCanvas.className = 'board-light-canvas';
  lightCanvas.setAttribute('aria-hidden', 'true');

  const grid = document.createElement('div');
  grid.className = 'board-grid';
  // 光斑在格网下/同层合成；连接条另见 drag 层（压在手电上）
  boardHit.append(lightCanvas, grid);

  const tray = document.createElement('div');
  tray.id = 'tray';
  tray.className = 'game-tray game-tray-bare';

  const dragLayer = document.createElement('div');
  dragLayer.id = 'drag-layer';
  dragLayer.className = 'drag-layer';

  uiRoot.append(bg, hud, boardHit, tray, dragLayer);

  const els: DomBoardElements = {
    root: uiRoot,
    boardHit,
    lightCanvas,
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
  /** 拖动手电时的连续光斑（design 坐标），自由跟手 */
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

/** 连续光斑中心（design 坐标） */
export type FreeGlow = { designX: number; designY: number };

/**
 * 扫描光斑中心（连续，不吸附）
 * = 手电中心 + 朝向前×glowForward + 朝向右×glowSide + 固定 px 偏移
 */
export function freeBeamSpot(
  designX: number,
  designY: number,
  facing: number,
): FreeGlow {
  const cs = cellSize();
  const f = ((facing % 4) + 4) % 4;
  const fwd = DELTA[f as Dir] ?? DELTA[Dir.N];
  const right = DELTA[((f + 1) % 4) as Dir];
  const { glowForward, glowSide, glowOffsetX, glowOffsetY } = VIEW_STYLE;
  return {
    designX:
      designX +
      fwd.dx * cs * glowForward +
      right.dx * cs * glowSide +
      glowOffsetX,
    designY:
      designY +
      fwd.dy * cs * glowForward +
      right.dy * cs * glowSide +
      glowOffsetY,
  };
}

/**
 * 连接条 DOM：挂在拖动手电之后，显示层级在手电上方。
 * 纯显示：宽/长/位置；light-beam + 同色 Additive。
 */
function appendLightLinkAboveFlashlight(
  parent: HTMLElement,
  lightDesignX: number,
  lightDesignY: number,
  facing: number,
  cell: number,
  alpha: number,
): void {
  const { beamWidth, beamLength, beamOffsetX, beamOffsetY } = VIEW_STYLE;
  const w = cell * Math.max(0.05, beamWidth / 100);
  const h = cell * Math.max(0.05, beamLength / 100);
  if (w < 1 || h < 1) return;

  const f = ((facing % 4) + 4) % 4;
  const fwd = DELTA[f as Dir] ?? DELTA[Dir.N];
  const facingDeg =
    (Math.atan2(fwd.dy, fwd.dx) * 180) / Math.PI + 90;

  const cx = lightDesignX + beamOffsetX;
  const cy = lightDesignY + beamOffsetY;

  const img = document.createElement('img');
  img.className = 'light-link-sprite';
  img.src = LIGHT_BEAM_SRC;
  img.alt = '';
  img.draggable = false;
  img.style.width = `${w}px`;
  img.style.height = `${h}px`;
  img.style.left = `${cx - w / 2}px`;
  img.style.top = `${cy - h / 2}px`;
  img.style.opacity = String(Math.max(0, Math.min(1, alpha)));
  img.style.transform = `rotate(${facingDeg}deg)`;
  parent.append(img);
}

/**
 * 只画光斑（canvas 在棋盘层）；连接条不在这里画。
 */
function paintLightCanvas(
  els: DomBoardElements,
  gridLit: Set<string>,
  freeGlows: FreeGlow[],
): void {
  const b = BOARD_LAYOUT;
  const size = Math.max(1, Math.round(b.size));
  const canvas = els.lightCanvas;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pw = Math.round(size * dpr);
  const ph = Math.round(size * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  if (!glowImg.complete || glowImg.naturalWidth <= 0) return;

  const cs = cellSize();
  const pad = b.padding;
  const glowScale = Math.max(0.4, VIEW_STYLE.glowSize / 100);
  const glowPx = cs * glowScale;
  const alpha = Math.max(0, Math.min(1, VIEW_STYLE.glowAlpha));

  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.filter = LIGHT_FILTER;

  for (const g of freeGlows) {
    const cx = g.designX - b.left;
    const cy = g.designY - b.top;
    ctx.drawImage(glowImg, cx - glowPx / 2, cy - glowPx / 2, glowPx, glowPx);
  }

  if (freeGlows.length === 0) {
    for (const key of gridLit) {
      const [xs, ys] = key.split(',');
      const x = Number(xs);
      const y = Number(ys);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const cx = pad + (x + 0.5) * cs;
      const cy = pad + (y + 0.5) * cs;
      ctx.drawImage(glowImg, cx - glowPx / 2, cy - glowPx / 2, glowPx, glowPx);
    }
  }

  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

export function renderBoard(els: DomBoardElements, state: RenderState): void {
  const { board, ghosts, lit, tray, drag, hidePropId, freeGlows } = state;
  const cs = cellSize();
  const ghostByCell = new Map(ghosts.map((g) => [`${g.x},${g.y}`, g]));

  const glows = freeGlows ?? [];
  paintLightCanvas(els, lit, glows);
  if (!imagesReady) {
    onImagesReady = () => {
      paintLightCanvas(els, lit, glows);
    };
  }

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

  els.tray.replaceChildren();
  for (const item of tray) {
    if (item.count <= 0) continue;
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'tray-item';
    slot.dataset.trayType = item.type;
    slot.setAttribute('aria-label', `${item.type} ×${item.count}`);
    const spr = propImg(item.type, PROP_STYLE.trayFacing, 'tray-prop');
    slot.append(spr);
    els.tray.append(slot);
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
    if (!drag.cell) free.classList.add('drag-invalid');
    else free.classList.add('drag-valid');
    // 先手电，后连接 → 连接显示在手电上方
    els.dragLayer.append(free);
    if (drag.type === 'light') {
      appendLightLinkAboveFlashlight(
        els.dragLayer,
        drag.designX,
        drag.designY,
        drag.facing,
        cs,
        VIEW_STYLE.glowAlpha,
      );
    }
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
