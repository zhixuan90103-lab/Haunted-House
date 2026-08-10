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
import { createPlacementHaptics } from './feel/placement-haptics';
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
import {
  getLevelDef,
  hasNextLevel,
  LEVEL_CATALOG,
} from './levels/catalog';
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
import { applyViewStyleCss, VIEW_STYLE } from './viewStyle';
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
import { captureBoardDataUrl } from './view/captureBoard';
import { mountCameraSession } from './view/cameraSession';
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
  freeAlphas?: { glow: number; beam: number } | null,
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

  lightFx.paint({
    drag: rt.drag,
    freeGlows: rt.freeGlows,
    placedLights: collectPlacedLightFx(rt.board, hidePropId),
    previewLight: rt.previewLight,
    freeGlowAlpha: freeAlphas?.glow,
    freeBeamAlpha: freeAlphas?.beam,
  });

  // 关卡标题不展示（如「绕心三折」）
  els.titleEl.textContent = '';
  els.titleEl.hidden = true;
  // 扫鬼目标：everLit 数量 / 总数
  const found = rt.ghosts.filter((g) => g.everLit).length;
  const total = rt.ghosts.length;
  els.goalEl.textContent = `${found}/${total}`;
  els.goalEl.classList.toggle('is-complete', total > 0 && found >= total);
  els.goalEl.setAttribute('aria-label', `扫描目标 ${found}/${total}`);
  // 扫鬼 / 布光阶段 · 给玩家的弱提示
  if (rt.trayUnlocked) {
    els.hintEl.textContent = '设计路线，让所有鬼魂站光里。';
  } else {
    els.hintEl.textContent = '拿起手电找到全部的鬼魂。';
  }
}

function markAllCaught(ghosts: Ghost[]): Ghost[] {
  return ghosts.map((g) => ({ ...g, state: GhostState.Caught, litSince: undefined }));
}

/** 蓄光凝实进度 0→1 的目标值（仅未发现鬼格上有 hold 时 >0） */
function chargeSolidTargetT(
  rt: Runtime,
  nowMs: number,
): number {
  if (rt.drag?.type !== 'light') return 0;
  const spot = rt.freeGlows[0];
  if (!spot) return 0;
  const cell = designToCell(spot.designX, spot.designY);
  if (!cell) return 0;

  const g = rt.ghosts.find(
    (x) =>
      x.x === cell.x &&
      x.y === cell.y &&
      !x.everLit &&
      x.state !== GhostState.Caught &&
      x.litSince != null,
  );
  if (!g || g.litSince == null) return 0;

  const delay = Math.max(0, VIEW_STYLE.chargeSolidDelayMs);
  const ramp = Math.max(1, VIEW_STYLE.chargeSolidRampMs);
  const held = nowMs - g.litSince;
  if (held < delay) return 0;
  return Math.max(0, Math.min(1, (held - delay) / ramp));
}

