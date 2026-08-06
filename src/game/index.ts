/**
 * mountGame — Step 1: tray light drag, lit ray, ghost reveal/transparent.
 */

import type { StageLayout } from '../adapt/design';
import {
  get,
  placeProp,
  removeProp,
  rotatePropAt,
  type Board,
} from './board';
import { createScanHaptics } from './feel/scan-haptics';
import { anyGhostCharging, stepGhosts } from './ghosts';
import { attachInput } from './input';
import { loadLevel, returnToTray, takeFromTray, type LoadedLevel } from './level';
import level001 from './levels/level_001.json';
import { designToCell } from './layout';
import { collectLightsFromGet, computeLit } from './optics';
import type {
  DirValue,
  DragGhost,
  Ghost,
  LevelDef,
  Occupant,
  PropType,
  TrayItem,
} from './types';
import { cellKey } from './types';
import { applyPropStyleCss } from './propStyle';
import { applyViewStyleCss } from './viewStyle';
import {
  applyLayoutToDom,
  buildUiShell,
  renderBoard,
  resetGhostAppear,
  type DomBoardElements,
} from './view/domBoard';
import { startGhostIdleLoop } from './view/ghostIdle';
import {
  freeBeamSpot,
  mountLightFx,
  type FreeGlow,
  type LightFxHandle,
} from './view/lightFx';
import { mountPropTuner } from './view/propTuner';

export type MountGameOptions = {
  stage: HTMLElement;
  uiRoot: HTMLElement;
  getLayout: () => StageLayout | null;
};

export type GameHandle = {
  dispose: () => void;
  restart: () => void;
};

type Runtime = {
  board: Board;
  ghosts: Ghost[];
  tray: TrayItem[];
  lit: Set<string>;
  drag: DragGhost | null;
  def: LevelDef;
  /** 拖动手电时连续光斑（design） */
  freeGlows: FreeGlow[];
};

function opticsGet(rt: Runtime): (x: number, y: number) => Occupant {
  return (x, y) => {
    const drag = rt.drag;
    // 拖动手电时不把幽灵灯写入格点光学（改用连续光斑）
    if (drag?.type === 'light') {
      if (
        drag.source === 'board' &&
        drag.fromCell &&
        drag.fromCell.x === x &&
        drag.fromCell.y === y
      ) {
        const occ = get(rt.board, x, y);
        if (occ?.kind === 'prop' && occ.id === drag.propId) return null;
      }
      return get(rt.board, x, y);
    }
    if (drag?.cell && drag.cell.x === x && drag.cell.y === y) {
      return {
        kind: 'prop',
        id: drag.propId ?? '__drag__',
        type: drag.type,
        facing: drag.facing,
      };
    }
    if (
      drag?.source === 'board' &&
      drag.fromCell &&
      drag.fromCell.x === x &&
      drag.fromCell.y === y
    ) {
      const occ = get(rt.board, x, y);
      if (occ?.kind === 'prop' && occ.id === drag.propId) return null;
    }
    return get(rt.board, x, y);
  };
}

/** 连续光斑是否照到某格（墙/道具不亮） */
function canLitCell(rt: Runtime, x: number, y: number): boolean {
  const occ = get(rt.board, x, y);
  if (occ?.kind === 'wall') return false;
  if (occ?.kind === 'prop') {
    // 拖起的原格视为空
    if (
      rt.drag?.source === 'board' &&
      rt.drag.fromCell &&
      rt.drag.fromCell.x === x &&
      rt.drag.fromCell.y === y
    ) {
      return true;
    }
    return false;
  }
  return true; // 空 / 鬼
}

