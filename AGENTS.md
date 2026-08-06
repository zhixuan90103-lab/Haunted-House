# AGENTS.md — NewProject_Puzzle

> **打开本仓库时的第一入口（工程约定）。**  
> 产品与玩法规则见 **`docs/PRODUCT.md`**（光路捉鬼）。  
> 工程合并自 **niantu**（适配/TS/预览）+ **three-webgpu-cap-shell**（打包/文档/bootstrap/可验证 demo）。

## 一句话

**TypeScript + Three.js WebGPU + Vite + Capacitor iOS** 竖屏手游。  
工程：设计空间固定 **390×844**，contain letterbox；桌面可切手机/Pad 预览；`base: './'` 保证真机资源路径。  
产品：**固定房间光路捉鬼**（细则只认 `docs/PRODUCT.md`）。

## 文档优先级

| 问题 | 看 |
|------|-----|
| 玩法 / 规则 / 胜负 | `docs/PRODUCT.md` |
| **已落地改了什么 / 模块地图** | **`docs/PROGRESS.md`** |
| 关卡 / 谜题怎么做 | `docs/LEVEL_DESIGN.md` |
| 实现检索 / 切片 Todo | `docs/IMPLEMENTATION_PLAN.md` · `IMPLEMENTATION_TODO.md` |
| 光路算法规格 | `docs/OPTICS_SPEC.md` |
| 交互/会话/扫描表现 | `docs/INTERACTION_SPEC.md` |
| 资源路径 | `docs/ASSETS.md` |
| Step1 交接 | `docs/HANDOFF_SLICE0_STEP1.md` |
| 工程硬约定 / 目录 | 本文 |
| 启动链 / 命令 | `docs/ENTRYPOINTS.md` |
| 工程决策 / 坑 | `docs/ENGINEERING.md` |

## 入口地图

| 职责 | 文件 |
|------|------|
| 产品规则 | `docs/PRODUCT.md` |
| Web 启动 | `index.html` → `src/main.ts` |
| 玩法 | `src/game/index.ts`（`mountGame`）+ `src/game/*` |
| 设计舞台 | `src/adapt/design.ts` |
| 设备预览 | `src/adapt/devicePreview.ts` |
| Safe Area | `src/adapt/safeArea.ts` + `src/style.css` |
| WebGPU | `src/create-renderer.ts` |
| 震动 JS | `src/utils/haptics.ts`（玩法震动待 S3.1） |
| 震动 Swift 真源 | `plugins/native-haptics/*` |
| Capacitor | `capacitor.config.ts`（`contentInset: never`） |
| 构建 | `vite.config.ts`（**`base: './'`**） |
| iOS 注入 | `scripts/bootstrap-ios.mjs` |

## DOM（勿拆）

```
#shell > #viewport > #app > #stage
  canvas                 ← WebGPU
  #ui-root               ← 所有游戏 UI（safe padding）
    #board-hit
      .board-grid        ← 格/墙/道具
      .board-ghost-layer ← 鬼（稳定层，勿并进 cell 每帧重建）
    .board-light-canvas  ← 扫描光效
#device-switcher         ← 仅桌面预览例外
```

## 硬性约定

1. **`vite` `base: './'`** — Capacitor 禁止绝对 `/assets/`  
2. **`webDir: dist`** 与 Vite `outDir` 一致  
3. **`ios.contentInset: never`** — Safe Area 只走 CSS  
4. **布局坐标 390×844**；禁止 `renderer.setSize(window.innerWidth,…)`  
5. **UI 只挂 `#ui-root`**；禁止玩法 UI `position: fixed` 贴浏览器窗  
6. **Pad 只改外层视口**，不改 `DESIGN_*`  
7. **改 Swift 改 `plugins/native-haptics/`** 再 `ios:bootstrap`  
8. **无 WebGPU 则明确失败**，不静默 WebGL  

## 命令

```bash
npm install
npm run dev           # http://127.0.0.1:5190/
npm run build
npm run cap:sync
npm run ios:bootstrap # 首次 / 修插件
npm run ios
```

查询参数：`?preview=0|1` · `?debugFit=1`  
调试安全区：`document.body.classList.add('debug-safe-area')`

## 业务怎么加

- 规则：先读/改 **`docs/PRODUCT.md`**（及 OPTICS/INTERACTION），再写代码  
- 进度/模块：先扫 **`docs/PROGRESS.md`**  
- 玩法：改 `src/game/*`（入口 `mountGame`）  
- 保留：adapt / create-renderer / haptics / plugins / `base`  
- 触控：`clientToDesign` + 忽略 letterbox 外  
- 探查震动：走 `haptics`（S3.1；勿默认光斑换格震）  
- 鬼动画：层 `board-ghost-layer` + CSS 入场 + `ghostIdle` 待机  

## 刻意不做（工程）

- Android（可后加）  
- WebGL 静默回退  

## 刻意不做（产品）

- 见 `docs/PRODUCT.md` §12（消行复刻、组装图鉴等）  

