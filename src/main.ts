/**
 * Boot: safe-area → device preview → WebGPU stage → Haunted House game.
 * Keep: adapt/*, create-renderer, utils/haptics, DOM contract.
 */

import * as THREE from 'three';
import { Capacitor } from '@capacitor/core';
import {
  DESIGN_HEIGHT,
  DESIGN_SAFE,
  DESIGN_WIDTH,
  applyStageTransform,
  computeStageLayout,
  watchStageLayout,
  type StageLayout,
} from './adapt/design';
import {
  mountDevicePreview,
  type DevicePreviewController,
} from './adapt/devicePreview';
import { applyNativeClass, applySafeAreaCssVars, readSafeAreaInsets } from './adapt/safeArea';
import { createRenderer, resizeToDesign } from './create-renderer';
import { mountGame } from './game';
import { haptics } from './utils/haptics';

const shell = document.getElementById('shell')!;
const viewportEl = document.getElementById('viewport')!;
const stage = document.getElementById('stage')!;
const uiRoot = document.getElementById('ui-root')!;

async function boot(): Promise<void> {
  applyNativeClass();

  const platform = Capacitor.getPlatform();
  const native = Capacitor.isNativePlatform();

  const renderer = await createRenderer({ container: stage });
  const scene = new THREE.Scene();
  // Dim stage; gameplay is DOM on #ui-root
  scene.background = new THREE.Color(0x0a0c12);

  const camera = new THREE.PerspectiveCamera(
    45,
    DESIGN_WIDTH / DESIGN_HEIGHT,
    0.1,
    100,
  );
  camera.position.set(0, 0, 5);

  // No OrbitControls in play mode (INTERACTION R10)
  renderer.domElement.style.pointerEvents = 'none';

  let latestLayout: StageLayout | null = null;
  let preview: DevicePreviewController;

  const onLayout = (layout: StageLayout) => {
    latestLayout = layout;
    applyStageTransform(stage, layout);
    applySafeAreaCssVars(native);
    resizeToDesign(renderer, camera);

    if (native) {
      readSafeAreaInsets();
    } else {
      void DESIGN_SAFE;
    }
  };

  preview = mountDevicePreview(shell, viewportEl, () => {
    const size = preview.getViewSize();
    onLayout(computeStageLayout(size.width, size.height, 'contain'));
  });

  const unwatch = watchStageLayout(onLayout, {
    mode: 'contain',
    getViewSize: () => preview.getViewSize(),
  });

  if (new URLSearchParams(window.location.search).has('debugFit')) {
    const log = () => {
      if (latestLayout) {
        console.info('[debugFit]', latestLayout, preview.getDevice());
      }
    };
    window.addEventListener('resize', log);
    log();
  }

  const game = mountGame({
    stage,
    uiRoot,
    getLayout: () => latestLayout,
  });

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });

  if (haptics.isNativeIos()) {
    await haptics.prepare();
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && haptics.isNativeIos()) {
      void haptics.prepare();
    }
  });

  window.addEventListener(
    'pagehide',
    () => {
      game.dispose();
      unwatch();
      preview.dispose();
      renderer.setAnimationLoop(null);
      renderer.dispose();
    },
    { once: true },
  );

  console.info(
    `[Haunted House] platform=${platform} native=${native} design=${DESIGN_WIDTH}×${DESIGN_HEIGHT}`,
  );
}

boot().catch((err) => {
  console.error(err);
  uiRoot.textContent = `boot failed: ${err instanceof Error ? err.message : String(err)}`;
});
