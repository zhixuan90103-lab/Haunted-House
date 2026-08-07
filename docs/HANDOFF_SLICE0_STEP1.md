# 交接说明 · Slice 0 Step 1（拖灯找鬼 + 表现）

| | |
|--|--|
| 版本 | **v0.3** |
| 适用 | 新窗口 / 新会话 |
| 仓库 | `NewProject_Puzzle` |
| 进度明细 | **`docs/PROGRESS.md`** |

---

## 1. 本步目标（已基本完成）

1. 5×5 棋盘与 `board-bg` 全屏背景  
2. 托盘拖出手电（×3）、放置、拿起、点旋四向  
3. **扫描：** 拿起时连续光斑 + 连接条（Additive）；中心格 lit  
4. **放置：** 直线 lit（多灯并集）；光源格不亮  
5. 鬼：Hidden →（连续照 **1s**）Revealed + 入场 → 待机；离光 Transparent  

**不做（Step1 当时）：** 镜/半透/漫射 UI、拍照过关、Camera/Won。  
**后续已补：** 扫描震动见 `docs/HAPTICS_SPEC.md` + `PROGRESS` v0.5；HUD 重制见 R15。

---

## 2. 必读顺序

| 顺序 | 文档 |
|------|------|
| 1 | `docs/PRODUCT.md` |
| 2 | `docs/OPTICS_SPEC.md`（R07 dwell） |
| 3 | `docs/INTERACTION_SPEC.md`（R09–R11） |
| 4 | `docs/PROGRESS.md`（改了什么、模块地图） |
| 5 | `docs/ASSETS.md` |
| 6 | `docs/IMPLEMENTATION_TODO.md` |
| 7 | `AGENTS.md` |

裁决：PRODUCT → OPTICS → INTERACTION。

---

## 3. 资源（运行时 `./`）

| 用途 | 路径 |
|------|------|
| 棋盘背景 | `public/board-bg.jpg` |
| 鬼 | `public/ghost.png` |
| 手电 | `public/prop-light.png` |
| 光斑 | `public/light-glow.png` |
| 连接 | `public/light-beam.png` |

---

## 4. 代码落点

```
src/game/
  index.ts           # mountGame · resolve · dwell 策略
  ghosts.ts          # stepGhosts + GHOST_REVEAL_DWELL_MS
  optics.ts
  input.ts · feel/*
  view/
    domBoard.ts      # 鬼层池 · 棋盘壳
    lightFx.ts       # 扫描光效
    ghostIdle.ts     # 待机 + 入场混合
    propTuner.ts
  viewStyle.ts · propStyle.ts · layout.ts
  levels/level_001.json
```

`main.ts`：boot 后 `mountGame`；UI 仅 `#ui-root`。

### 实现禁忌（踩过的坑）

1. 鬼 DOM **不要**塞进每帧 `replaceChildren` 的 cell → 用 `board-ghost-layer` + 池。  
2. 鬼尺寸用 **cellSize × %**，不要 `% of 整层棋盘`。  
3. 拖灯时 **不要** input rAF + dwell rAF 双开 repaint。  
4. 左右方向约定：**图片左/右**，不说角色左右。

---

## 5. 手测

- [ ] 拖灯光斑跟手，放下有直线 lit  
- [ ] 照鬼格 **不足 1s 离开** → 不出现  
- [ ] 连续照满 1s → 入场动画 → 待机漂  
- [ ] 离光变半透；再照立刻实心  
- [ ] 拖灯过格光斑不抖（无双 rAF）  
- [ ] `npm run build` 通过  

---

## 6. 修订

| 版本 | 说明 |
|------|------|
| v0.1 | 第 1 步交接 + 资源路径 |
| v0.2 | （中间迭代散落在会话） |
| v0.3 | 对齐 dwell / 光效 / 鬼层；指向 PROGRESS |
