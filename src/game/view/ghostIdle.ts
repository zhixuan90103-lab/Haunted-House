/**
 * 鬼魂待机：上下飘 + 轻挤压拉伸（体积近似守恒）
 * 参考《动画师生存手册》/ 迪士尼：slow in-out（sin）+ squash & stretch
 *
 * 不重建 DOM：每帧扫描 .ghost-sprite 写 CSS 变量。
 * 入场后半段 smoothstep 混入待机，避免出场结束瞬间「硬切」待机。
 */

import { VIEW_STYLE } from '../viewStyle';
import { GHOST_APPEAR_MS } from './domBoard';

export type GhostIdleHandle = {
  stop: () => void;
};

/** 入场进度 → 待机混合系数 0..1（后半段才开始浮） */
function idleMixFromAppear(now: number, appearT0: number | undefined): number {
  if (appearT0 == null) return 1;
  const t = (now - appearT0) / GHOST_APPEAR_MS;
  if (t <= 0.5) return 0;
  if (t >= 1) return 1;
  const u = (t - 0.5) / 0.5;
  // smoothstep：后半段柔和接上
  return u * u * (3 - 2 * u);
}

/**
 * 在 root 子树内驱动所有可见鬼的待机 pose
 */
export function startGhostIdleLoop(root: HTMLElement): GhostIdleHandle {
  let rafId = 0;
  const t0 = performance.now();

  const tick = (now: number) => {
    const elapsed = (now - t0) / 1000;
    const amp = Math.max(0, VIEW_STYLE.ghostIdleAmp);
    const periodSec = Math.max(0.3, VIEW_STYLE.ghostIdlePeriodMs / 1000);
    const k = Math.max(0, Math.min(0.2, VIEW_STYLE.ghostIdleSquash));

    // sin 相位：顶 +1，底 -1；本身带 slow in/out
    const phase = (elapsed / periodSec) * Math.PI * 2;
    const s = Math.sin(phase);
    const bobY = s * amp;

    // 上升拉伸、谷底挤压：sx * sy ≈ 1
    const sx = 1 + k * -s;
    const sy = sx !== 0 ? 1 / sx : 1;

    root.querySelectorAll<HTMLElement>('.ghost-sprite').forEach((el) => {
      const appearT0Raw = el.dataset.appearT0;
      const appearT0 = appearT0Raw != null ? Number(appearT0Raw) : undefined;
      const mix = idleMixFromAppear(now, Number.isFinite(appearT0) ? appearT0 : undefined);

      el.style.setProperty('--ghost-bob-y', `${bobY * mix}px`);
      el.style.setProperty('--ghost-sx', String(1 + (sx - 1) * mix));
      el.style.setProperty('--ghost-sy', String(1 + (sy - 1) * mix));
    });

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return {
    stop: () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    },
  };
}
