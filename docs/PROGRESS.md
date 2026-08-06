# 实现进度 · 修改总览

| | |
|--|--|
| 版本 | **v0.4** |
| 日期 | 2026-08-06 |
| 范围 | Slice 0 · Step 1 及表现层迭代（拖灯找鬼 + 光效 + 鬼动画） |
| 真源优先级 | PRODUCT → OPTICS → INTERACTION → 本文仅作进度索引 |

> **用法：** 新会话先扫本文「已落地」与「未做」；改规则仍改 PRODUCT/OPTICS/INTERACTION，再改码。

---

## 1. 当前可玩状态（Step 1）

**能做的：**

1. 5×5 木格棋盘 + 全屏 `board-bg` 竖屏舞台（390×844）
2. 托盘 **3 盏** 手电：拖出 / 放置 / 再拿起 / 点旋四向
3. **扫描态**（拿起 light）：前方约 1 格距离的连续光斑跟手；光斑中心落格 → 逻辑 lit（1 格）
4. **放置态**：完整直线 `computeLit`（多灯并集）；光源格本身不亮
5. 鬼状态机 + **首次出场需连续照亮 1s**（离开清零）
6. 鬼：Hidden 不绘 → 首次 Revealed 播入场动画 → 待机漂浮；离光 Transparent；再照立刻 Revealed
7. 调参：布局 / 手感 / 道具比例 / 光效 / 鬼大小位置质心待机（propTuner）

**明确不做（本步）：** 镜/半透/漫射 UI、会话 Camera/Won、拍照、重开 UI、探查震动档位、Android。

---

## 2. 已落地修改清单（按主题）

### 2.1 光路与扫描

| 项 | 说明 | 代码 |
|----|------|------|
| 放置直线 lit | `computeLit` + `collectLightsFromGet` | `optics.ts` |
| 扫描 1 格 | 拖 light 时不用幽灵灯占格；`freeBeamSpot` 连续点 → 中心格 lit | `index.ts` · `lightFx.ts` |
| maxSteps | 算法支持；扫描用连续光斑而非 board 上 maxSteps 灯 | `optics.ts` |

### 2.2 鬼状态（规则变更 · 已写 OPTICS）

| 项 | 说明 | 代码 |
|----|------|------|
| everLit 三态 | Hidden / Revealed / Transparent / Caught(未接) | `ghosts.ts` |
| **首次出场 dwell** | 连续 isLit ≥ **1000ms** 才 `everLit=true` + Revealed；离开重置 `litSince` | `GHOST_REVEAL_DWELL_MS` |
| 再次照亮 | 已 everLit → 立刻 Revealed | `stepGhost` |
| dwell 时钟 | 拖灯：input rAF 每帧 resolve；放置后蓄光：独立 dwell rAF | `index.ts` |
| **禁止双 rAF** | 拖灯时停 dwell 循环，避免 double-paint 光斑抖 | `index.ts` |

### 2.3 光效表现

| 项 | 说明 | 代码 / 资源 |
|----|------|-------------|
| 独立光效层 | 全 design canvas，z=22，`mix-blend-mode: plus-lighter` | `lightFx.ts` · `style.css` |
| 仅拿起显示 | 连接 `light-beam.png` + 光斑 `light-glow.png` | `public/` |
| 开灯动画 | `openT` 0→1：光斑整体 scale；连接宽度中心变宽 | `drag-session` · `lightFx` |
| 调参 | glow/beam 尺寸、偏移、透明度 | `viewStyle.ts` · propTuner |

### 2.4 鬼表现

| 项 | 说明 | 代码 / 资源 |
|----|------|-------------|
| 贴图 | 定稿 `ghost.png`（透明底 Q 版） | `public/ghost.png` |
| **独立鬼层** | `.board-ghost-layer` 与 grid 同 inset；**不进 cell** | `domBoard.ts` |
| 尺寸 | `--ghost-box = cellSize × ghostSize%`（非相对整层） | `viewStyle.ts` |
| 位置默认 | offset (8, 8) px；质心 pivotY 50%（贴图中心） | `VIEW_STYLE` |
| 用语共识 | 只说 **图片左/右**，不说「鬼的左/右」 | 注释 / 本文 |
| 入场动画 | S&S + 后仰 rotateX + 微 rotateY + 微 translate；640ms | `style.css` `@keyframes ghost-appear` |
| 入场→待机 | 后半段 smoothstep 混入 bob/挤压 | `ghostIdle.ts` |
| 待机 | sin bob + 体积守恒 squash；质心 `transform-origin` | `ghostIdle.ts` |
| DOM 池 | 同 id 复用节点，避免 repaint 掐断 CSS 动画 | `ghostPool` |

