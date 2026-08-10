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
} from '../propStyle';
import {
  clampTrayScroll,
  countTrayItems,
  createTrayMetrics,
  preferredTrayGapPx,
  preferredTraySlotPx,
  trayTrackOffsetX,
} from '../trayMetrics';
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

/** 透明态（已发现但不在光中）· 开心 */
const GHOST_SRC = './ghost-revealed2.png';
/** 完全在光中 · Revealed · 哭泣 */
const GHOST_REVEALED_SRC = './ghost-revealed.png';
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
  /** 托盘视口（裁剪） */
  tray: HTMLElement;
  /** 托盘内容轨（flex 槽 + translateX 滚动） */
  trayTrack: HTMLElement;
  hud: HTMLElement;
  dragLayer: HTMLElement;
  titleEl: HTMLElement;
  hintEl: HTMLElement;
  /** 扫鬼目标进度，如 0/4 */
  goalEl: HTMLElement;
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
  titleEl.hidden = true;
  titleEl.textContent = '';
  const hintEl = document.createElement('p');
  hintEl.className = 'game-hint';
  hintEl.textContent = '拿起手电找到全部的鬼魂。';
  const goalEl = document.createElement('div');
  goalEl.id = 'goal-progress';
  goalEl.className = 'game-goal';
  goalEl.setAttribute('aria-live', 'polite');
  goalEl.setAttribute('aria-label', '扫描目标');
  goalEl.textContent = '0/0';
  hud.append(titleEl, hintEl, goalEl);

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

  const trayTrack = document.createElement('div');
  trayTrack.className = 'tray-track';
  tray.append(trayTrack);

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
    trayTrack,
    hud,
    dragLayer,
    titleEl,
    hintEl,
    goalEl,
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
/** 入场 overflow 放开的定时器 */
let trayEnterTimer = 0;
/** 补位 FLIP 清理定时器 */
const trayFlipTimers = new Set<number>();

export function resetTrayDomCache(): void {
  trayDomSig = '';
  if (trayEnterTimer) {
    clearTimeout(trayEnterTimer);
    trayEnterTimer = 0;
  }
  for (const id of trayFlipTimers) clearTimeout(id);
  trayFlipTimers.clear();
}

/** 入场动画时长 / 错峰（与 CSS 一致） */
const TRAY_ENTER_MS = 560;
const TRAY_ENTER_STAGGER_MS = 90;
/** 拿起/放回后剩余道具补位滑动（对齐 BB2 TRAY_FLIP） */
const TRAY_FLIP_MS = 200;

function traySignature(tray: TrayItem[]): string {
  // 不含 enterTypes：解锁当帧 rebuild+滑入后，后续帧签名不变，避免掐动画
  return tray.map((t) => `${t.type}:${t.count}`).join(',');
}

function trayFacingFor(type: PropType): number {
  return type === 'mirror'
    ? PROP_STYLE.mirrorDefaultFacing
    : PROP_STYLE.trayFacing;
}

/**
 * 记录剩余槽屏幕矩形（FLIP First）。
 * 跳过 `data-tray-picking`（正在拿起的那颗），保证按视觉顺序配对。
 */
function captureTrayItemRects(track: HTMLElement): DOMRect[] {
  const list: DOMRect[] = [];
  for (const node of track.children) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.dataset.trayPicking === '1') continue;
    list.push(node.getBoundingClientRect());
  }
  return list;
}

/**
 * FLIP 补位：剩余道具从旧屏位滑到新屏位（拿起后 pad/间距变化）。
 * first 与「非入场」新节点按顺序一一对应。
 */
