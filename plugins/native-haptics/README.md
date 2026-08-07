# AdvancedHaptics（iOS）

本底座震动插件真源。运行时副本在 `ios/App/App/`。

改插件后执行：

```bash
npm run ios:bootstrap
```

## 注册

`Main.storyboard` → `BridgeViewController` → `capacitorDidLoad` → `AdvancedHapticsPlugin`

## JS

请用 `src/utils/haptics.ts`：

```ts
import { haptics } from '../../src/utils/haptics';

await haptics.diagnose(); // platform + plugin + impact + buzz
await haptics.buzz('heavy'); // AudioServices smoke test
await haptics.impact('medium');
await haptics.playTransient(0.5, 0.4);
await haptics.startContinuous({ intensity: 0.3, sharpness: 0.25 });
await haptics.updateContinuous({ intensity: 0.5, sharpness: 0.3 });
await haptics.stopContinuous();
```

改 Swift 后必须 **重新编译 iOS App**（`npm run ios` / Xcode Run），仅 `vite` 热更新不够。
