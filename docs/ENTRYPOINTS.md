# 入口与调用链

## 1. 命令

| 命令 | 结果 |
|------|------|
| `npm run dev` | http://127.0.0.1:5190/ |
| `npm run build` | `tsc` 检查 + `dist/`（相对路径） |
| `npm run cap:sync` | build + cap sync ios |
| `npm run ios:bootstrap` | add ios + 注入插件 + sync |
| `npm run ios` | sync + open Xcode |

查询参数：`?preview=0|1` · `?debugFit=1`  
调试安全区：`document.body.classList.add('debug-safe-area')`

---

## 2. Web 启动链

```
index.html
  → style.css
  → main.ts
       → applyNativeClass / safeArea
       → createRenderer(#stage)          # WebGPU；无则 fatal
       → mountDevicePreview → computeStageLayout → applyStageTransform
       → watchStageLayout
       → haptics.prepare（若 iOS）
       → mountGame({ stage, uiRoot, getLayout })
            → buildUiShell / lightFx / ghostIdle / propTuner
            → loadLevel(level_001)
            → attachInput
            → resolve + paint 循环（拖动 / dwell）
```

玩法细节与模块表：`docs/PROGRESS.md`。

---

## 3. DOM

```
#shell
  #viewport
    #app
      #stage
        canvas                 ← WebGPU（pointer-events: none）
        #ui-root.game-ui       ← 全部玩法 UI
          .stage-bg
          #hud
          #board-hit
            .board-grid
            .board-ghost-layer
          #tray
          #drag-layer
          .board-light-canvas  ← 扫描光效
          #prop-tuner …
#device-switcher / #device-label   (web only)
```

硬约定：UI 只挂 `#ui-root`；禁止玩法 UI `position: fixed` 贴浏览器窗。

---

## 4. iOS

```
Xcode → BridgeViewController
  → register AdvancedHapticsPlugin
  → load App/public (= dist)
  → 同上 Web 链
```

---

## 5. 改配置找谁

| 要改 | 文件 |
|------|------|
| base / 端口 | `vite.config.ts` |
| appId | `capacitor.config.ts` |
| 设计分辨率 | `adapt/design.ts` + `style.css` |
| 棋盘/托盘布局 | `game/layout.ts` |
| 光效/鬼 view 旋钮 | `game/viewStyle.ts` |
| 手感 | `game/feel/defaults.ts` |
| 震动原生 | `plugins/native-haptics/*.swift` + bootstrap |
| 启动 | `index.html` + `main.ts` |
