/**
 * Camera chrome + shutter/return + flash + polaroid print + won settlement.
 * Frame: ./camera-frame.png；快门居中、返回偏左。
 */

import {
  applyPrintLayoutCss,
  getPrintGeometry,
  PRINT_LAYOUT,
} from '../printLayout';

export type CameraSessionHandle = {
  root: HTMLElement;
  setPhase: (phase: 'hidden' | 'camera' | 'capturing' | 'won') => void;
  /** 调参预览：只显示假灵动岛 */
  setIslandPreview: (on: boolean) => void;
  /** 挑战结算调参预览：蒙黑 + 终点相纸 + 文案/按钮 */
  setSettlePreview: (on: boolean) => void;
  /** 已在结算/预览时：仅按 PRINT_LAYOUT 重钉终点布局 */
  refreshSettleLayout: () => void;
  /**
   * 拍照仪式：先立刻闪白+蒙黑（无空白卡顿），再执行 capture() 取图，最后吐纸。
   */
  playCapture: (capture: () => Promise<string>) => Promise<void>;
  setPolaroidImage: (dataUrl: string) => void;
  onShutter: (cb: () => void) => void;
  onReturn: (cb: () => void) => void;
  onReplay: (cb: () => void) => void;
  dispose: () => void;
};

function prefersReducedMotion(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function waitAnim(el: HTMLElement, name?: string, fallbackMs = 2200): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener('animationend', onEnd);
      resolve();
    };
    const onEnd = (e: AnimationEvent) => {
      if (name && e.animationName !== name) return;
      done();
    };
    el.addEventListener('animationend', onEnd);
    setTimeout(done, fallbackMs);
  });
}

function waitImg(img: HTMLImageElement, dataUrl: string): Promise<void> {
  return new Promise((resolve) => {
    if (img.src === dataUrl && img.complete && img.naturalWidth > 0) {
      resolve();
      return;
    }
    const done = () => {
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
      resolve();
    };
    img.addEventListener('load', done);
    img.addEventListener('error', done);
    img.src = dataUrl;
    if (img.complete && img.naturalWidth > 0) done();
  });
}

