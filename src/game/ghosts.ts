/** Ghost state machine (OPTICS_SPEC R07). Pure functions. */

import { cellKey, GhostState, type Ghost } from './types';

/**
 * Advance all ghosts after a lit recompute.
 * Caught is sticky until restart / photo flow writes it.
 */
export function stepGhosts(ghosts: Ghost[], lit: Set<string>): Ghost[] {
  return ghosts.map((g) => stepGhost(g, lit));
}

export function stepGhost(g: Ghost, lit: Set<string>): Ghost {
  if (g.state === GhostState.Caught) return g;

  const isLit = lit.has(cellKey(g.x, g.y));
  if (isLit) {
    return {
      ...g,
      everLit: true,
      state: GhostState.Revealed,
    };
  }
  if (g.everLit) {
    return { ...g, state: GhostState.Transparent };
  }
  return { ...g, state: GhostState.Hidden };
}

export function allRevealed(ghosts: Ghost[]): boolean {
  return ghosts.length > 0 && ghosts.every((g) => g.state === GhostState.Revealed);
}

export function resetGhosts(ghosts: Array<{ id: string; x: number; y: number }>): Ghost[] {
  return ghosts.map((g) => ({
    id: g.id,
    x: g.x,
    y: g.y,
    state: GhostState.Hidden,
    everLit: false,
  }));
}
