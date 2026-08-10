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
import {
  allGhostsFound,
  allRevealed,
  anyGhostCharging,
  stepGhosts,
} from './ghosts';
import { attachInput } from './input';
import {
  loadLevel,
  returnToTray,
  takeFromTray,
  TRAY_UNLOCK_ON_ALL_FOUND,
  unlockTrayTypes,
  type LoadedLevel,
} from './level';
import level001 from './levels/level_001.json';
import { resetTrayScroll } from './trayMetrics';
import { designToCell } from './layout';
import {
  castReflectingLightPath,
  collectLightsFromGet,
  computeLit,
} from './optics';
import type {
  DirValue,
  DragGhost,
  Ghost,
  LevelDef,
  Occupant,
  PropType,
  TrayItem,
} from './types';
import { cellKey, Dir, GhostState, SessionPhase } from './types';
import { applyPropStyleCss } from './propStyle';
import { applyViewStyleCss } from './viewStyle';
import {
  applyLayoutToDom,
  buildUiShell,
  renderBoard,
  resetGhostAppear,
  resetTrayDomCache,
  type DomBoardElements,
} from './view/domBoard';
import { startGhostIdleLoop } from './view/ghostIdle';
import {
  freeBeamSpotWithLengthPx,
  freeShineLengthPx,
  mountLightFx,
  type FreeGlow,
  type LightFxHandle,
  type PlacedLightFx,
} from './view/lightFx';
import { mountHapticTuner } from './view/hapticTuner';
import { mountPropTuner } from './view/propTuner';
import { captureBoardDataUrl } from './view/captureBoard';
import { mountCameraSession } from './view/cameraSession';
import { mountIslandTuner } from './view/islandTuner';
import { applyPrintLayoutCss } from './printLayout';

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
  /** 拖动手电时光斑（design，始终跟手；长度随位置变） */
  freeGlows: FreeGlow[];
  /**
   * 可放时光学路径（算长度 / 镜后折线）；绘制时第一段锚在手上，不锚在吸附格。
   */
  previewLight: PlacedLightFx | null;
  /** 全鬼发现后已解锁镜等进托盘 */
  trayUnlocked: boolean;
  /** 本帧需滑入动画的托盘类型（paint 消费后清空） */
  trayEnterTypes: string[];
  /** 会话相位：Playing / Camera / Capturing / Won */
  phase: SessionPhase;
};

/** 全员 everLit → 镜等滑入托盘（只触发一次） */
function maybeUnlockTray(rt: Runtime): void {
  if (rt.trayUnlocked) return;
  if (!allGhostsFound(rt.ghosts)) return;
  const unlocked = unlockTrayTypes(
    rt.tray,
    rt.def,
    TRAY_UNLOCK_ON_ALL_FOUND,
  );
  rt.trayUnlocked = true;
  if (unlocked.length) {
    rt.trayEnterTypes = unlocked;
  }
}

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
  rt.previewLight = null;

  // —— 拖动手电（A1：视觉全程同一套跟手照射）——
  if (rt.drag?.type === 'light') {
    const drag = rt.drag;
    const ghostsPrev = rt.ghosts;
    const longRange = allGhostsFound(rt.ghosts);

    // 光斑/连接：跟手；扫鬼固定短距，找全后可略长但有 glowForwardLong 上限
    const lenPx = freeShineLengthPx({
      lightX: drag.designX,
      lightY: drag.designY,
      facing: drag.facing,
      width: rt.board.width,
      height: rt.board.height,
      get: getOcc,
      longRange,
    });
    const spot = freeBeamSpotWithLengthPx(
      drag.designX,
      drag.designY,
      drag.facing,
      lenPx,
    );
    rt.freeGlows = [spot];

    // 逻辑 lit：可吸附时按落点格完整光路；否则按光斑所在格扫描
    if (drag.cell && longRange) {
      const { x, y } = drag.cell;
      const facing = drag.facing as Dir;
      const path = castReflectingLightPath(
        rt.board.width,
        rt.board.height,
        getOcc,
        x,
        y,
        facing,
      );
      rt.previewLight = {
        x,
        y,
        facing: drag.facing as DirValue,
        segments: path.segments,
        endX: path.end?.x ?? null,
        endY: path.end?.y ?? null,
        litCount: path.litCells.length,
      };
      const lights = collectLightsFromGet(
        rt.board.width,
        rt.board.height,
        getOcc,
      );
      lights.push({ x, y, dir: facing });
      const { lit } = computeLit({
        width: rt.board.width,
        height: rt.board.height,
        get: getOcc,
        lights,
      });
      rt.lit = lit;
      rt.ghosts = stepGhosts(rt.ghosts, lit, nowMs);
      maybeUnlockTray(rt);
      scanHaptics.onScanFrame({
        spotCell:
          path.end != null ? { x: path.end.x, y: path.end.y } : { x, y },
        ghostsPrev,
        ghosts: rt.ghosts,
        nowMs,
      });
      return;
    }

    const lit = new Set<string>();
    const cell = designToCell(spot.designX, spot.designY);
    if (cell && canLitCell(rt, cell.x, cell.y)) {
      lit.add(cellKey(cell.x, cell.y));
    }
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
    rt.ghosts = stepGhosts(rt.ghosts, lit, nowMs);
    maybeUnlockTray(rt);
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
  maybeUnlockTray(rt);
}

