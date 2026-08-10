/**
 * Camera chrome + shutter/return + flash + polaroid print + won settlement.
 * Frame: ./camera-frame.png；快门居中、返回偏左。
 */

import { applyPrintLayoutCss, PRINT_LAYOUT } from '../printLayout';

export type CameraSessionHandle = {
  root: HTMLElement;
  setPhase: (phase: 'hidden' | 'camera' | 'capturing' | 'won') => void;
  /** 调参预览：只显示假灵动岛 */
  setIslandPreview: (on: boolean) => void;
  playCapture: (dataUrl: string) => Promise<void>;
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
  returnBtn.innerHTML =
    '<span class="camera-btn-return-icon" aria-hidden="true"></span><span class="camera-btn-label">返回</span>';

  const shutterBtn = document.createElement('button');
  shutterBtn.type = 'button';
  shutterBtn.className = 'camera-btn camera-btn-shutter';
  shutterBtn.setAttribute('aria-label', '拍照');
  shutterBtn.innerHTML = '<span class="camera-shutter-ring" aria-hidden="true"></span>';

  controls.append(shutterBtn, returnBtn);
  chrome.append(frame, controls);

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

  ejectClip.append(polaroid);
  printLayer.append(printMask, islandBot, ejectClip, islandTop);

  // —— Won ——
  const won = document.createElement('div');
  won.className = 'won-layer';
  won.dataset.captureIgnore = '1';
  won.setAttribute('aria-hidden', 'true');

  const wonPolaroid = document.createElement('div');
  wonPolaroid.className = 'polaroid polaroid-won';
  const wonImg = document.createElement('img');
  wonImg.className = 'polaroid-photo';
  wonImg.alt = '抓到了';
  wonImg.draggable = false;
  wonPolaroid.append(wonImg);

  const wonTitle = document.createElement('p');
  wonTitle.className = 'won-title';
  wonTitle.textContent = '抓到了！';

  const replayBtn = document.createElement('button');
  replayBtn.type = 'button';
  replayBtn.className = 'won-replay-btn';
  replayBtn.textContent = '再玩一次';

  won.append(wonPolaroid, wonTitle, replayBtn);
  root.append(chrome, flash, printLayer, won);
  uiRoot.append(root);

  let shutterCb: (() => void) | null = null;
  let returnCb: (() => void) | null = null;
  let replayCb: (() => void) | null = null;
  let islandPreview = false;

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
    wonImg.src = dataUrl;
  };

  const setIslandPreview = (on: boolean) => {
    islandPreview = on;
    root.classList.toggle('is-island-preview', on);
    if (on) {
      root.setAttribute('aria-hidden', 'false');
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
    polaroid.style.transform = '';
    polaroid.style.opacity = '';
    polaroid.style.animation = '';
    polaroid.style.willChange = '';
    polaroid.style.transformOrigin = '';
    polaroid.style.zIndex = '';
  };

  const setPhase = (phase: 'hidden' | 'camera' | 'capturing' | 'won') => {
    root.classList.remove('is-camera', 'is-capturing', 'is-won', 'is-printing');
    // keep island preview if active and going hidden
    if (phase === 'hidden' && islandPreview) {
      root.classList.add('is-island-preview');
      root.setAttribute('aria-hidden', 'false');
    } else {
      root.setAttribute('aria-hidden', phase === 'hidden' ? 'true' : 'false');
    }
    shutterBtn.disabled = phase !== 'camera';
    returnBtn.disabled = phase !== 'camera';
    polaroid.classList.remove('is-slide-out', 'is-fly-final');
    clearPolaroidInline();
    // 重置相纸挂回裁切窗
    if (polaroid.parentElement !== ejectClip) {
      ejectClip.append(polaroid);
    }
    if (phase === 'camera') root.classList.add('is-camera');
    if (phase === 'capturing') root.classList.add('is-capturing');
    if (phase === 'won') root.classList.add('is-won');
    applyPrintLayoutCss(uiRoot);
  };

  /** 阶段2：FLIP 接住阶段1 画面，WAAPI 缓动飞到终点（避免 reparent 跳变） */
  const flyPolaroidToFinal = async (): Promise<void> => {
    const L = PRINT_LAYOUT;
    const ratio = Math.min(1, Math.max(0.25, L.phase1WidthRatio));
    const s = Math.min(1, (L.islandWidth * ratio) / L.polaroidWidth);

    // 阶段1 结束时的屏幕位置
    const first = polaroid.getBoundingClientRect();
    const uiRect = uiRoot.getBoundingClientRect();
    const k = uiRect.width / 390 || 1;
    const designCX = (first.left + first.width / 2 - uiRect.left) / k;
    const designTop = (first.top - uiRect.top) / k;

    polaroid.classList.remove('is-slide-out');
    polaroid.style.animation = 'none';

    // 挂到 printLayer，立刻用 inline 钉在同一视觉位置
    printLayer.insertBefore(polaroid, islandTop);
    polaroid.style.left = `${designCX}px`;
    polaroid.style.top = `${designTop}px`;
    polaroid.style.transformOrigin = '50% 0%';
    polaroid.style.transform = `translate(-50%, 0) scale(${s}) rotate(0deg)`;
    polaroid.style.opacity = '1';
    polaroid.style.zIndex = '3';
    polaroid.style.willChange = 'transform, left, top';

    const finalTop = (L.finalTopPercent / 100) * 844;
    const finalCX = 195;

    // 双 rAF 确保 reparent 后首帧已绘制，再开动画
    await new Promise<void>((r) => {
      requestAnimationFrame(() => requestAnimationFrame(() => r()));
    });

    const anim = polaroid.animate(
      [
        {
          left: `${designCX}px`,
          top: `${designTop}px`,
          transform: `translate(-50%, 0) scale(${s}) rotate(0deg)`,
        },
        {
          left: `${finalCX}px`,
          top: `${finalTop}px`,
          transform: `translate(-50%, -50%) scale(1) rotate(-2deg)`,
        },
      ],
      {
        duration: L.flyMs,
        // 先加速后减速，比 linear 更自然
        easing: 'cubic-bezier(0.22, 0.82, 0.28, 1)',
        fill: 'forwards',
      },
    );
    try {
      await anim.finished;
    } catch {
      /* aborted */
    }

    polaroid.style.left = `${finalCX}px`;
    polaroid.style.top = `${finalTop}px`;
    polaroid.style.transform = 'translate(-50%, -50%) scale(1) rotate(-2deg)';
    polaroid.style.willChange = '';
  };

  const playCapture = async (dataUrl: string) => {
    applyPrintLayoutCss(uiRoot);
    clearPolaroidInline();
    // 确保在 clip 内开始
    if (polaroid.parentElement !== ejectClip) {
      ejectClip.append(polaroid);
    }
    await Promise.all([waitImg(polaroidImg, dataUrl), waitImg(wonImg, dataUrl)]);
    setPhase('capturing');
    root.classList.add('is-printing');

    const reduced = prefersReducedMotion();
    const { slideOutMs } = PRINT_LAYOUT;

    // 1) Flash
    flash.classList.remove('is-flash');
    void flash.offsetWidth;
    flash.classList.add('is-flash');
    await wait(reduced ? 120 : 520);
    flash.classList.remove('is-flash');

    if (reduced) {
      root.classList.remove('is-printing');
      setPhase('won');
      return;
    }

    // 2) 阶段1：Mask 内滑出
    polaroid.classList.remove('is-slide-out', 'is-fly-final');
    void polaroid.offsetWidth;
    polaroid.classList.add('is-slide-out');
    await waitAnim(polaroid, 'polaroid-slide-out', slideOutMs + 120);

    // 3) 阶段2：FLIP + 缓动飞入终点
    await flyPolaroidToFinal();
    await wait(80);

    root.classList.remove('is-printing');
    setPhase('won');
  };

  return {
    root,
    setPhase,
    setIslandPreview,
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
      shutterBtn.removeEventListener('click', onShutterClick);
      returnBtn.removeEventListener('click', onReturnClick);
      replayBtn.removeEventListener('click', onReplayClick);
      root.remove();
    },
  };
}
