/**
 * 关卡目录：顺序即推关顺序。
 * 结算有下一关 →「下一关」；最后一关 →「再玩一次」（重开本关）。
 */

import type { LevelDef } from '../types';
import level001 from './level_001.json';
import level002 from './level_002.json';
import level003 from './level_003.json';

export const LEVEL_CATALOG: LevelDef[] = [
  level001 as LevelDef,
  level002 as LevelDef,
  level003 as LevelDef,
];

export function levelCount(): number {
  return LEVEL_CATALOG.length;
}

export function getLevelDef(index: number): LevelDef {
  const i = ((index % LEVEL_CATALOG.length) + LEVEL_CATALOG.length) % LEVEL_CATALOG.length;
  return LEVEL_CATALOG[i]!;
}

export function hasNextLevel(index: number): boolean {
  return index >= 0 && index < LEVEL_CATALOG.length - 1;
}