/** 盘上 light 发射列表；折线（含镜）。拖起中的灯排除。 */
function collectPlacedLightFx(
  board: Board,
  hidePropId?: string,
): PlacedLightFx[] {
  const list: PlacedLightFx[] = [];
  const getOcc = (x: number, y: number) => get(board, x, y);
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const occ = get(board, x, y);
      if (occ?.kind !== 'prop' || occ.type !== 'light') continue;
      if (hidePropId && occ.id === hidePropId) continue;
      const path = castReflectingLightPath(
        board.width,
        board.height,
        getOcc,
        x,
        y,
        occ.facing as Dir,
      );
      list.push({
        x,
        y,
        facing: occ.facing as DirValue,
        segments: path.segments,
        endX: path.end?.x ?? null,
        endY: path.end?.y ?? null,
        litCount: path.litCells.length,
      });
    }
  }
  return list;
}

function paint(
  els: DomBoardElements,
  rt: Runtime,
  lightFx: LightFxHandle,
): void {
  const hidePropId =
    rt.drag?.source === 'board' ? rt.drag.propId : undefined;
  const enterTypes = rt.trayEnterTypes;
  renderBoard(els, {
    board: rt.board,
    ghosts: rt.ghosts,
    lit: rt.lit,
    tray: rt.tray,
    drag: rt.drag,
    hidePropId,
    trayEnterTypes: enterTypes,
  });
  // 滑入动画只播一帧标记即可；节点保留后动画可播完
  if (enterTypes.length) rt.trayEnterTypes = [];

  // 光效层：放置发射 + 扫描/可放预览（Additive）
  lightFx.paint({
    drag: rt.drag,
    freeGlows: rt.freeGlows,
    placedLights: collectPlacedLightFx(rt.board, hidePropId),
    previewLight: rt.previewLight,
  });
  if (rt.def.title) els.titleEl.textContent = rt.def.title;
  // 提示：找全鬼后提示可用镜
  if (rt.trayUnlocked) {
    els.hintEl.textContent =
      '摆镜折光 · 点旋改朝向 · 全员同时显示后自动拍照';
  }
}

function markAllCaught(ghosts: Ghost[]): Ghost[] {
  return ghosts.map((g) => ({ ...g, state: GhostState.Caught, litSince: undefined }));
}