function resolve(
  rt: Runtime,
  scanHaptics: ReturnType<typeof createScanHaptics>,
  nowMs: number = performance.now(),
): void {
  const getOcc = opticsGet(rt);
  rt.freeGlows = [];

  // —— 扫描：拖动手电 → 光斑自由跟手（前方 1 格距离连续点）——
  if (rt.drag?.type === 'light') {
    const spot = freeBeamSpot(
      rt.drag.designX,
      rt.drag.designY,
      rt.drag.facing,
    );
    rt.freeGlows = [spot];

    // 逻辑 lit：光斑中心落在哪格就亮哪格（不吸附手电格）
    const lit = new Set<string>();
    const cell = designToCell(spot.designX, spot.designY);
    if (cell && canLitCell(rt, cell.x, cell.y)) {
      lit.add(cellKey(cell.x, cell.y));
    }
    // 其它已放置光源仍走完整光路（不含拖动手电）
    const lights = collectLightsFromGet(
      rt.board.width,
      rt.board.height,
      getOcc,
    );
    const placed = computeLit({
      width: rt.board.width,
      height: rt.board.height,
      get: getOcc,
      lights,
    });
    for (const k of placed.lit) lit.add(k);

    rt.lit = lit;
    const ghostsPrev = rt.ghosts;
    rt.ghosts = stepGhosts(rt.ghosts, lit, nowMs);
    // 探查震动：仅握灯扫描（光斑格距鬼 + 出场尖峰）
    scanHaptics.onScanFrame({
      spotCell: cell,
      ghostsPrev,
      ghosts: rt.ghosts,
      nowMs,
    });
    return;
  }

  // 放下手电 → 结束扫描震动（盘上灯亮不震）
  if (scanHaptics.isActive()) scanHaptics.end();

  // —— 放置：完整直线布光 ——
  const lights = collectLightsFromGet(
    rt.board.width,
    rt.board.height,
    getOcc,
  );
  const { lit } = computeLit({
    width: rt.board.width,
    height: rt.board.height,
    get: getOcc,
    lights,
  });
  rt.lit = lit;
  rt.ghosts = stepGhosts(rt.ghosts, lit, nowMs);
}

function paint(
  els: DomBoardElements,
  rt: Runtime,
  lightFx: LightFxHandle,
): void {
  renderBoard(els, {
    board: rt.board,
    ghosts: rt.ghosts,
    lit: rt.lit,
    tray: rt.tray,
    drag: rt.drag,
    hidePropId: rt.drag?.source === 'board' ? rt.drag.propId : undefined,
  });
  // 光效独立层：仅拿起手电时画连接+光斑
  lightFx.paint(rt.drag, rt.freeGlows);
  if (rt.def.title) els.titleEl.textContent = rt.def.title;
}