function playTrayFlip(track: HTMLElement, first: DOMRect[]): void {
  if (!first.length) return;
  const survivors: HTMLElement[] = [];
  for (const node of track.children) {
    if (!(node instanceof HTMLElement)) continue;
    // 新滑入的用自己的 enter 动画，不参与补位
    if (node.classList.contains('tray-item-enter')) continue;
    survivors.push(node);
  }

  const plays: { el: HTMLElement; dx: number; dy: number }[] = [];
  const n = Math.min(first.length, survivors.length);
  for (let i = 0; i < n; i++) {
    const el = survivors[i]!;
    const prev = first[i]!;
    const last = el.getBoundingClientRect();
    const dx = prev.left - last.left;
    const dy = prev.top - last.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    plays.push({ el, dx, dy });
  }
  if (!plays.length) return;

  for (const { el, dx, dy } of plays) {
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  void track.offsetWidth;

  requestAnimationFrame(() => {
    for (const { el } of plays) {
      el.style.transition = `transform ${TRAY_FLIP_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      el.style.transform = 'translate(0px, 0px)';
    }
  });

  for (const { el } of plays) {
    const tid = window.setTimeout(() => {
      trayFlipTimers.delete(tid);
      el.style.transition = '';
      el.style.transform = '';
    }, TRAY_FLIP_MS + 40);
    trayFlipTimers.add(tid);
  }
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

function ghostSrcForState(state: GhostState): string {
  // 完全在光中 → 开心贴图；离开光但仍可见 → 伤心贴图
  if (state === GhostState.Revealed || state === GhostState.Caught) {
    return GHOST_REVEALED_SRC;
  }
  return GHOST_SRC;
}

function syncGhostVisualState(el: HTMLElement, g: Ghost): void {
  el.dataset.state = g.state;
  el.classList.toggle('ghost-transparent', g.state === GhostState.Transparent);
  el.classList.toggle('ghost-revealed', g.state === GhostState.Revealed);

  const src = ghostSrcForState(g.state);
  const base = el.querySelector<HTMLImageElement>('.ghost-base');
  const litAdd = el.querySelector<HTMLImageElement>('.ghost-lit-add');
  if (base && base.getAttribute('src') !== src) {
    base.src = src;
  }
  if (litAdd && litAdd.getAttribute('src') !== src) {
    litAdd.src = src;
  }
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

  const src = ghostSrcForState(g.state);
  const img = document.createElement('img');
  img.className = 'ghost-base';
  img.src = src;
  img.alt = 'ghost';
  img.draggable = false;

  // 被光照到时：同贴图 Additive 叠一层（仅 Revealed）
  const litAdd = document.createElement('img');
  litAdd.className = 'ghost-lit-add';
  litAdd.src = src;
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
      litAdd.src = ghostSrcForState(g.state);
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

  // 托盘：固定图标尺寸 + track 横滑（BB2 思路，不缩到全显）
  const enterTypes = state.trayEnterTypes;
  const sig = traySignature(tray);
  if (sig !== trayDomSig) {
    // First：重建前旧位（拿起/放回后剩余件要滑过去，不能瞬移）
    const flipFirst = captureTrayItemRects(els.trayTrack);
    trayDomSig = sig;
    const enterSet = new Set(enterTypes ?? []);
    let enterIndex = 0;
    els.trayTrack.replaceChildren();
    for (const item of tray) {
      for (let i = 0; i < item.count; i++) {
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = 'tray-item';
        slot.dataset.trayType = item.type;
        slot.setAttribute('aria-label', `${item.type} ${i + 1}`);
        const spr = propImg(
          item.type,
          trayFacingFor(item.type),
          'tray-prop',
          'tray',
        );
        if (enterSet.has(item.type)) {
          slot.classList.add('tray-item-enter');
          // 错峰打在精灵上（真正做 transform 的节点）
          spr.style.animationDelay = `${enterIndex * TRAY_ENTER_STAGGER_MS}ms`;
          enterIndex += 1;
          // 动画结束后恢复可点、去掉 class（避免 animation:both 锁死）
          const done = () => {
            slot.classList.remove('tray-item-enter');
            spr.style.animationDelay = '';
            spr.removeEventListener('animationend', done);
          };
          spr.addEventListener('animationend', done);
        }
        slot.append(spr);
        els.trayTrack.append(slot);
      }
    }

    // 入场期间放开 overflow，否则 translateY 被视口裁掉，看不见滑动过程
    if (trayEnterTimer) {
      clearTimeout(trayEnterTimer);
      trayEnterTimer = 0;
    }
    if (enterIndex > 0) {
      els.tray.classList.add('is-tray-entering');
      const hold =
        TRAY_ENTER_MS +
        (enterIndex - 1) * TRAY_ENTER_STAGGER_MS +
        80;
      trayEnterTimer = window.setTimeout(() => {
        els.tray.classList.remove('is-tray-entering');
        trayEnterTimer = 0;
      }, hold);
    } else {
      els.tray.classList.remove('is-tray-entering');
    }

    // 先写 track 偏移/槽尺寸，再测 Last 并 FLIP 补位
    applyPropStyleCss(els.root);
    applyTrayLayout(els, tray);
    playTrayFlip(els.trayTrack, flipFirst);
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
  // 每帧同步 slot / scroll（rebuild 时上面已 apply 一次，再写无害）
  applyTrayLayout(els, tray);
}

/** 固定 slot 尺寸 + 居中 pad / 横滑 offset（不缩小图标） */
function applyTrayLayout(
  els: DomBoardElements,
  tray: TrayItem[],
): void {
  const slotPx = preferredTraySlotPx();
  const gapPx = preferredTrayGapPx(slotPx);
  const m = createTrayMetrics(countTrayItems(tray), slotPx, gapPx);
  const scrollX = clampTrayScroll(m.maxScroll);
  const ox = trayTrackOffsetX(m, scrollX);

  els.root.style.setProperty('--prop-tray-slot-size', `${slotPx}px`);
  els.root.style.setProperty('--prop-tray-gap', `${gapPx}px`);
  els.trayTrack.style.transform = `translate3d(${ox}px,0,0)`;
  els.tray.dataset.trayScrollable = m.fits ? '0' : '1';
  els.tray.dataset.trayMaxScroll = String(m.maxScroll);
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
