/**
 * Grid light propagation (OPTICS_SPEC R01+).
 * Supports maxSteps for scan-mode (handheld light = 1 cell ahead).
 */

import {
  cellKey,
  DELTA,
  Dir,
  type DirValue,
  type LightPose,
  type Occupant,
  type PropType,
} from './types';

export type Ray = {
  x: number;
  y: number;
  dir: Dir;
  /** remaining steps that may still light a cell; Infinity if unlimited */
  stepsLeft: number;
};

export type OpticsInput = {
  width: number;
  height: number;
  get: (x: number, y: number) => Occupant;
  lights: LightPose[];
};

export type OpticsOutput = {
  lit: Set<string>;
};

/**
 * 基础镜 facing 0..3：单面反射，背面挡光。
 *
 * 标定（用户 2026-08，本地标号随贴图转）：
 *   1=镜上 2=镜右 3=镜下 4=镜左
 *   正面 = 3、4；背面 = 1、2
 *   从 3 进 → 折向 4；从 4 进 → 折向 3
 *
 * facing=0 时本地=世界：1N 2E 3S 4W
 *   → 从南侧进(光行进 N) → 出射 W；从西侧进(光行进 E) → 出射 S
 * facing +1 顺时针：整表方向 +90°（与贴图 rotate 一致）
 *
 * inDir = 光行进方向；不在表内 = 背面 block。
 */
export const MIRROR_REFLECT: Record<DirValue, Partial<Record<Dir, Dir>>> = {
  // f0：3↔4 → N→W、E→S
  0: { [Dir.N]: Dir.W, [Dir.E]: Dir.S },
  // f1：本地转 90°CW → E→N、S→W
  1: { [Dir.E]: Dir.N, [Dir.S]: Dir.W },
  // f2 → S→E、W→N
  2: { [Dir.S]: Dir.E, [Dir.W]: Dir.N },
  // f3 → W→S、N→E
  3: { [Dir.W]: Dir.S, [Dir.N]: Dir.E },
};

function inBounds(x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

/** 正面 → 出射方向；背面 → block */
function mirrorOut(facing: DirValue, inDir: Dir): Dir | 'block' {
  return MIRROR_REFLECT[facing][inDir] ?? 'block';
}

function handleProp(
  type: PropType,
  facing: DirValue,
  nx: number,
  ny: number,
  inDir: Dir,
  lit: Set<string>,
  queue: Ray[],
  get: (x: number, y: number) => Occupant,
  width: number,
  height: number,
  stepsLeft: number,
): void {
  // After entering a prop cell we "spent" a step conceptually for path length;
  // mirrors redirect without lighting; further travel uses remaining steps.
  const nextSteps = stepsLeft === Infinity ? Infinity : Math.max(0, stepsLeft - 1);

  switch (type) {
    case 'mirror': {
      const out = mirrorOut(facing, inDir);
      if (out === 'block') return;
      if (nextSteps <= 0 && nextSteps !== Infinity) return;
      queue.push({ x: nx, y: ny, dir: out, stepsLeft: nextSteps });
      return;
    }
    case 'beam_splitter': {
      const out = mirrorOut(facing, inDir);
      if (out === 'block') return;
      if (nextSteps <= 0 && nextSteps !== Infinity) return;
      queue.push({ x: nx, y: ny, dir: out, stepsLeft: nextSteps });
      queue.push({ x: nx, y: ny, dir: inDir, stepsLeft: nextSteps });
      return;
    }
    case 'diffuser': {
      // Diffuser: 8-neigh lit; ignores maxSteps (activated when entered)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const cx = nx + dx;
          const cy = ny + dy;
          if (!inBounds(cx, cy, width, height)) continue;
          const o = get(cx, cy);
          if (o === null || o.kind === 'ghost') {
            lit.add(cellKey(cx, cy));
          }
        }
      }
      return;
    }
    case 'light':
    default:
      return;
  }
}

/**
 * Compute lit cells. Light origin cells are never lit.
 * Empty + ghost on path light; walls stop without lighting.
 * LightPose.maxSteps limits how many path cells a beam may light (scan = 1).
 */
export function computeLit(input: OpticsInput): OpticsOutput {
  const { width, height, get, lights } = input;
  const lit = new Set<string>();
  const queue: Ray[] = [];
  const visited = new Set<string>();

  for (const L of lights) {
    const steps =
      L.maxSteps != null && L.maxSteps > 0 ? L.maxSteps : Infinity;
    queue.push({ x: L.x, y: L.y, dir: L.dir, stepsLeft: steps });
  }

  while (queue.length > 0) {
    const ray = queue.shift()!;
    if (ray.stepsLeft <= 0) continue;

    const edgeKey = `${ray.x},${ray.y},${ray.dir},${ray.stepsLeft === Infinity ? '∞' : ray.stepsLeft}`;
    // visited without steps can loop; with finite steps include stepsLeft
    const visitKey =
      ray.stepsLeft === Infinity
        ? `${ray.x},${ray.y},${ray.dir}`
        : edgeKey;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);

    const { dx, dy } = DELTA[ray.dir];
    const nx = ray.x + dx;
    const ny = ray.y + dy;

    if (!inBounds(nx, ny, width, height)) continue;

    const occ = get(nx, ny);
    const stepsAfter = ray.stepsLeft === Infinity ? Infinity : ray.stepsLeft - 1;

    if (occ === null) {
      lit.add(cellKey(nx, ny));
      if (stepsAfter > 0) {
        queue.push({ x: nx, y: ny, dir: ray.dir, stepsLeft: stepsAfter });
      }
      continue;
    }

    if (occ.kind === 'wall') {
      continue;
    }

    if (occ.kind === 'ghost') {
      lit.add(cellKey(nx, ny));
      if (stepsAfter > 0) {
        queue.push({ x: nx, y: ny, dir: ray.dir, stepsLeft: stepsAfter });
      }
      continue;
    }

    if (occ.kind === 'prop') {
      handleProp(
        occ.type,
        occ.facing,
        nx,
        ny,
        ray.dir,
        lit,
        queue,
        get,
        width,
        height,
        ray.stepsLeft,
      );
      continue;
    }
  }

  return { lit };
}

