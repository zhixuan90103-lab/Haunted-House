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
import type { DirValue, DragGhost, PropType } from './types';

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
): void {
  ghost.designX = session.frameCx;
  ghost.designY = session.frameCy;
  ghost.fingerX = session.lastFx;
  ghost.fingerY = session.lastFy;
  ghost.scale = session.scale;
  ghost.dragSizePx = session.dragSizePx;

  // 吸附用视觉中心（块中心），不是指尖
  const cell = designToCell(session.frameCx, session.frameCy);
  const ignore = ghost.source === 'board' ? ghost.propId : undefined;
  if (cell && canPlace(board, cell.x, cell.y, ignore)) {
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
  let activeDrag: DragGhost | null = null;
  let session: DragSession | null = null;
  let rafId = 0;

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
      syncGhostFromSession(activeDrag, session, cb.getBoard());
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
    const dragSizePx = computeDragSizePx(
      cell,
      PROP_STYLE.lightBoardScale,
      PROP_STYLE.dragScale,
    );
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
    syncGhostFromSession(activeDrag, session, cb.getBoard());
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

    const dist = Math.hypot(d.x - downDesign.x, d.y - downDesign.y);
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
      syncGhostFromSession(activeDrag, session, cb.getBoard());
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
      syncGhostFromSession(activeDrag, session, cb.getBoard());
    }

    stopRaf();

    if (!moved && pendingBoardProp && !activeDrag) {
      cb.onRotate(pendingBoardProp.x, pendingBoardProp.y);
    } else if (activeDrag) {
      if (activeDrag.cell) cb.onDrop(activeDrag);
      else cb.onCancelDrag(activeDrag);
    }

    activeDrag = null;
    session = null;
    pendingBoardProp = null;
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
    // 调参面板不进拖拽
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest?.('#prop-tuner, #prop-tuner-fab, .layout-tuner, .prop-tuner, .prop-tuner-fab'))
      return;

    const layout = cb.getLayout();
    if (!layout) return;

    const stage = cb.getStage();
    const design = clientToDesignLocal(e.clientX, e.clientY, stage, layout);
    if (!isInDesignBounds(design.x, design.y)) return;

    const target = e.target as HTMLElement | null;
    const trayBtn = target?.closest?.('.tray-item') as HTMLElement | null;
    if (trayBtn?.dataset.trayType) {
      const type = trayBtn.dataset.trayType as PropType;
      if (!cb.onTrayPick(type)) return;
      downDesign = design;
      moved = true;
      pendingBoardProp = null;
      const anchor = trayAnchorCenter();
      // 优先用按钮中心作锚（更接近 BB 槽中心）
      const br = trayBtn.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const btnCx =
        (br.left + br.width / 2 - stageRect.left) / layout.scale;
      const btnCy =
        (br.top + br.height / 2 - stageRect.top) / layout.scale;
      beginDrag(
        {
          source: 'tray',
          type,
          facing: PROP_STYLE.defaultFacing as DirValue,
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
