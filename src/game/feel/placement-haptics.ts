/**
 * 放置类瞬态震动：手电/镜子「可落格」投影换格、点旋。
 *
 * 手电：仅 drag.cell 有值时（找全鬼后允许落格）才震；
 * 扫描期 cell 必须为 null（依赖 input 同步时传入 canCommitDrop）。
 */

import type { DragGhost } from '../types';
import { cellKey } from '../types';
import { SCAN_HAPTIC } from './haptic-config';
import {
  playLightProjPattern,
  playMirrorProjPattern,
  playRotatePattern,
} from './haptic-patterns';

export type PlacementHapticsHandle = {
  /** 拖拽每帧：light/mirror 吸附投影格变化时轻震 */
  onDragFrame: (drag: DragGhost | null) => void;
  /** 点击旋转成功 */
  onRotate: () => void;
  /** 松手 / 取消 / 会话结束 */
  end: () => void;
};

export function createPlacementHaptics(): PlacementHapticsHandle {
  let lastKey: string | null = null;
  let lastType: 'light' | 'mirror' | null = null;
  let lastFireAt = 0;

  const end = () => {
    lastKey = null;
    lastType = null;
  };

  return {
    end,

    onRotate: () => {
      playRotatePattern();
    },

    onDragFrame: (drag) => {
      if (!drag || (drag.type !== 'light' && drag.type !== 'mirror')) {
        end();
        return;
      }

      const type = drag.type;
      if (type !== lastType) {
        lastType = type;
        lastKey = null;
      }

      // 手电扫描：不允许落格时 cell 应为 null，不触发投影换格
      const key = drag.cell ? cellKey(drag.cell.x, drag.cell.y) : null;
      if (key === lastKey) return;

      lastKey = key;
      if (key == null) return;

      const now = performance.now();
      const cd =
        type === 'light'
          ? SCAN_HAPTIC.lightProjCooldownMs
          : SCAN_HAPTIC.mirrorProjCooldownMs;
      if (now - lastFireAt < cd) return;
      lastFireAt = now;

      if (type === 'light') playLightProjPattern();
      else playMirrorProjPattern();
    },
  };
}