/**
 * 直线光路（无镜）：从光源格沿 dir 前进，
 * 空/鬼格点亮并继续，墙/道具停止，出界停止。
 */
export type StraightBeamPath = {
  litCells: Array<{ x: number; y: number }>;
  end: { x: number; y: number } | null;
};

export function castStraightLightPath(
  width: number,
  height: number,
  get: (x: number, y: number) => Occupant,
  x: number,
  y: number,
  dir: Dir,
): StraightBeamPath {
  const litCells: Array<{ x: number; y: number }> = [];
  const { dx, dy } = DELTA[dir];
  let cx = x;
  let cy = y;
  for (;;) {
    cx += dx;
    cy += dy;
    if (!inBounds(cx, cy, width, height)) break;
    const occ = get(cx, cy);
    if (occ === null || occ.kind === 'ghost') {
      litCells.push({ x: cx, y: cy });
      continue;
    }
    break;
  }
  return {
    litCells,
    end: litCells.length > 0 ? litCells[litCells.length - 1]! : null,
  };
}

/** 折线光一段：格点坐标（灯格/镜格 → 尽头亮格或下一镜格） */
export type BeamSegment = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

/**
 * 放置发射路径（含镜 90° 折）：与 computeLit 镜规则一致。
 * segments 供 beam 折线绘制；end = 最后一段尽头（光斑）。
 */
export type ReflectingBeamPath = {
  litCells: Array<{ x: number; y: number }>;
  segments: BeamSegment[];
  end: { x: number; y: number } | null;
};

export function castReflectingLightPath(
  width: number,
  height: number,
  get: (x: number, y: number) => Occupant,
  startX: number,
  startY: number,
  startDir: Dir,
): ReflectingBeamPath {
  const litCells: Array<{ x: number; y: number }> = [];
  const segments: BeamSegment[] = [];
  const maxBounces = width * height + 4;

  let x = startX;
  let y = startY;
  let dir = startDir;
  let segFromX = startX;
  let segFromY = startY;
  let lastLit: { x: number; y: number } | null = null;

  for (let bounce = 0; bounce < maxBounces; bounce++) {
    const { dx, dy } = DELTA[dir];
    let hitMirror = false;

    for (;;) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny, width, height)) {
        if (lastLit) {
          segments.push({
            fromX: segFromX,
            fromY: segFromY,
            toX: lastLit.x,
            toY: lastLit.y,
          });
        }
        return {
          litCells,
          segments,
          end: lastLit,
        };
      }

      const occ = get(nx, ny);

      if (occ === null || occ.kind === 'ghost') {
        litCells.push({ x: nx, y: ny });
        lastLit = { x: nx, y: ny };
        x = nx;
        y = ny;
        continue;
      }

      if (occ.kind === 'wall') {
        if (lastLit) {
          segments.push({
            fromX: segFromX,
            fromY: segFromY,
            toX: lastLit.x,
            toY: lastLit.y,
          });
        }
        return { litCells, segments, end: lastLit };
      }

      if (occ.kind === 'prop' && occ.type === 'mirror') {
        // 光束打到镜面格心再折；镜格本身不亮
        segments.push({
          fromX: segFromX,
          fromY: segFromY,
          toX: nx,
          toY: ny,
        });
        const out = mirrorOut(occ.facing, dir);
        if (out === 'block') {
          return { litCells, segments, end: lastLit };
        }
        dir = out;
        x = nx;
        y = ny;
        segFromX = nx;
        segFromY = ny;
        lastLit = null;
        hitMirror = true;
        break;
      }

      // 其它道具挡光
      if (lastLit) {
        segments.push({
          fromX: segFromX,
          fromY: segFromY,
          toX: lastLit.x,
          toY: lastLit.y,
        });
      }
      return { litCells, segments, end: lastLit };
    }

    if (!hitMirror) break;
  }

  // 超过 maxBounces 时收尾（防环）；用 litCells 末格避免收窄为 never
  const tail =
    litCells.length > 0 ? litCells[litCells.length - 1]! : null;
  if (tail) {
    segments.push({
      fromX: segFromX,
      fromY: segFromY,
      toX: tail.x,
      toY: tail.y,
    });
  }
  return { litCells, segments, end: tail };
}

/**
 * Collect light poses from board (via get, may include drag overlay).
 * opts.scanLightIds: those light prop ids get maxSteps (handheld scan).
 */
export function collectLightsFromGet(
  width: number,
  height: number,
  get: (x: number, y: number) => Occupant,
  opts?: { scanLightIds?: Set<string>; scanMaxSteps?: number },
): LightPose[] {
  const lights: LightPose[] = [];
  const scanIds = opts?.scanLightIds;
  const scanSteps = opts?.scanMaxSteps ?? SCAN_LIGHT_MAX_STEPS;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const occ = get(x, y);
      if (occ?.kind === 'prop' && occ.type === 'light') {
        const pose: LightPose = { x, y, dir: occ.facing as Dir };
        if (scanIds?.has(occ.id)) {
          pose.maxSteps = scanSteps;
        }
        lights.push(pose);
      }
    }
  }
  return lights;
}

/** 扫描阶段：拿起手电只照前方 1 格（顶视近距探照） */
export const SCAN_LIGHT_MAX_STEPS = 1;
