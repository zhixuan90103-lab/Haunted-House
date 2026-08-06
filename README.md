# NewProject_Puzzle

竖屏 **TypeScript + Three.js WebGPU + Vite + Capacitor iOS** 工程。  
当前产品方向：**房间光路捉鬼**（固定谜题 · 光学布局 · 拍照过关）。

| 文档 | 用途 |
|------|------|
| [AGENTS.md](./AGENTS.md) | 工程硬约定（AI / 新窗口第一入口） |
| [docs/PRODUCT.md](./docs/PRODUCT.md) | **产品与玩法真源** |
| [docs/LEVEL_DESIGN.md](./docs/LEVEL_DESIGN.md) | **谜题/关卡制作指南** |
| [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) | **实现检索计划** |
| [docs/OPTICS_SPEC.md](./docs/OPTICS_SPEC.md) | **光路算法规格（已冻结）** |
| [docs/INTERACTION_SPEC.md](./docs/INTERACTION_SPEC.md) | **交互/会话规格（已冻结）** |
| [docs/IMPLEMENTATION_TODO.md](./docs/IMPLEMENTATION_TODO.md) | **实现 Todo 清单** |
| [docs/ASSETS.md](./docs/ASSETS.md) | **美术资源定稿** |
| [docs/HANDOFF_SLICE0_STEP1.md](./docs/HANDOFF_SLICE0_STEP1.md) | **第 1 步实现交接** |
| [docs/README.md](./docs/README.md) | 文档索引 |
| [docs/ENGINEERING.md](./docs/ENGINEERING.md) | 工程决策与踩坑 |
| [docs/ENTRYPOINTS.md](./docs/ENTRYPOINTS.md) | 入口与调用链 |
| [docs/MERGE.md](./docs/MERGE.md) | 双工程合并说明 |

## 产品一句话

固定房间里用手电/镜/漫射等铺光路，让所有鬼同时完全显示，再拍照合影过关。  
规则细节见 **[docs/PRODUCT.md](./docs/PRODUCT.md)**。

## 30 秒上手

```bash
npm install
npm run dev
# → http://127.0.0.1:5190/
```

当前工程仍带底座 demo（立方体、设备预览、震动按钮）；玩法将替换 `src/main.ts` / `src/game/*`。

## 工程要点（摘要）

- 设计空间 **390×844**，contain letterbox  
- `vite` **`base: './'`**（Capacitor 资源路径）  
- `ios.contentInset: never`，Safe Area 走 CSS  
- UI 只挂 `#ui-root`  
- 完整约定见 [AGENTS.md](./AGENTS.md)

## iOS 真机

```bash
npm run ios:bootstrap   # 首次 / 修插件
npm run cap:sync
npm run ios             # 或 npm run cap:open
```

占位 `appId`：`com.example.portraitwebgpubase` —— 上架前请改。

## 加玩法时

1. 以 `docs/PRODUCT.md` 为规则真源  
2. 在 `src/main.ts` 或 `src/game/*` 实现  
3. **保留** adapt / create-renderer / haptics / plugins / `base: './'`  
4. 触控用 `clientToDesign`，忽略 letterbox 外点击  
