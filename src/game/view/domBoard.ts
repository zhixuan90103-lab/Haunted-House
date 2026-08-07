/**
 * DOM 棋盘 + 托盘 + 拖动手电精灵。
 * 扫描光效见 lightFx.ts（独立层，拿起时显示，Additive 叠背景）。
 */

import type { Board } from '../board';
import { get } from '../board';
import { computeDragSizePx } from '../feel/drag-session';
import { BOARD_LAYOUT, cellSize, TRAY_LAYOUT } from '../layout';
import {
  applyPropStyleCss,
  lightPlacedScalePercent,
  mirrorPlacedScalePercent,
  propLiftScalePercent,
  PROP_STYLE,
  traySlotScalePercent,
} from '../propStyle';
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

/** 盘上 / 托盘·拿起 可分离贴图 */
const PROP_SRC_BOARD: Partial<Record<PropType, string>> = {
  light: './prop-light.png',
  mirror: './prop-mirror-board.png',
  diffuser: './prop-diffuser.jpg',
  beam_splitter: './prop-beam_splitter.jpg',
};

const PROP_SRC_TRAY: Partial<Record<PropType, string>> = {
  light: './prop-light.png',
  mirror: './prop-mirror-tray.png',
  diffuser: './prop-diffuser.jpg',
  beam_splitter: './prop-beam_splitter.jpg',
};

type PropViewContext = 'board' | 'tray' | 'drag' | 'drag-projection';

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
  restartBtn: HTMLButtonElement;
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
  hintEl.textContent =
    '拖出手电找鬼 · 全部找到后镜子滑入 · 再放灯折光';
  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.id = 'btn-restart';
  restartBtn.className = 'game-restart-btn';
  restartBtn.textContent = '重制';
  restartBtn.setAttribute('aria-label', '重制本关');
  restartBtn.title = '重制本关：鬼隐藏，道具回托盘';
  hud.append(titleEl, hintEl, restartBtn);

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
    restartBtn,
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
  /** 本帧托盘滑入的类型（如 mirror），只在重建托盘时用一次 */
  trayEnterTypes?: string[];
};

/** 托盘 DOM 签名：未变则不 rebuild，避免掐断滑入 CSS */
let trayDomSig = '';

export function resetTrayDomCache(): void {
  trayDomSig = '';
}

function traySignature(tray: TrayItem[]): string {
  // 不含 enterTypes：解锁当帧 rebuild+滑入后，后续帧签名不变，避免掐动画
  return tray.map((t) => `${t.type}:${t.count}`).join(',');
}

function propRotateDeg(type: PropType, facing: number): number {
  if (type === 'mirror') {
    /**
     * 盘上镜：资源已带斜面，只按 facing×90 点旋。
     * 正/背面与折向见 optics.MIRROR_REFLECT（默认 facing 1 = 东来折上）。
     */
    const f = (((facing % 4) + 4) % 4);
    return f * 90 + PROP_STYLE.mirrorRotateOffset;
  }
  // 手电等：素材朝东 + rotateOffset
  return ((facing - Dir.E + 4) % 4) * 90 + PROP_STYLE.rotateOffset;
}

/**
 * 镜贴图约定（与手电双层类比）：
 * - tray / drag 本体：立式 prop-mirror-tray.png（= 手电本体）
 * - board / 拿起时格上投影：斜置 prop-mirror-board.png（= 手电下方吸附框/投影）
 */
function propSrc(type: PropType, ctx: PropViewContext): string {
  if (type === 'mirror') {
    if (ctx === 'board' || ctx === 'drag-projection') {
      return PROP_SRC_BOARD.mirror!;
    }
    // tray + drag 本体
    return PROP_SRC_TRAY.mirror!;
  }
  if (ctx === 'board' || ctx === 'drag-projection') {
    return PROP_SRC_BOARD[type] ?? './prop-light.png';
  }
  return PROP_SRC_TRAY[type] ?? PROP_SRC_BOARD[type] ?? './prop-light.png';
}