export function mountCameraSession(uiRoot: HTMLElement): CameraSessionHandle {
  applyPrintLayoutCss(uiRoot);

  const root = document.createElement('div');
  root.className = 'camera-session';
  root.dataset.captureIgnore = '1';
  root.setAttribute('aria-hidden', 'true');

  // —— Camera chrome ——
  const chrome = document.createElement('div');
  chrome.className = 'camera-chrome';
  chrome.dataset.captureIgnore = '1';

  const frame = document.createElement('div');
  frame.className = 'camera-frame';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.backgroundImage = "url('./camera-frame.png')";

  const controls = document.createElement('div');
  controls.className = 'camera-controls';
  controls.dataset.captureIgnore = '1';

  const returnBtn = document.createElement('button');
  returnBtn.type = 'button';
  returnBtn.className = 'camera-btn camera-btn-return';
  returnBtn.setAttribute('aria-label', '返回改布局');
  returnBtn.title = '返回';
  returnBtn.innerHTML =
    '<span class="camera-btn-return-icon" aria-hidden="true"></span>';

  const shutterBtn = document.createElement('button');
  shutterBtn.type = 'button';
  shutterBtn.className = 'camera-btn camera-btn-shutter';
  shutterBtn.setAttribute('aria-label', '拍照');
  shutterBtn.innerHTML = '<span class="camera-shutter-ring" aria-hidden="true"></span>';

  controls.append(shutterBtn, returnBtn);
  // 按钮不放进 chrome，避免跟取景框一起缩放
  chrome.append(frame);

  // —— Flash ——
  const flash = document.createElement('div');
  flash.className = 'camera-flash';
  flash.dataset.captureIgnore = '1';
  flash.setAttribute('aria-hidden', 'true');

  // —— Print: mask + island + flying polaroid ——
  const printLayer = document.createElement('div');
  printLayer.className = 'print-layer';
  printLayer.dataset.captureIgnore = '1';
  printLayer.setAttribute('aria-hidden', 'true');

  const printMask = document.createElement('div');
  printMask.className = 'print-mask';

  // 岛上下半 + 裁切窗（overflow 遮住上方）+ 相纸
  // z: bot(2) < clip/polaroid(3) < top(4)
  const islandBot = document.createElement('div');
  islandBot.className = 'print-island-bot';
  islandBot.setAttribute('aria-hidden', 'true');
  const islandTop = document.createElement('div');
  islandTop.className = 'print-island-top';
  islandTop.setAttribute('aria-hidden', 'true');

  /** 出岛裁切：缝线以下才可见，上方被 mask 掉 */
  const ejectClip = document.createElement('div');
  ejectClip.className = 'print-eject-clip';
  ejectClip.setAttribute('aria-hidden', 'true');

  const polaroid = document.createElement('div');
  polaroid.className = 'polaroid polaroid-fly';
  const polaroidImg = document.createElement('img');
  polaroidImg.className = 'polaroid-photo';
  polaroidImg.alt = '合影';
  polaroidImg.draggable = false;
  polaroid.append(polaroidImg);

  // 相纸在 Mask 内；打印与结算共用 printLayer（一张相纸 + 终点后出按钮）
  ejectClip.append(polaroid);

  const settleUi = document.createElement('div');
  settleUi.className = 'print-settle';
  settleUi.dataset.captureIgnore = '1';
  settleUi.setAttribute('aria-hidden', 'true');

  const wonTitle = document.createElement('p');
  wonTitle.className = 'won-title';
  wonTitle.textContent = '抓到了！';

  const replayBtn = document.createElement('button');
  replayBtn.type = 'button';
  replayBtn.className = 'won-replay-btn';
  replayBtn.textContent = '再玩一次';

  settleUi.append(wonTitle, replayBtn);
  printLayer.append(printMask, islandBot, ejectClip, islandTop, settleUi);

  // controls 与 chrome 同级：缩放只作用在取景框上
  root.append(chrome, controls, flash, printLayer);
  uiRoot.append(root);

  /** 与 CSS camera-ui-enter 时长一致 */
  const CAMERA_ENTER_MS = 900;
  let controlsRevealTimer = 0;

  let shutterCb: (() => void) | null = null;
  let returnCb: (() => void) | null = null;
  let replayCb: (() => void) | null = null;
  let islandPreview = false;

  const hideControls = () => {
    if (controlsRevealTimer) {
      clearTimeout(controlsRevealTimer);
      controlsRevealTimer = 0;
    }
    controls.classList.remove('is-revealed');
  };

  const revealControlsAfterEnter = () => {
    hideControls();
    const reduced =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      controls.classList.add('is-revealed');
      return;
    }
    controlsRevealTimer = window.setTimeout(() => {
      controls.classList.add('is-revealed');
      controlsRevealTimer = 0;
    }, CAMERA_ENTER_MS);
  };

  const onShutterClick = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    shutterCb?.();
  };
  const onReturnClick = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    returnCb?.();
  };
  const onReplayClick = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    replayCb?.();
  };

  shutterBtn.addEventListener('click', onShutterClick);
  returnBtn.addEventListener('click', onReturnClick);
  replayBtn.addEventListener('click', onReplayClick);
  root.addEventListener('pointerdown', (e) => {
    if (
      root.classList.contains('is-camera') ||
      root.classList.contains('is-capturing') ||
      root.classList.contains('is-won')
    ) {
      e.stopPropagation();
    }
  });

  const setPolaroidImage = (dataUrl: string) => {
    polaroidImg.src = dataUrl;
  };

  const hideSettleUi = () => {
    settleUi.classList.remove('is-visible');
    settleUi.setAttribute('aria-hidden', 'true');
  };

  const showSettleUi = () => {
    settleUi.classList.add('is-visible');
    settleUi.setAttribute('aria-hidden', 'false');
  };

  /** 结算：相纸停在终点（中心定位 + 可调旋转） */
  const pinPolaroidAtFinal = () => {
    applyPrintLayoutCss(uiRoot);
    const g = getPrintGeometry();
    const rot = PRINT_LAYOUT.finalRotateDeg;
    cancelPolaroidAnimations();
    polaroid.classList.remove('is-slide-out', 'is-fly-final');
    if (polaroid.parentElement !== printLayer) {
      printLayer.insertBefore(polaroid, settleUi);
    }
    polaroid.style.left = `${g.finalCX}px`;
    polaroid.style.top = `${g.finalTop}px`;
    polaroid.style.width = `${PRINT_LAYOUT.polaroidMaxWidth}px`;
    polaroid.style.transformOrigin = '50% 50%';
    polaroid.style.transform = `translate(-50%, -50%) scale(1) rotate(${rot}deg)`;
    polaroid.style.opacity = '1';
    polaroid.style.zIndex = '5';
    polaroid.style.animation = 'none';
  };

  /**
   * true = 当前 is-won 由调参预览假造（非正式结算）。
   * 关闭预览时必须拆掉 is-won，避免关面板后蒙黑残留。
   */
  let settlePreviewOnly = false;

  /** 正式结算或预览中：按 PRINT_LAYOUT 重钉终点相纸 / 文案位置 */
  const refreshSettleLayout = () => {
    applyPrintLayoutCss(uiRoot);
    if (root.classList.contains('is-won') || settlePreviewOnly) {
      pinPolaroidAtFinal();
    }
  };

  const setSettlePreview = (on: boolean) => {
    if (on) {
      applyPrintLayoutCss(uiRoot);
      // 拍照过程中只写 CSS，不打断流程
      if (root.classList.contains('is-camera') || root.classList.contains('is-capturing')) {
        return;
      }
      // 正式结算：只刷新布局，不标记为预览
      if (root.classList.contains('is-won') && !settlePreviewOnly) {
        pinPolaroidAtFinal();
        return;
      }
      // 玩法中打开调参：假造结算层做预览
      settlePreviewOnly = true;
      root.classList.add('is-printing', 'is-won', 'is-settle-preview');
      root.setAttribute('aria-hidden', 'false');
      if (!polaroidImg.getAttribute('src')) {
        polaroidImg.alt = '预览';
      }
      pinPolaroidAtFinal();
      showSettleUi();
    } else if (settlePreviewOnly) {
      settlePreviewOnly = false;
      root.classList.remove('is-settle-preview', 'is-printing', 'is-won');
      hideSettleUi();
      resetPolaroidForPrint();
      if (
        !root.classList.contains('is-camera') &&
        !root.classList.contains('is-capturing')
      ) {
        root.setAttribute('aria-hidden', 'true');
      }
    } else if (root.classList.contains('is-won')) {
      // 正式结算中关面板：保持结算，只刷新
      pinPolaroidAtFinal();
      showSettleUi();
    }
  };

  const setIslandPreview = (on: boolean) => {
    islandPreview = on;
    root.classList.toggle('is-island-preview', on);
    if (on) {
      root.setAttribute('aria-hidden', 'false');
      // 确保会话层可见（CSS 靠 is-island-preview）
      applyPrintLayoutCss(uiRoot);
    } else if (
      !root.classList.contains('is-camera') &&
      !root.classList.contains('is-capturing') &&
      !root.classList.contains('is-won')
    ) {
      root.setAttribute('aria-hidden', 'true');
    }
  };

  const clearPolaroidInline = () => {
    polaroid.style.left = '';
    polaroid.style.top = '';
    polaroid.style.width = '';
    polaroid.style.transform = '';
    polaroid.style.opacity = '';
    polaroid.style.animation = '';
    polaroid.style.willChange = '';
    polaroid.style.transformOrigin = '';
    polaroid.style.zIndex = '';
  };

  /** 取消 WAAPI / CSS 动画残留（再玩一次后 fill:forwards 会弄坏第二次吐纸） */
  const cancelPolaroidAnimations = () => {
    try {
      polaroid.getAnimations().forEach((a) => a.cancel());
    } catch {
      /* */
    }
  };

  /** 完整复位相纸到 Mask 内初始态，可再次 is-slide-out */
  const resetPolaroidForPrint = () => {
    cancelPolaroidAnimations();
    polaroid.classList.remove('is-slide-out', 'is-fly-final');
    clearPolaroidInline();
    // 清掉 animation:none 等，允许 CSS 动画再次触发
    polaroid.style.removeProperty('animation');
    if (polaroid.parentElement !== ejectClip) {
      ejectClip.append(polaroid);
    }
    // 强制 reflow，保证第二次加 class 会重播关键帧
    void polaroid.offsetWidth;
  };

  const setPhase = (phase: 'hidden' | 'camera' | 'capturing' | 'won') => {
    // 正式阶段接管时清掉调参假结算标记
    settlePreviewOnly = false;
    root.classList.remove(
      'is-camera',
      'is-capturing',
      'is-won',
      'is-printing',
      'is-capture-busy',
      'is-settle-preview',
    );
    flash.classList.remove('is-flash', 'is-flash-hold', 'is-flash-out');
    hideSettleUi();
    // keep island preview if active and going hidden
    if (phase === 'hidden' && islandPreview) {
      root.classList.add('is-island-preview');
      root.setAttribute('aria-hidden', 'false');
    } else {
      root.setAttribute('aria-hidden', phase === 'hidden' ? 'true' : 'false');
    }
    shutterBtn.disabled = phase !== 'camera';
    returnBtn.disabled = phase !== 'camera';
    hideControls();

    if (phase === 'won') {
      // 与打印同一界面：保留 print-layer + 蒙黑 + 终点相纸，只出结算 UI
      root.classList.add('is-printing', 'is-won');
      pinPolaroidAtFinal();
      showSettleUi();
      applyPrintLayoutCss(uiRoot);
      return;
    }

    // 非结算：相纸回 Mask 初始态
    resetPolaroidForPrint();
    if (phase === 'camera') {
      root.classList.add('is-camera');
      revealControlsAfterEnter();
    }
    if (phase === 'capturing') root.classList.add('is-capturing');
    applyPrintLayoutCss(uiRoot);
  };

  /**
   * 阶段2：FLIP 接住阶段1 画面中心，全程 transform-origin: 50% 50%，
   * 避免终点时 origin 从顶心切到中心造成跳变。
   */
  const flyPolaroidToFinal = async (): Promise<void> => {
    applyPrintLayoutCss(uiRoot);
    const g = getPrintGeometry();
    const s = g.phase1Scale;
    const finalCX = g.finalCX;
    const finalTop = g.finalTop;
    const rot = PRINT_LAYOUT.finalRotateDeg;

    // 阶段1 结束时的视觉中心（设计坐标）
    const first = polaroid.getBoundingClientRect();
    const uiRect = uiRoot.getBoundingClientRect();
    const k = uiRect.width / 390 || 1;
    const startCX = (first.left + first.width / 2 - uiRect.left) / k;
    const startCY = (first.top + first.height / 2 - uiRect.top) / k;

    cancelPolaroidAnimations();
    polaroid.classList.remove('is-slide-out', 'is-fly-final');
    polaroid.style.animation = 'none';

    // 挂出 Mask；中心定位，origin 固定中心
    printLayer.insertBefore(polaroid, islandTop);
    polaroid.style.left = `${startCX}px`;
    polaroid.style.top = `${startCY}px`;
    polaroid.style.width = `${PRINT_LAYOUT.polaroidMaxWidth}px`;
    polaroid.style.transformOrigin = '50% 50%';
    polaroid.style.transform = `translate(-50%, -50%) scale(${s}) rotate(0deg)`;
    polaroid.style.opacity = '1';
    polaroid.style.zIndex = '5';
    polaroid.style.willChange = 'transform, left, top';

    await new Promise<void>((r) => {
      requestAnimationFrame(() => requestAnimationFrame(() => r()));
    });

    const endTransform = `translate(-50%, -50%) scale(1) rotate(${rot}deg)`;
    const anim = polaroid.animate(
      [
        {
          left: `${startCX}px`,
          top: `${startCY}px`,
          transform: `translate(-50%, -50%) scale(${s}) rotate(0deg)`,
        },
        {
          left: `${finalCX}px`,
          top: `${finalTop}px`,
          transform: endTransform,
        },
      ],
      {
        duration: PRINT_LAYOUT.flyMs,
        easing: 'cubic-bezier(0.22, 0.82, 0.28, 1)',
        fill: 'forwards',
      },
    );
    try {
      await anim.finished;
    } catch {
      /* aborted */
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (anim as any).commitStyles?.();
    } catch {
      /* */
    }
    try {
      anim.cancel();
    } catch {
      /* */
    }

    polaroid.style.left = `${finalCX}px`;
    polaroid.style.top = `${finalTop}px`;
    polaroid.style.transform = endTransform;
    polaroid.style.transformOrigin = '50% 50%';
    polaroid.style.willChange = '';
    polaroid.style.zIndex = '5';
  };

  const playCapture = async (capture: () => Promise<string>) => {
    applyPrintLayoutCss(uiRoot);
    resetPolaroidForPrint();
    hideSettleUi();

    const reduced = prefersReducedMotion();
    const { slideOutMs } = PRINT_LAYOUT;

    // —— 闪白 + 蒙黑垫底 + 藏相机 UI；白屏期间后台截屏 ——
    // 时序：渐入 ~200ms → 至少再 hold 一段 → 淡出 ~300ms
    // is-capturing 时 print-mask 已在 flash 下，淡出不断档
    const flashInMs = reduced ? 40 : 200;
    const flashHoldMinMs = reduced ? 40 : 320;
    const flashOutMs = reduced ? 100 : 300;

    setPhase('capturing');
    resetPolaroidForPrint();
    hideControls();
    root.classList.remove('is-printing', 'is-capture-busy', 'is-won');
    // capturing：CSS 藏 chrome + 显示蒙黑；再强制一帧
    flash.classList.remove('is-flash', 'is-flash-hold', 'is-flash-out');
    void flash.offsetWidth;
    flash.classList.add('is-flash-hold');
    void root.offsetWidth;

    // 渐入与截屏并行：先等渐入完成再保证最短白屏
    const holdStarted = performance.now();
    const capturePromise = (async () => {
      // 略等几帧再截，避开未完全白时的闪
      await wait(flashInMs);
      return capture();
    })();

    let dataUrl: string;
    try {
      dataUrl = await capturePromise;
    } catch (e) {
      console.error('[camera] capture threw', e);
      flash.classList.remove('is-flash', 'is-flash-hold', 'is-flash-out');
      throw e;
    }

    await waitImg(polaroidImg, dataUrl);

    // 最短白屏：截完若还不够 hold，继续撑满
    const held = performance.now() - holdStarted;
    if (held < flashInMs + flashHoldMinMs) {
      await wait(flashInMs + flashHoldMinMs - held);
    }

    // 闪白淡出
    flash.classList.remove('is-flash-hold');
    flash.classList.add('is-flash-out');
    await wait(flashOutMs);
    flash.classList.remove('is-flash-out');

    if (reduced) {
      root.classList.remove('is-capturing');
      root.classList.add('is-printing', 'is-won');
      pinPolaroidAtFinal();
      showSettleUi();
      return;
    }

    // 吐纸（同一 print 层；蒙黑已在，只揭岛/相纸）
    resetPolaroidForPrint();
    root.classList.remove('is-capturing');
    root.classList.add('is-printing');
    void polaroid.offsetWidth;
    polaroid.classList.add('is-slide-out');
    await waitAnim(polaroid, 'polaroid-slide-out', slideOutMs + 120);

    await flyPolaroidToFinal();
    // 同一界面结算：不切 won-layer，只出按钮
    root.classList.add('is-won');
    showSettleUi();
  };

  return {
    root,
    setPhase,
    setIslandPreview,
    setSettlePreview,
    refreshSettleLayout,
    playCapture,
    setPolaroidImage,
    onShutter: (cb) => {
      shutterCb = cb;
    },
    onReturn: (cb) => {
      returnCb = cb;
    },
    onReplay: (cb) => {
      replayCb = cb;
    },
    dispose: () => {
      hideControls();
      shutterBtn.removeEventListener('click', onShutterClick);
      returnBtn.removeEventListener('click', onReturnClick);
      replayBtn.removeEventListener('click', onReplayClick);
      root.remove();
    },
  };
}