export function mountGame(opts: MountGameOptions): GameHandle {
  const { stage, uiRoot, getLayout } = opts;
  const els = buildUiShell(uiRoot);
  const lightFx = mountLightFx(uiRoot);
  const ghostIdle = startGhostIdleLoop(uiRoot);
  const scanHaptics = createScanHaptics();
  const placementHaptics = createPlacementHaptics();
  const camera = mountCameraSession(uiRoot);
  applyPrintLayoutCss(uiRoot);

  /** 当前关卡在 LEVEL_CATALOG 中的下标 */
  let levelIndex = 0;
  let loaded: LoadedLevel = loadLevel(getLevelDef(levelIndex));
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

  /**
   * 凝实进度平滑：上鬼格随 dwell 爬升；离格/出场时按 chargeSolidReleaseMs 回落。
   */
  let solidT = 0;
  let solidLastMs = 0;
  const stepSolidAlphas = (
    nowMs: number = performance.now(),
  ): { glow: number; beam: number } | null => {
    const target =
      rt.drag?.type === 'light' ? chargeSolidTargetT(rt, nowMs) : 0;

    if (rt.drag?.type !== 'light') {
      solidT = 0;
      solidLastMs = nowMs;
      return null;
    }

    const dtMs =
      solidLastMs > 0 ? Math.min(64, Math.max(0, nowMs - solidLastMs)) : 0;
    solidLastMs = nowMs;

    if (target >= solidT) {
      // 跟上蓄光目标（本身已随停留时间线性爬）
      solidT = target;
    } else {
      // 离格 / 出场：线性回落
      const rel = Math.max(1, VIEW_STYLE.chargeSolidReleaseMs);
      solidT = Math.max(0, solidT - dtMs / rel);
      // 若 target 非 0（极少），勿低于 target
      if (solidT < target) solidT = target;
    }

    if (solidT <= 0.001) {
      solidT = 0;
      return null;
    }
    const lerp = (a: number, b: number) => a + (b - a) * solidT;
    return {
      glow: lerp(VIEW_STYLE.glowAlpha, VIEW_STYLE.glowChargeAlpha),
      beam: lerp(VIEW_STYLE.beamAlpha, VIEW_STYLE.beamChargeAlpha),
    };
  };

  const repaint = () => paint(els, rt, lightFx, stepSolidAlphas());

  /** 全员 Revealed 后等一会再弹拍照 UI（避免「刚出鬼就闪相机」） */
  const CAMERA_ENTER_DELAY_MS = 500;
  let cameraEnterTimer: ReturnType<typeof setTimeout> | null = null;

  const clearCameraEnterTimer = () => {
    if (cameraEnterTimer != null) {
      clearTimeout(cameraEnterTimer);
      cameraEnterTimer = null;
    }
  };

  const enterCameraNow = () => {
    cameraEnterTimer = null;
    if (rt.phase !== SessionPhase.Playing) return;
    if (rt.drag) return;
    if (!allRevealed(rt.ghosts)) return;
    rt.phase = SessionPhase.Camera;
    scanHaptics.end();
    applyPhaseUi();
  };

  /** R21：非拖拽且全员 Revealed → 延迟后进 Camera */
  const maybeEnterCamera = () => {
    if (rt.phase !== SessionPhase.Playing) {
      clearCameraEnterTimer();
      return;
    }
    if (rt.drag || !allRevealed(rt.ghosts)) {
      // 拖动中 / 未全显：取消排队，避免松手时用过期条件
      clearCameraEnterTimer();
      return;
    }
    // 已在排队则不重置，保证固定 0.5s（不被每帧 resolve 反复延后）
    if (cameraEnterTimer != null) return;
    cameraEnterTimer = setTimeout(enterCameraNow, CAMERA_ENTER_DELAY_MS);
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

  // 调试调参（prop/island/settle/haptic）默认不挂载

  resolve(rt, scanHaptics);
  repaint();
  afterResolve();

  const loadLevelAt = (index: number) => {
    levelIndex = Math.max(0, Math.min(LEVEL_CATALOG.length - 1, index));
    clearCameraEnterTimer();
    uiRoot.classList.remove('ghosts-captured-hide');
    loaded = loadLevel(getLevelDef(levelIndex));
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
    placementHaptics.end();
    applyPhaseUi();
    resolve(rt, scanHaptics);
    repaint();
    afterResolve();
  };

  /** 本关重开 */
  const restart = () => {
    loadLevelAt(levelIndex);
  };

  /** 结算按钮：有下一关则进下一关，否则重开本关 */
  const onSettlePrimary = () => {
    if (hasNextLevel(levelIndex)) {
      loadLevelAt(levelIndex + 1);
    } else {
      loadLevelAt(levelIndex);
    }
  };

  const syncReplayLabel = () => {
    camera.setReplayLabel(
      hasNextLevel(levelIndex) ? '下一关' : '再玩一次',
    );
  };

  const onReturnFromCamera = () => {
    if (rt.phase !== SessionPhase.Camera) return;
    uiRoot.classList.remove('ghosts-captured-hide');
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
      // playCapture：闪白 → 截屏 → 吐纸
      await camera.playCapture(async () => {
        const dataUrl = await captureBoardDataUrl(uiRoot);
        // 截屏完成后立刻藏棋盘鬼魂（合影已含鬼；蒙黑下勿再透出）
        uiRoot.classList.add('ghosts-captured-hide');
        return dataUrl;
      });
      rt.ghosts = markAllCaught(rt.ghosts);
      rt.phase = SessionPhase.Won;
      syncReplayLabel();
      applyPhaseUi();
      repaint();
    } catch (err) {
      console.error('[camera] capture failed', err);
      uiRoot.classList.remove('ghosts-captured-hide');
      // 截失败：回 Camera 可重拍，不写 Caught
      rt.phase = SessionPhase.Camera;
      applyPhaseUi();
    }
  };

  camera.onShutter(() => {
    void onShutter();
  });
  camera.onReturn(onReturnFromCamera);
  camera.onReplay(onSettlePrimary);
  syncReplayLabel();

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
      if (d == null || (d.type !== 'light' && d.type !== 'mirror')) {
        placementHaptics.end();
      }
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
      placementHaptics.onDragFrame(rt.drag);
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
        placementHaptics.end();
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
      placementHaptics.end();
      resolve(rt, scanHaptics);
      repaint();
      afterResolve();
    },
    onReturnToTray: (drag) => {
      // 盘上道具拖回托盘视口松手
      if (drag.source === 'board' && drag.fromCell) {
        removeProp(rt.board, drag.fromCell.x, drag.fromCell.y);
        returnToTray(rt.tray, drag.type);
      } else if (drag.source === 'tray') {
        returnToTray(rt.tray, drag.type);
      }
      rt.drag = null;
      scanHaptics.end();
      placementHaptics.end();
      resolve(rt, scanHaptics);
      repaint();
      afterResolve();
    },
    onCancelDrag: (drag) => {
      // 托盘来源取消 → 回托盘；盘上来源取消 → 留在原格（拖起时未真正 remove）
      if (drag.source === 'tray') returnToTray(rt.tray, drag.type);
      rt.drag = null;
      scanHaptics.end();
      placementHaptics.end();
      resolve(rt, scanHaptics);
      repaint();
      afterResolve();
    },
    onRotate: (x, y) => {
      if (rt.phase !== SessionPhase.Playing) return;
      if (rotatePropAt(rt.board, x, y)) {
        placementHaptics.onRotate();
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
      clearCameraEnterTimer();
      stopDwellLoop();
      scanHaptics.end();
      placementHaptics.end();
      detach();
      camera.dispose();
      ghostIdle.stop();
      lightFx.dispose();
      uiRoot.replaceChildren();
      uiRoot.classList.remove('game-ui', 'session-locked');
    },
    restart,
  };
}