function propImg(
  type: PropType,
  facing: number,
  extraClass = '',
  ctx: PropViewContext = 'board',
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = `prop-sprite ${extraClass}`.trim();
  wrap.dataset.propType = type;
  wrap.dataset.propCtx = ctx;
  const img = document.createElement('img');
  img.src = propSrc(type, ctx);
  img.alt = type;
  img.draggable = false;
  // 立式本体（托盘/拖影）：不拧 facing
  // 盘上/投影：仅 facing×90（资源自带斜面；正反面见光学表）
  const upright = type === 'mirror' && (ctx === 'tray' || ctx === 'drag');
  const rot = upright
    ? PROP_STYLE.mirrorRotateOffset
    : propRotateDeg(type, facing);
  img.style.transform = `rotate(${rot}deg)`;
  if (type === 'mirror' && ctx === 'drag') {
    img.style.filter =
      'drop-shadow(0 6px 10px rgba(0,0,0,0.45)) drop-shadow(0 2px 2px rgba(0,0,0,0.25))';
  }
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
  img.className = 'ghost-base';
  img.src = GHOST_SRC;
  img.alt = 'ghost';
  img.draggable = false;

  // 被光照到时：同贴图 Additive 叠一层（仅 Revealed）
  const litAdd = document.createElement('img');
  litAdd.className = 'ghost-lit-add';
  litAdd.src = GHOST_SRC;
  litAdd.alt = '';
  litAdd.draggable = false;
  litAdd.setAttribute('aria-hidden', 'true');

  body.append(img, litAdd);
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
    // 热更新：旧池节点补 Additive 层
    const body = el.querySelector('.ghost-body');
    if (body && !body.querySelector('.ghost-lit-add')) {
      const base = body.querySelector('img');
      if (base && !base.classList.contains('ghost-base')) {
        base.classList.add('ghost-base');
      }
      const litAdd = document.createElement('img');
      litAdd.className = 'ghost-lit-add';
      litAdd.src = GHOST_SRC;
      litAdd.alt = '';
      litAdd.draggable = false;
      litAdd.setAttribute('aria-hidden', 'true');
      body.append(litAdd);
    }
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
  const w = board.width;
  const h = board.height;

  els.grid.replaceChildren();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);

      const key = `${x},${y}`;
      if (lit.has(key)) cell.classList.add('lit');

      const occ = get(board, x, y);
      paintOccupant(cell, occ, hidePropId, cs);

      // 可落格框改由 lightFx canvas Additive 绘制（与光斑同层）
      if (drag?.cell && drag.cell.x === x && drag.cell.y === y) {
        cell.classList.add('snap-ok');
      }

      els.grid.append(cell);
    }
  }

  // 鬼在独立层：打灯每帧 repaint 也不摘节点
  renderGhostLayer(els.ghostLayer, ghosts, board);

  // 托盘：签名未变不 rebuild（滑入动画可播完）
  const enterTypes = state.trayEnterTypes;
  const sig = traySignature(tray);
  if (sig !== trayDomSig) {
    trayDomSig = sig;
    const enterSet = new Set(enterTypes ?? []);
    els.tray.replaceChildren();
    for (const item of tray) {
      for (let i = 0; i < item.count; i++) {
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = 'tray-item';
        slot.dataset.trayType = item.type;
        slot.setAttribute('aria-label', `${item.type} ${i + 1}`);
        if (enterSet.has(item.type)) {
          slot.classList.add('tray-item-enter');
          slot.style.animationDelay = `${i * 70}ms`;
        }
        const trayFacing =
          item.type === 'mirror'
            ? PROP_STYLE.mirrorDefaultFacing
            : PROP_STYLE.trayFacing;
        const spr = propImg(item.type, trayFacing, 'tray-prop', 'tray');
        slot.append(spr);
        els.tray.append(slot);
      }
    }
  }

  els.dragLayer.replaceChildren();
  if (drag) {
    // —— ① 本体（跟手）——
    // 镜 = 立式 tray 图；手电 = 灯图（类比手电本体）
    const free = propImg(drag.type, drag.facing, 'drag-follow', 'drag');
    const full =
      drag.dragSizePx ??
      computeDragSizePx(cs, propLiftScalePercent(drag.type));
    const scale = drag.scale ?? 1;
    const dragSize = full * scale;
    let ox = 0;
    let oy = 0;
    if (drag.type === 'mirror') {
      ox = PROP_STYLE.mirrorLiftOffsetX;
      oy = PROP_STYLE.mirrorLiftOffsetY;
    }
    free.style.width = `${dragSize}px`;
    free.style.height = `${dragSize}px`;
    free.style.left = `${drag.designX - dragSize / 2 + ox}px`;
    free.style.top = `${drag.designY - dragSize / 2 + oy}px`;
    free.style.opacity = '1';
    free.style.transform = '';
    if (!drag.cell) free.classList.add('drag-invalid');
    else free.classList.add('drag-valid');

    // —— ② 镜：格上投影（与落盘同一套 mirrorBoardLayout）——
    if (drag.type === 'mirror' && drag.cell) {
      const proj = propImg(
        'mirror',
        drag.facing,
        'drag-mirror-projection',
        'drag-projection',
      );
      const lay = mirrorBoardLayout(cs);
      // 格左上角 design 坐标 + 格内 left/top（与 paintOccupant 一致）
      const cellLeft =
        BOARD_LAYOUT.left +
        BOARD_LAYOUT.padding +
        drag.cell.x * cs;
      const cellTop =
        BOARD_LAYOUT.top +
        BOARD_LAYOUT.padding +
        drag.cell.y * cs;
      applyMirrorBoardBox(proj, lay);
      proj.style.left = `${cellLeft + lay.left}px`;
      proj.style.top = `${cellTop + lay.top}px`;
      proj.style.opacity = String(
        Math.max(0, Math.min(1, PROP_STYLE.mirrorProjectionAlpha)),
      );
      proj.style.pointerEvents = 'none';
      els.dragLayer.append(proj);
    }

    els.dragLayer.append(free);
  }

  applyPropStyleCss(els.root);
  // ② 托盘图标尺寸：只读 traySlotScale，绝不读拿起/盘上
  const slotPx = Math.round(cs * (traySlotScalePercent() / 100));
  els.root.style.setProperty('--prop-tray-slot-size', `${slotPx}px`);
  // 容器高度随图标略增高，避免裁切（仍只改 CSS 变量，布局框由 TRAY_LAYOUT 定）
  els.root.style.setProperty(
    '--prop-tray-gap',
    `${Math.max(4, Math.round(slotPx * 0.06))}px`,
  );
}