export function mountGame(opts: MountGameOptions): GameHandle {
  const { stage, uiRoot, getLayout } = opts;
  const els = buildUiShell(uiRoot);
  const lightFx = mountLightFx(uiRoot);
  const ghostIdle = startGhostIdleLoop(uiRoot);
  const scanHaptics = createScanHaptics();
  const camera = mountCameraSession(uiRoot);
  applyPrintLayoutCss(uiRoot);

  let loaded: LoadedLevel = loadLevel(level001 as LevelDef);
  const rt: Runtime = {
    board: loaded.board,
    ghosts: loaded.ghosts,
    tray: loaded.tray,
    lit: new Set(),
    drag: null,
    def: loaded.def,
    freeGlows: [],
    previewLight: null,
    trayUnlocked: false,
    trayEnterTypes: [],
    phase: SessionPhase.Playing,
  };

  applyPropStyleCss(uiRoot);
  applyViewStyleCss(uiRoot);
  applyLayoutToDom(els);
  lightFx.layout();

  const setPlayLock = (locked: boolean) => {
    const pe = locked ? 'none' : 'auto';
    els.boardHit.style.pointerEvents = pe;
    els.tray.style.pointerEvents = pe;
    // Camera：隐藏重制；Won：可用再玩一次（camera 层按钮）
    els.restartBtn.style.display = locked ? 'none' : '';
    els.restartBtn.style.pointerEvents = locked ? 'none' : 'auto';
    uiRoot.classList.toggle('session-locked', locked);
  };

  const applyPhaseUi = () => {
    const p = rt.phase;
    if (p === SessionPhase.Playing) {
      camera.setPhase('hidden');
      setPlayLock(false);
    } else if (p === SessionPhase.Camera) {
      camera.setPhase('camera');
      setPlayLock(true);
    } else if (p === SessionPhase.Capturing) {
      camera.setPhase('capturing');
      setPlayLock(true);
    } else {
      camera.setPhase('won');
      setPlayLock(true);
    }
  };

  const repaint = () => paint(els, rt, lightFx);

  /** R21：非拖拽且全员 Revealed → Camera */
  const maybeEnterCamera = () => {
    if (rt.phase !== SessionPhase.Playing) return;
    if (rt.drag) return;
    if (!allRevealed(rt.ghosts)) return;
    rt.phase = SessionPhase.Camera;
    scanHaptics.end();
    applyPhaseUi();
  };

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
    if (rt.phase === SessionPhase.Playing) {
      maybeEnterCamera();
    }
    if (rt.drag?.type === 'light') {
      stopDwellLoop();
      return;
    }
    if (rt.phase !== SessionPhase.Playing) {
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
  const hapticTuner = mountHapticTuner(uiRoot);
  const islandTuner = mountIslandTuner(uiRoot, {
    onChange: () => {
      applyPrintLayoutCss(uiRoot);
    },
    onPreview: (on) => {
      camera.setIslandPreview(on);
    },
  });

  resolve(rt, scanHaptics);
  repaint();
  afterResolve();

  const restart = () => {
    // 本关重开：鬼全隐藏、道具回托盘、盘面清空玩家摆放、停扫描震动
    loaded = loadLevel(level001 as LevelDef);
    rt.board = loaded.board;
    rt.ghosts = loaded.ghosts;
    rt.tray = loaded.tray;
    rt.drag = null;
    rt.freeGlows = [];
    rt.previewLight = null;
    rt.def = loaded.def;
    rt.trayUnlocked = false;
    rt.trayEnterTypes = [];
    rt.phase = SessionPhase.Playing;
    resetGhostAppear();
    resetTrayDomCache();
    resetTrayScroll();
    stopDwellLoop();
    scanHaptics.end();
    applyPhaseUi();
    resolve(rt, scanHaptics);
    repaint();
    afterResolve();
  };

  const onReturnFromCamera = () => {
    if (rt.phase !== SessionPhase.Camera) return;
    rt.phase = SessionPhase.Playing;
    applyPhaseUi();
    resolve(rt, scanHaptics);
    repaint();
    afterResolve(); // 仍全显则再进 Camera
  };

  const onShutter = async () => {
    if (rt.phase !== SessionPhase.Camera) return;
    rt.phase = SessionPhase.Capturing;
    applyPhaseUi();
    try {
      // 先截（含全亮棋盘），再播闪白/吐纸
      const dataUrl = await captureBoardDataUrl(uiRoot);
      await camera.playCapture(dataUrl);
      rt.ghosts = markAllCaught(rt.ghosts);
      rt.phase = SessionPhase.Won;
      applyPhaseUi();
      repaint();
    } catch (err) {
      console.error('[camera] capture failed', err);
      // 截失败：回 Camera 可重拍，不写 Caught
      rt.phase = SessionPhase.Camera;
      applyPhaseUi();
    }
  };

  camera.onShutter(() => {
    void onShutter();
  });
  camera.onReturn(onReturnFromCamera);
  camera.onReplay(restart);

  els.restartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (rt.phase !== SessionPhase.Playing) return;
    restart();
  });
  els.restartBtn.addEventListener('pointerdown', (e) => e.stopPropagation());

  const detach = attachInput(uiRoot, {
    getBoard: () => rt.board,
    getTray: () => rt.tray,
    getTrayTrack: () => els.trayTrack,
    isInputLocked: () => rt.phase !== SessionPhase.Playing,
    setDrag: (d) => {
      rt.drag = d;
      // 拖灯：停掉 dwell，避免与 input rAF 双开
      if (d?.type === 'light') stopDwellLoop();
      // 清空 drag 时由 onDrop/onCancel 显式 end；此处勿对 null 重复 end
      // （endPointer 总会 setDrag(null)，避免与 drop 竞态掐断刚启动的 continuous）
      if (d != null && d.type !== 'light') scanHaptics.end();
    },
    getLayout,
    getStage: () => stage,
    onTrayPick: (type: PropType) => takeFromTray(rt.tray, type),
    // 未找全鬼：手电只能扫描，禁止落格（镜等其它道具不受限）
    canCommitDrop: (drag) => {
      if (drag.type === 'light' && !allGhostsFound(rt.ghosts)) return false;
      return true;
    },
    onDragMove: () => {
      if (rt.phase !== SessionPhase.Playing) return;
      resolve(rt, scanHaptics);
      repaint();
      afterResolve();
    },
    onDrop: (drag) => {
      // 双重门禁：吸附已挡；此处防竞态
      const blocked =
        drag.type === 'light' && !allGhostsFound(rt.ghosts);
      if (!drag.cell || blocked) {
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
      if (rt.phase !== SessionPhase.Playing) return;
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
  applyPhaseUi();

  return {
    dispose: () => {
      stopDwellLoop();
      scanHaptics.end();
      detach();
      camera.dispose();
      ghostIdle.stop();
      tuner.dispose();
      hapticTuner.dispose();
      islandTuner.dispose();
      lightFx.dispose();
      uiRoot.replaceChildren();
      uiRoot.classList.remove('game-ui', 'session-locked');
    },
    restart,
  };
}