export function mountGame(opts: MountGameOptions): GameHandle {
  const { stage, uiRoot, getLayout } = opts;
  const els = buildUiShell(uiRoot);
  const lightFx = mountLightFx(uiRoot);
  const ghostIdle = startGhostIdleLoop(uiRoot);
  const scanHaptics = createScanHaptics();

  let loaded: LoadedLevel = loadLevel(level001 as LevelDef);
  const rt: Runtime = {
    board: loaded.board,
    ghosts: loaded.ghosts,
    tray: loaded.tray,
    lit: new Set(),
    drag: null,
    def: loaded.def,
    freeGlows: [],
  };

  applyPropStyleCss(uiRoot);
  applyViewStyleCss(uiRoot);
  applyLayoutToDom(els);
  lightFx.layout();

  const repaint = () => paint(els, rt, lightFx);

  /**
   * 首次出场 dwell 计时：
   * - 拖着手电时：input 的 rAF 每帧 onDragMove → resolve，已能推进 litSince，
   *   禁止再开 dwell rAF，否则双循环 double-paint，光斑换格会抖（像震动）。
   * - 仅放置后的固定灯在蓄光：才用 dwell rAF 推进时间。
   */
  let dwellRaf = 0;
  const stopDwellLoop = () => {
    if (dwellRaf) {
      cancelAnimationFrame(dwellRaf);
      dwellRaf = 0;
    }
  };
  const ensureDwellLoop = () => {
    if (dwellRaf) return;
    const tick = (now: number) => {
      dwellRaf = 0;
      // 拖灯中改由 input rAF 负责，本循环让出
      if (rt.drag?.type === 'light') return;
      resolve(rt, scanHaptics, now);
      repaint();
      if (anyGhostCharging(rt.ghosts)) {
        dwellRaf = requestAnimationFrame(tick);
      }
    };
    dwellRaf = requestAnimationFrame(tick);
  };
  const afterResolve = () => {
    if (rt.drag?.type === 'light') {
      stopDwellLoop();
      return;
    }
    if (anyGhostCharging(rt.ghosts)) ensureDwellLoop();
    else stopDwellLoop();
  };

  const tuner = mountPropTuner(uiRoot, {
    onChange: () => {
      applyPropStyleCss(uiRoot);
      applyViewStyleCss(uiRoot);
      applyLayoutToDom(els);
      lightFx.layout();
      repaint();
    },
  });

  resolve(rt, scanHaptics);
  repaint();
  afterResolve();

  const restart = () => {
    loaded = loadLevel(level001 as LevelDef);
    rt.board = loaded.board;
    rt.ghosts = loaded.ghosts;
    rt.tray = loaded.tray;
    rt.drag = null;
    rt.freeGlows = [];
    rt.def = loaded.def;
    resetGhostAppear();
    stopDwellLoop();
    scanHaptics.end();
    resolve(rt, scanHaptics);
    repaint();
    afterResolve();
  };

  const detach = attachInput(uiRoot, {
    getBoard: () => rt.board,
    setDrag: (d) => {
      rt.drag = d;
      // 拖灯：停掉 dwell，避免与 input rAF 双开
      if (d?.type === 'light') stopDwellLoop();
      // 非 light 拖或清空：立刻停扫描震（不等下一帧 resolve）
      if (d?.type !== 'light') scanHaptics.end();
    },
    getLayout,
    getStage: () => stage,
    onTrayPick: (type: PropType) => takeFromTray(rt.tray, type),
    onDragMove: () => {
      resolve(rt, scanHaptics);
      repaint();
      afterResolve();
    },
    onDrop: (drag) => {
      if (!drag.cell) {
        if (drag.source === 'tray') returnToTray(rt.tray, drag.type);
        rt.drag = null;
        scanHaptics.end();
        resolve(rt, scanHaptics);
        repaint();
        afterResolve();
        return;
      }
      const { x, y } = drag.cell;
      if (drag.source === 'board' && drag.propId && drag.fromCell) {
        if (drag.fromCell.x !== x || drag.fromCell.y !== y) {
          removeProp(rt.board, drag.fromCell.x, drag.fromCell.y);
          placeProp(rt.board, x, y, drag.type, drag.facing as DirValue, {
            id: drag.propId,
          });
        }
      } else {
        placeProp(rt.board, x, y, drag.type, drag.facing as DirValue);
      }
      rt.drag = null;
      scanHaptics.end();
      resolve(rt, scanHaptics);
      repaint();
      afterResolve();
    },
    onCancelDrag: (drag) => {
      if (drag.source === 'tray') returnToTray(rt.tray, drag.type);
      rt.drag = null;
      scanHaptics.end();
      resolve(rt, scanHaptics);
      repaint();
      afterResolve();
    },
    onRotate: (x, y) => {
      if (rotatePropAt(rt.board, x, y)) {
        resolve(rt, scanHaptics);
        repaint();
        afterResolve();
      }
    },
  });

  els.boardHit.style.pointerEvents = 'auto';
  els.tray.style.pointerEvents = 'auto';
  els.hud.style.pointerEvents = 'auto';

  return {
    dispose: () => {
      stopDwellLoop();
      scanHaptics.end();
      detach();
      ghostIdle.stop();
      tuner.dispose();
      lightFx.dispose();
      uiRoot.replaceChildren();
      uiRoot.classList.remove('game-ui');
    },
    restart,
  };
}
