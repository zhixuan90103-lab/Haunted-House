/**
 * Pointer input + 手感2 拖拽会话。
 * 托盘拖出 / 盘上拖移 / 点旋；跟手 = 固定 K + 固定抬升 + 短平滑。
 */

import type { StageLayout } from '../adapt/design';
import { isInDesignBounds } from '../adapt/design';
import type { Board } from './board';
import { canPlace, get } from './board';
import {
  chaseTargetOnPointer,
  computeDragSizePx,
  createDragSession,
  samplePointer,
  tickSmooth,
  type DragSession,
} from './feel/drag-session';
import {
  cellSize,
  cellToDesignCenter,
  designToCell,
  DRAG_THRESHOLD_PX,
  TRAY_LAYOUT,
} from './layout';
import { PROP_STYLE } from './propStyle';
import {
  clampTrayScroll,
  countTrayItems,
  createTrayMetrics,
  getTrayScrollX,
  preferredTrayGapPx,
  preferredTraySlotPx,
  setTrayScrollX,
  TRAY_SCROLL_AXIS,
  TRAY_SCROLL_SLOP_PX,
  trayTrackOffsetX,
} from './trayMetrics';
import type { DirValue, DragGhost, PropType, TrayItem } from './types';

export type InputCallbacks = {
  getBoard: () => Board;
  setDrag: (d: DragGhost | null) => void;
  onTrayPick: (type: PropType) => boolean;
  onDrop: (drag: DragGhost) => void;
  onCancelDrag: (drag: DragGhost) => void;
  onRotate: (x: number, y: number) => void;
  onDragMove: () => void;
  getLayout: () => StageLayout | null;
  getStage: () => HTMLElement;
  /** 当前托盘（算 scroll 上限 / 件数） */
  getTray: () => TrayItem[];
  /** 托盘 track DOM（写 transform） */
  getTrayTrack: () => HTMLElement | null;
  /**
   * 额外放置门禁（在 canPlace 之后）。
   * 返回 false 时不吸附、不落格（松手走 cancel）。
   */
  canCommitDrop?: (drag: DragGhost, x: number, y: number) => boolean;
  /** Camera / Capturing / Won：禁止盘面与托盘操作 */
  isInputLocked?: () => boolean;
};

function clientToDesignLocal(
  clientX: number,
  clientY: number,
  stage: HTMLElement,
  layout: StageLayout,
): { x: number; y: number } {
  const rect = stage.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / layout.scale,
    y: (clientY - rect.top) / layout.scale,
  };
}

/** 托盘锚点：条带水平中心、竖直中心（对齐 BB 槽中心拿起） */
function trayAnchorCenter(): { cx: number; cy: number } {
  return {
    cx: TRAY_LAYOUT.left + TRAY_LAYOUT.width / 2,
    cy: TRAY_LAYOUT.top + TRAY_LAYOUT.height / 2,
  };
}

function syncGhostFromSession(
  ghost: DragGhost,
  session: DragSession,
  board: Board,
  canCommitDrop?: (drag: DragGhost, x: number, y: number) => boolean,
): void {
  ghost.designX = session.frameCx;
  ghost.designY = session.frameCy;
  ghost.fingerX = session.lastFx;
  ghost.fingerY = session.lastFy;
  ghost.scale = session.scale;
  ghost.openT = session.openT;
  ghost.dragSizePx = session.dragSizePx;

  // 吸附用视觉中心（块中心），不是指尖
  const cell = designToCell(session.frameCx, session.frameCy);
  const ignore = ghost.source === 'board' ? ghost.propId : undefined;
  if (
    cell &&
    canPlace(board, cell.x, cell.y, ignore) &&
    (canCommitDrop?.(ghost, cell.x, cell.y) ?? true)
  ) {
    ghost.cell = cell;
  } else {
    ghost.cell = null;
  }
}