### 2.5 交互手感

| 项 | 说明 | 代码 |
|----|------|------|
| 手感2 | 固定 K、抬升、短平滑、托盘/盘比例 | `feel/*` |
| 拿起缩放 | 托盘→拖动尺寸；本体不随 openT 缩放 | `drag-session` · `domBoard` |
| 吸附描边 | 放置预览 snap-ok（扫描 lit 不依赖吸附格） | `domBoard` |
| 震动 | **S3.1 扫描会话**：开灯 tip + 跟距 continuous + 出场尖峰 + 放下停 | `feel/scan-haptics.ts` · `haptics.updateContinuous` · Swift `updateContinuousHaptic` |

### 2.6 工程 / 调参

| 项 | 说明 |
|----|------|
| 布局调参 | `layout.ts` + layoutTuner |
| 道具比例 | `propStyle.ts` |
| 光/鬼 view | `viewStyle.ts` |
| 统一面板 | `propTuner.ts`（含复制参数） |

---

## 3. 模块地图（`src/game`）

```
src/game/
  index.ts           # mountGame · resolve · dwell · paint
  types.ts           # Ghost(+litSince) · DragGhost · LevelDef
  optics.ts          # computeLit · collectLights
  ghosts.ts          # stepGhosts · dwell · anyGhostCharging
  board.ts / level.ts / levels/level_001.json
  layout.ts          # BOARD/TRAY · designToCell
  input.ts           # 拖放点旋 + feel 会话
  propStyle.ts / viewStyle.ts / feel/*  # drag-session · scan-haptics
  view/
    domBoard.ts      # 壳 · 格 · 鬼层池 · 托盘 · 拖影
    lightFx.ts       # 扫描光效 canvas
    ghostIdle.ts     # 待机 + 入场混合
    propTuner.ts / layoutTuner.ts
```

### DOM（玩法相关）

```
#ui-root.game-ui
  .stage-bg
  #hud
  #board-hit
    .board-grid          # 格 / 墙 / 道具
    .board-ghost-layer   # 鬼（稳定层）
  #tray
  #drag-layer            # 拖动手电精灵
  .board-light-canvas    # 扫描光效（uiRoot 顶层）
  #prop-tuner …
```

---

## 4. 与规格的对应

| 主题 | 规格 | 实现备注 |
|------|------|----------|
| 鬼状态 + dwell | OPTICS R07 | 已改：首次 isLit 需连续 1s |
| 扫描跟手光 | INTERACTION R11 扩展 | 连续光斑 + 中心格 lit |
| 坐标 | INTERACTION R09 | layout + clientToDesign |
| 震动 | INTERACTION R12 | 扫描会话已接；真机定参可再调 |
| 资源 | ASSETS.md | glow/beam/ghost 定稿路径 |
| 工程壳 | AGENTS.md | 未改硬约定 |

---

## 5. 未做 / 下一步

| 优先级 | 项 |
|--------|-----|
| Step 2 | 镜 UI + 关卡；手测 S2 |
| Slice 0 收尾 | session Camera/Won、重开、拍照 |
| S3.1 | ~~探查震动~~ **已做**（持续跟距；非换格 impact）；真机微调 floor/peak |
| S3 | 音效、安全区打磨 |

---

## 6. 文档维护约定

| 变更类型 | 更新哪些 |
|----------|----------|
| 玩法/胜负/鬼规则 | `PRODUCT.md` → `OPTICS_SPEC` / `INTERACTION_SPEC` → 码 |
| 光路算法 | `OPTICS_SPEC` → `optics.ts` / `ghosts.ts` |
| 拖放/会话/表现 | `INTERACTION_SPEC` → `input` / `view/*` |
| 资源路径 | `ASSETS.md` + `public/` |
| 切片完成度 | `IMPLEMENTATION_TODO.md` + 本文 §2 |
| 工程决策 | `ENGINEERING.md` |
| 启动链 | `ENTRYPOINTS.md` |

修订表见各文档文末；进度总览只维护本文。

---

## 修订

| 版本 | 说明 |
|------|------|
| v0.4 | 首版进度总览：Step1 光效/鬼动画/dwell/鬼层/双 rAF 修复 |
