/** Load LevelDef → board + ghosts + tray. */

import {
  createBoard,
  placeProp,
  resetPropIdSeq,
  set,
  type Board,
} from './board';
import { resetGhosts } from './ghosts';
import type { Ghost, LevelDef, TrayItem } from './types';

export type LoadedLevel = {
  def: LevelDef;
  board: Board;
  ghosts: Ghost[];
  tray: TrayItem[];
};

export function validateLevel(def: LevelDef): void {
  const { width, height } = def.board;
  const wallKeys = new Set(def.walls.map((w) => `${w.x},${w.y}`));
  const seen = new Set<string>();

  for (const g of def.ghosts) {
    if (g.x < 0 || g.y < 0 || g.x >= width || g.y >= height) {
      throw new Error(`ghost ${g.id} out of bounds`);
    }
    if (wallKeys.has(`${g.x},${g.y}`)) {
      throw new Error(`ghost ${g.id} on wall`);
    }
    const k = `${g.x},${g.y}`;
    if (seen.has(k)) throw new Error(`overlapping ghost at ${k}`);
    seen.add(k);
  }

  for (const t of def.tray) {
    if (t.count < 0) throw new Error(`tray count < 0 for ${t.type}`);
  }

  const ghostKeys = new Set(def.ghosts.map((g) => `${g.x},${g.y}`));

  for (const p of def.lockedProps ?? []) {
    if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) {
      throw new Error(`lockedProp out of bounds`);
    }
    if (wallKeys.has(`${p.x},${p.y}`)) {
      throw new Error(`lockedProp on wall`);
    }
    if (ghostKeys.has(`${p.x},${p.y}`)) {
      throw new Error(`lockedProp on ghost cell`);
    }
  }
}

export function loadLevel(def: LevelDef): LoadedLevel {
  validateLevel(def);
  resetPropIdSeq(0);

  const board = createBoard(def.board.width, def.board.height);

  for (const w of def.walls) {
    set(board, w.x, w.y, { kind: 'wall' });
  }

  for (const g of def.ghosts) {
    set(board, g.x, g.y, { kind: 'ghost', id: g.id });
  }

  for (const p of def.lockedProps ?? []) {
    const id = placeProp(board, p.x, p.y, p.type, p.facing, {
      locked: true,
      id: `locked_${p.type}_${p.x}_${p.y}`,
    });
    if (!id) throw new Error(`failed to place lockedProp at ${p.x},${p.y}`);
  }

  const ghosts = resetGhosts(def.ghosts);
  const tray = def.tray.map((t) => ({ ...t }));

  return { def, board, ghosts, tray };
}

export function trayCount(tray: TrayItem[], type: string): number {
  return tray.find((t) => t.type === type)?.count ?? 0;
}

export function takeFromTray(tray: TrayItem[], type: string): boolean {
  const item = tray.find((t) => t.type === type);
  if (!item || item.count <= 0) return false;
  item.count -= 1;
  return true;
}

export function returnToTray(tray: TrayItem[], type: string): void {
  const item = tray.find((t) => t.type === type);
  if (item) item.count += 1;
  else tray.push({ type: type as TrayItem['type'], count: 1 });
}