function paintOccupant(
  cell: HTMLElement,
  occ: Occupant,
  hidePropId: string | undefined,
  cellPx: number,
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
    const spr = propImg(occ.type, occ.facing, '', 'board');
    if (occ.type === 'mirror') {
      // 与拿起投影完全同一套：mirrorBoardLayout + 格内 px
      const lay = mirrorBoardLayout(cellPx);
      applyMirrorBoardBox(spr, lay);
      spr.style.left = `${lay.left}px`;
      spr.style.top = `${lay.top}px`;
      spr.style.opacity = '1';
    } else if (occ.type === 'light') {
      const size = Math.round(cellPx * (lightPlacedScalePercent() / 100));
      spr.classList.add('prop-on-board');
      spr.style.width = `${size}px`;
      spr.style.height = `${size}px`;
      spr.style.left = '50%';
      spr.style.top = '50%';
      spr.style.marginLeft = `${-size / 2}px`;
      spr.style.marginTop = `${-size / 2}px`;
      spr.style.transform = 'none';
    }
    cell.append(spr);
  }
}

/**
 * 镜 · 盘上/投影共用布局（心仪位置 = 投影位置 = 落盘位置）
 * 相对「格左上角」：left/top 为 design px
 */
function mirrorBoardLayout(cellPx: number): {
  size: number;
  left: number;
  top: number;
} {
  const size = Math.round(cellPx * (mirrorPlacedScalePercent() / 100));
  const left = cellPx / 2 - size / 2 + PROP_STYLE.mirrorPlacedOffsetX;
  const top = cellPx / 2 - size / 2 + PROP_STYLE.mirrorPlacedOffsetY;
  return { size, left, top };
}

function applyMirrorBoardBox(
  el: HTMLElement,
  lay: { size: number },
): void {
  el.classList.add('prop-on-board', 'prop-mirror-on-board');
  el.style.position = 'absolute';
  el.style.boxSizing = 'border-box';
  el.style.width = `${lay.size}px`;
  el.style.height = `${lay.size}px`;
  el.style.margin = '0';
  el.style.transform = 'none'; // 旋转只在 img
}
