# NewProject_Puzzle

竖屏 **TypeScript + Three.js WebGPU + Vite + Capacitor iOS**。  
产品：**房间光路捉鬼**（固定谜题 · 光学布局 · 拍照过关）。

## 文档（按用途）

| 文档 | 用途 |
|------|------|
| [AGENTS.md](./AGENTS.md) | 工程硬约定（AI / 新窗口第一入口） |
| [docs/PRODUCT.md](./docs/PRODUCT.md) | **产品与玩法真源** |
| [docs/PROGRESS.md](./docs/PROGRESS.md) | **实现进度 / 已改内容总览** |
| [docs/OPTICS_SPEC.md](./docs/OPTICS_SPEC.md) | 光路与鬼状态算法 |
| [docs/INTERACTION_SPEC.md](./docs/INTERACTION_SPEC.md) | 交互 / 扫描表现 / 会话 |
| [docs/HAPTICS_SPEC.md](./docs/HAPTICS_SPEC.md) | **扫描震动设计** |
| [docs/IMPLEMENTATION_TODO.md](./docs/IMPLEMENTATION_TODO.md) | Todo 勾选 |
| [docs/ASSETS.md](./docs/ASSETS.md) | 美术资源定稿 |
| [docs/HANDOFF_SLICE0_STEP1.md](./docs/HANDOFF_SLICE0_STEP1.md) | Step 1 交接 |
| [docs/README.md](./docs/README.md) | 文档索引与维护规则 |
| [docs/ENGINEERING.md](./docs/ENGINEERING.md) | 工程决策与踩坑 |
| [docs/ENTRYPOINTS.md](./docs/ENTRYPOINTS.md) | 启动链与 DOM |

## 产品一句话

固定房间里用手电等铺光路，让所有鬼同时完全显示，再拍照合影过关。  
细则见 **[docs/PRODUCT.md](./docs/PRODUCT.md)**。

## 当前进度（Step 1 + S3.1）

- 托盘拖灯、放置、点旋；扫描光斑 + 连接条（Additive）
- 放置后直线 lit；鬼 **连续照亮 1s** 才首次出场
- 入场动画 + 待机漂浮；独立鬼层；HUD **重制**
- **扫描震动**（开灯 / 底噪 / 近鬼线性 / 蓄光 1s / 过格 / 出场三连 mute 底噪）；左下 📳 调参  
  设计见 [docs/HAPTICS_SPEC.md](./docs/HAPTICS_SPEC.md)

完整清单：**[docs/PROGRESS.md](./docs/PROGRESS.md)**（v0.6）。

## 30 秒上手

```bash
npm install
npm run dev
# → http://127.0.0.1:5190/
```

## 工程要点

- 设计空间 **390×844**，contain letterbox  
- `vite` **`base: './'`**（Capacitor）  
- `ios.contentInset: never`，Safe Area 走 CSS  
- UI 只挂 `#ui-root`  
- 完整约定：[AGENTS.md](./AGENTS.md)

## iOS

```bash
npm run ios:bootstrap   # 首次 / 修插件
npm run cap:sync
npm run ios
```

## 加玩法时

1. 规则真源：`docs/PRODUCT.md`（及 OPTICS / INTERACTION）  
2. 看进度：`docs/PROGRESS.md`  
3. 实现：`src/game/*`（`mountGame`）  
4. **保留** adapt / create-renderer / haptics / plugins / `base: './'`  
