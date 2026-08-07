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

export const MIRROR_REFLECT: Record<DirValue, Partial<Record<Dir, Dir>>> = {
  0: { [Dir.N]: Dir.E, [Dir.E]: Dir.N },
  1: { [Dir.E]: Dir.S, [Dir.S]: Dir.E },
  2: { [Dir.S]: Dir.W, [Dir.W]: Dir.S },
  3: { [Dir.W]: Dir.N, [Dir.N]: Dir.W },
};

function inBounds(x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

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
 * 直线光路（放置发射用）：从光源格沿 dir 前进，
 * 空/鬼格点亮并继续，墙/道具停止，出界停止。
 * 返回按序 lit 格；无障碍时一直走到棋盘边界内最远格。
 */
export type StraightBeamPath = {
  litCells: Array<{ x: number; y: number }>;
  /** 最远被照亮格；无则 null（贴脸墙等） */
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
    // wall / prop / 其它：阻挡，不亮该格
    break;
  }
  return {
    litCells,
    end: litCells.length > 0 ? litCells[litCells.length - 1]! : null,
  };
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
