/** Grid board: occupants, canPlace, place/remove props. */

import type { DirValue, Occupant, PropType } from './types';

export type Board = {
  width: number;
  height: number;
  cells: Occupant[];
};

export function createBoard(width: number, height: number): Board {
  return {
    width,
    height,
    cells: Array.from({ length: width * height }, () => null),
  };
}

export function indexOf(board: Board, x: number, y: number): number {
  return y * board.width + x;
}

export function inBounds(board: Board, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < board.width && y < board.height;
}

export function get(board: Board, x: number, y: number): Occupant {
  if (!inBounds(board, x, y)) return null;
  return board.cells[indexOf(board, x, y)] ?? null;
}

export function set(board: Board, x: number, y: number, occ: Occupant): void {
  if (!inBounds(board, x, y)) return;
  board.cells[indexOf(board, x, y)] = occ;
}

/**
 * Can place a prop at (x,y)?
 * Walls, ghosts, other props block. ignorePropId allows moving self.
 */
export function canPlace(
  board: Board,
  x: number,
  y: number,
  ignorePropId?: string,
): boolean {
  if (!inBounds(board, x, y)) return false;
  const occ = get(board, x, y);
  if (occ === null) return true;
  if (
    ignorePropId &&
    occ.kind === 'prop' &&
    occ.id === ignorePropId
  ) {
    return true;
  }
  return false;
}

let propSeq = 0;

export function nextPropId(prefix = 'p'): string {
  propSeq += 1;
  return `${prefix}${propSeq}`;
}

export function resetPropIdSeq(n = 0): void {
  propSeq = n;
}

export function placeProp(
  board: Board,
  x: number,
  y: number,
  type: PropType,
  facing: DirValue,
  opts?: { id?: string; locked?: boolean },
): string | null {
  const id = opts?.id ?? nextPropId(type);
  if (!canPlace(board, x, y, id)) return null;
  set(board, x, y, {
    kind: 'prop',
    id,
    type,
    facing,
    locked: opts?.locked,
  });
  return id;
}

export function removeProp(board: Board, x: number, y: number): Occupant {
  const occ = get(board, x, y);
  if (occ?.kind !== 'prop') return null;
  set(board, x, y, null);
  return occ;
}

export function findPropCell(
  board: Board,
  propId: string,
): { x: number; y: number } | null {
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const occ = get(board, x, y);
      if (occ?.kind === 'prop' && occ.id === propId) return { x, y };
    }
  }
  return null;
}

export function rotatePropAt(board: Board, x: number, y: number): boolean {
  const occ = get(board, x, y);
  if (occ?.kind !== 'prop' || occ.locked) return false;
  const next = ((occ.facing + 1) % 4) as DirValue;
  set(board, x, y, { ...occ, facing: next });
  return true;
}

export function cloneBoard(board: Board): Board {
  return {
    width: board.width,
    height: board.height,
    cells: board.cells.map((c) => (c ? { ...c } : null)),
  };
}