export function attachInput(
  uiRoot: HTMLElement,
  cb: InputCallbacks,
): () => void {
  let pointerId: number | null = null;
  let downDesign = { x: 0, y: 0 };
  let moved = false;
  let pendingBoardProp: {
    propId: string;
    x: number;
    y: number;
    type: PropType;
    facing: DirValue;
  } | null = null;
  /** 托盘武装：未 take，待横滑 / 拖出判定 */
  let pendingTray: {
    type: PropType;
    el: HTMLElement;
  } | null = null;
  /** pointer 落在托盘带上（含空白，可横滑） */
  let trayPointerArmed = false;
  /** 已进入托盘横滑 */
  let trayScrolling = false;
  let trayScrollStartX = 0;
  let activeDrag: DragGhost | null = null;
  let session: DragSession | null = null;
  let rafId = 0;

  const trayMetricsNow = () => {
    const slotPx = preferredTraySlotPx();
    const gapPx = preferredTrayGapPx(slotPx);
    return createTrayMetrics(countTrayItems(cb.getTray()), slotPx, gapPx);
  };

  const applyTrayTrackTransform = () => {
    const track = cb.getTrayTrack();
    if (!track) return;
    const m = trayMetricsNow();
    const sx = clampTrayScroll(m.maxScroll);
    track.style.transform = `translate3d(${trayTrackOffsetX(m, sx)}px,0,0)`;
  };

  const beginTrayDrag = (
    type: PropType,
    trayBtn: HTMLElement,
    design: { x: number; y: number },
    layout: StageLayout,
    stage: HTMLElement,
  ) => {
    // 标记被拿起的槽，托盘 rebuild 时 FLIP 排除它，其余从旧位滑过去
    trayBtn.dataset.trayPicking = '1';
    if (!cb.onTrayPick(type)) {
      delete trayBtn.dataset.trayPicking;
      return false;
    }
    pendingTray = null;
    trayScrolling = false;
    moved = true;
    pendingBoardProp = null;
    const anchor = trayAnchorCenter();
    const br = trayBtn.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const btnCx = (br.left + br.width / 2 - stageRect.left) / layout.scale;
    const btnCy = (br.top + br.height / 2 - stageRect.top) / layout.scale;
    const facing = (
      type === 'mirror'
        ? PROP_STYLE.mirrorDefaultFacing
        : PROP_STYLE.defaultFacing
    ) as DirValue;
    beginDrag(
      {
        source: 'tray',
        type,
        facing,
        cell: null,
        designX: btnCx || anchor.cx,
        designY: btnCy || anchor.cy,
      },
      Number.isFinite(btnCx) ? btnCx : anchor.cx,
      Number.isFinite(btnCy) ? btnCy : anchor.cy,
      design.x,
      design.y,
      true,
    );
    return true;
  };

  const stopRaf = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  const startRaf = () => {
    stopRaf();
    const loop = () => {
      if (!session || !activeDrag) {
        rafId = 0;
        return;
      }
      tickSmooth(session);
      syncGhostFromSession(
        activeDrag,
        session,
        cb.getBoard(),
        cb.canCommitDrop,
      );
      cb.setDrag({ ...activeDrag });
      cb.onDragMove();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  };

  const beginDrag = (
    ghost: DragGhost,
    anchorCx: number,
    anchorCy: number,
    fx: number,
    fy: number,
    fromTray: boolean,
  ) => {
    const cell = cellSize();
    const liftPct =
      ghost.type === 'light'
        ? PROP_STYLE.lightLiftScale
        : ghost.type === 'mirror'
          ? PROP_STYLE.mirrorLiftScale
          : PROP_STYLE.boardScale;
    const dragSizePx = computeDragSizePx(cell, liftPct);
    session = createDragSession({
      anchorCx,
      anchorCy,
      fx,
      fy,
      cell,
      fromTray,
      dragSizePx,
    });
    activeDrag = ghost;
    syncGhostFromSession(
      activeDrag,
      session,
      cb.getBoard(),
      cb.canCommitDrop,
    );
    cb.setDrag({ ...activeDrag });
    cb.onDragMove();
    startRaf();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    const layout = cb.getLayout();
    if (!layout) return;
    const stage = cb.getStage();
    const d = clientToDesignLocal(e.clientX, e.clientY, stage, layout);

    const dx = d.x - downDesign.x;
    const dy = d.y - downDesign.y;
    const dist = Math.hypot(dx, dy);

    // 托盘：横滑 vs 拖出（BB2 轴锁；图标不缩，溢出靠 scroll）
    if ((trayPointerArmed || trayScrolling) && !activeDrag) {
      const m = trayMetricsNow();
      const canScroll = !m.fits && m.maxScroll > 0;
      if (!trayScrolling && canScroll) {
        const isHScroll =
          Math.abs(dx) >= TRAY_SCROLL_SLOP_PX &&
          Math.abs(dx) >= Math.abs(dy) * TRAY_SCROLL_AXIS;
        if (isHScroll) {
          trayScrolling = true;
          moved = true;
          pendingTray = null; // 横滑中不再拿起
        }
      }
      if (trayScrolling) {
        setTrayScrollX(trayScrollStartX - dx);
        clampTrayScroll(m.maxScroll);
        applyTrayTrackTransform();
        e.preventDefault();
        return;
      }
      // 未进横滑：位移够则拿起（含仅 1 件、无法滑时）
      if (pendingTray && dist >= DRAG_THRESHOLD_PX) {
        // 可滑且明显横移 → 优先继续等横滑，不误拿
        if (
          canScroll &&
          Math.abs(dx) >= Math.abs(dy) * TRAY_SCROLL_AXIS
        ) {
          e.preventDefault();
          return;
        }
        beginTrayDrag(pendingTray.type, pendingTray.el, d, layout, stage);
        trayPointerArmed = false;
      }
      e.preventDefault();
      return;
    }

    if (!moved && dist >= DRAG_THRESHOLD_PX) {
      moved = true;
      if (pendingBoardProp && !activeDrag) {
        const p = pendingBoardProp;
        const c = cellToDesignCenter(p.x, p.y);
        beginDrag(
          {
            source: 'board',
            type: p.type,
            facing: p.facing,
            propId: p.propId,
            fromCell: { x: p.x, y: p.y },
            cell: { x: p.x, y: p.y },
            designX: c.dx,
            designY: c.dy,
          },
          c.dx,
          c.dy,
          d.x,
          d.y,
          false,
        );
      }
    }

    if (session && activeDrag) {
      // 格尺寸中途若调参变化，刷新 session.cell
      session.cell = cellSize();
      samplePointer(session, d.x, d.y);
      chaseTargetOnPointer(session);
      // 必须带 canCommitDrop：扫描期手电禁止落格 → cell=null，否则会误触投影换格震动
      syncGhostFromSession(
        activeDrag,
        session,
        cb.getBoard(),
        cb.canCommitDrop,
      );
      cb.setDrag({ ...activeDrag });
      cb.onDragMove();
    }
    e.preventDefault();
  };

  const endPointer = (e: PointerEvent) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    const layout = cb.getLayout();
    const stage = cb.getStage();
    if (layout && session && activeDrag) {
      const d = clientToDesignLocal(e.clientX, e.clientY, stage, layout);
      samplePointer(session, d.x, d.y);
      chaseTargetOnPointer(session);
      syncGhostFromSession(
        activeDrag,
        session,
        cb.getBoard(),
        cb.canCommitDrop,
      );
    }

    stopRaf();

    // 托盘轻点：不 take（需拖出）；盘上轻点仍旋转
    if (!moved && pendingBoardProp && !activeDrag) {
      cb.onRotate(pendingBoardProp.x, pendingBoardProp.y);
    } else if (activeDrag) {
      if (activeDrag.cell) cb.onDrop(activeDrag);
      else cb.onCancelDrag(activeDrag);
    }

    if (trayScrolling) {
      const m = trayMetricsNow();
      clampTrayScroll(m.maxScroll);
      applyTrayTrackTransform();
    }

    activeDrag = null;
    session = null;
    pendingBoardProp = null;
    pendingTray = null;
    trayPointerArmed = false;
    trayScrolling = false;
    pointerId = null;
    moved = false;
    cb.setDrag(null);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endPointer);
    window.removeEventListener('pointercancel', endPointer);
  };

  const beginTrack = (e: PointerEvent) => {
    pointerId = e.pointerId;
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (pointerId !== null) return;
    // 调参 / 相机控件不进拖拽
    const t = e.target instanceof Element ? e.target : null;
    if (
      t?.closest?.(
        '#prop-tuner, #prop-tuner-fab, #haptic-tuner, #haptic-tuner-fab, #island-tuner, #island-tuner-fab, #settle-tuner, #settle-tuner-fab, #btn-restart, .game-restart-btn, .layout-tuner, .prop-tuner, .prop-tuner-fab, .haptic-tuner, .haptic-tuner-fab, .island-tuner, .island-tuner-fab, .settle-tuner, .settle-tuner-fab, .camera-session, .camera-btn, .won-replay-btn',
      )
    )
      return;
    // Camera / Capturing / Won：锁盘
    if (cb.isInputLocked?.()) return;

    const layout = cb.getLayout();
    if (!layout) return;

    const stage = cb.getStage();
    const design = clientToDesignLocal(e.clientX, e.clientY, stage, layout);
    if (!isInDesignBounds(design.x, design.y)) return;

    const target = e.target as HTMLElement | null;
    const trayEl = target?.closest?.('#tray') as HTMLElement | null;
    if (trayEl) {
      downDesign = design;
      moved = false;
      pendingBoardProp = null;
      pendingTray = null;
      trayPointerArmed = true;
      trayScrolling = false;
      trayScrollStartX = getTrayScrollX();
      const trayBtn = target?.closest?.('.tray-item') as HTMLElement | null;
      if (trayBtn?.dataset.trayType) {
        pendingTray = {
          type: trayBtn.dataset.trayType as PropType,
          el: trayBtn,
        };
      }
      // 空白带也可横滑；件数少 fits 时无 scroll
      beginTrack(e);
      e.preventDefault();
      return;
    }

    const cell = designToCell(design.x, design.y);
    if (cell) {
      const occ = get(cb.getBoard(), cell.x, cell.y);
      if (occ?.kind === 'prop' && !occ.locked) {
        downDesign = design;
        moved = false;
        pendingBoardProp = {
          propId: occ.id,
          x: cell.x,
          y: cell.y,
          type: occ.type,
          facing: occ.facing,
        };
        activeDrag = null;
        session = null;
        beginTrack(e);
        e.preventDefault();
      }
    }
  };

  uiRoot.addEventListener('pointerdown', onPointerDown);

  return () => {
    stopRaf();
    uiRoot.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endPointer);
    window.removeEventListener('pointercancel', endPointer);
  };
}
