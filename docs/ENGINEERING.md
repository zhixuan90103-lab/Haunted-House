# Engineering — NewProject_Puzzle

配套：[AGENTS.md](../AGENTS.md) · [PRODUCT.md](./PRODUCT.md) · [ENTRYPOINTS.md](./ENTRYPOINTS.md) · [MERGE.md](./MERGE.md)

## 1. 定位

**竖屏 WebGPU + Capacitor iOS** 工程底座：能 dev、能 build、能真机、能震动、桌面≈手机/Pad。  
产品玩法见 **[PRODUCT.md](./PRODUCT.md)**（光路捉鬼）；本文只记工程决策。demo 立方体可删，由 `src/game/*` 替换。

## 2. 目录

```
NewProject_Puzzle/
├── AGENTS.md
├── README.md
├── docs/                   # PRODUCT · OPTICS · INTERACTION · PROGRESS …
├── public/                 # 运行时贴图（ghost / prop-light / light-* / board-bg）
├── index.html
├── vite.config.ts          # base: './' · port 5190
├── capacitor.config.ts
├── src/
│   ├── main.ts             # boot → mountGame
│   ├── create-renderer.ts
│   ├── style.css
│   ├── adapt/              # 390×844 · devicePreview · safeArea
│   ├── utils/haptics.ts
│   └── game/               # 玩法（见 PROGRESS §3）
├── plugins/native-haptics/
└── scripts/bootstrap-ios.mjs
```

## 3. 配置表

### Vite

| 项 | 值 | 原因 |
|----|-----|------|
| `base` | `'./'` | Capacitor 相对路径 |
| `outDir` | `dist` | = webDir |
| `port` | `5190` | 固定端口 |
| `target` | `es2022` | WebGPU |

### Capacitor

| 项 | 值 |
|----|-----|
| `appId` | `com.example.portraitwebgpubase`（占位） |
| `webDir` | `dist` |
| `ios.contentInset` | `never` |
| `ios.scrollEnabled` | `false` |
| `ios.backgroundColor` | `#0b1020` |

### 设计尺寸

| 常量 | 值 |
|------|-----|
| DESIGN_WIDTH / HEIGHT | 390 / 844 |
| DESIGN_SAFE top/bottom | 59 / 34（桌面模拟） |
| Phone 预览 | 390×844 |
| Pad 预览 | 768×1024（外层视口） |

改设计尺寸时同步：`design.ts`、`style.css` 中 `#stage` 宽高、`index.html` 若有硬编码。

## 4. 适配算法

```
scale = min(viewW/390, viewH/844)   // contain
offset = 居中
#stage transform: translate(offset) scale(scale)
renderer.setSize(390, 844)          // 始终设计分辨率
```

触控：`clientToDesign`；letterbox 外忽略。

## 5. Safe Area

| 环境 | 行为 |
|------|------|
| 桌面 | JS 写入 `--safe-*` = DESIGN_SAFE |
| 原生 | 去掉 inline，CSS `env(safe-area-inset-*)` |
| UI | `#ui-root` padding = safe + ui-pad |

3D 可全出血；可点 UI 只在 `#ui-root`。

## 6. WebGPU

- `createRenderer` → `three/webgpu` WebGPURenderer  
- 无 `navigator.gpu` / init 失败 → `showFatal`  
- DPR cap 默认 2  
- 禁止 `setSize(innerWidth, innerHeight)` 跟窗走  

## 7. Haptics

| 层 | 路径 |
|----|------|
| 设计 | `docs/HAPTICS_SPEC.md` |
| 玩法参数/会话 | `src/game/feel/haptic-{config,math,patterns}.ts` · `scan-haptics.ts` |
| JS 桥 | `src/utils/haptics.ts` → `registerPlugin('AdvancedHaptics')` |
| 原生真源 | `plugins/native-haptics/` → `ios:bootstrap` |

注册：`BridgeViewController` → `registerPluginInstance(AdvancedHapticsPlugin)`  

**硬坑：** `SceneDelegate` 必须 `BridgeViewController()`，禁止裸 `CAPBridgeViewController()`（否则 `platform=ios` 但插件未接通）。  

业务节奏只改 `feel/haptic-*`；改 Swift 后 Xcode 重装真机。

## 8. iOS 工作流

```bash
# 首次
npm install && npm run ios:bootstrap && npm run cap:open

# 日常
npm run cap:sync
```

## 9. 已知坑

1. **不要**把 `base` 改回 `'/'`  
2. **不要** `contentInset: automatic`（双重 inset）  
3. Pad 预览禁止横向拉满 390 UI  
4. pbxproj 优先 bootstrap，少手改  
5. `dist` / `ios/.../public` 是产物  
6. appId `com.example.*` 仅脚手架  
7. **鬼节点**挂稳定层（`board-ghost-layer`），勿每帧 `replaceChildren` 掐断 CSS 动画  
8. **鬼尺寸**用 `cellSize × %`，勿把 `%` 相对整层棋盘  
9. **拖灯**时禁止 dwell rAF 与 input rAF 同时 full-repaint（会抖）  
10. 左右描述用 **图片左/右**，不用角色左右  

## 10. 变更

| 日期 | 说明 |
|------|------|
| 2026-08-03 | 初版：合并 niantu + shell 为 portrait-webgpu-base |
| 2026-08-06 | 玩法 Step1：光效层、鬼层池、dwell、双 rAF 修复；文档 PROGRESS |
