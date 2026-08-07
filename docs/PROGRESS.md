# 实现进度 · 修改总览

| | |
|--|--|
| 版本 | **v0.6** |
| 日期 | 2026-08-07 |
| 范围 | Slice 0 · Step 1 + 扫描震动（含蓄光/出场 mute）+ 重制 + 手感微调 |
| 真源优先级 | PRODUCT → OPTICS → INTERACTION → **HAPTICS_SPEC** → 本文仅作进度索引 |

> **用法：** 新会话先扫本文「已落地」与「未做」；改规则仍改 PRODUCT/OPTICS/INTERACTION/HAPTICS，再改码。

---

## 1. 当前可玩状态

**能做的：**

1. 5×5 木格棋盘 + 全屏 `board-bg` 竖屏舞台（390×844）
2. 托盘 **3 盏** 手电：拖出 / **全发现后**放置 / 再拿起 / 点旋四向
3. **扫描态**（拿起 light）：前方连续光斑跟手；中心格 lit（1 格）；**未找全鬼不可落格**
4. **放置态**：完整直线 `computeLit`（多灯并集）；光源格本身不亮；精灵**格心** + 与抬起同尺寸
5. 鬼状态机 + **首次出场需连续照亮 1s**（离开清零）
6. 鬼：Hidden → 首次 Revealed 入场 + 待机；Transparent；再照立刻 Revealed
7. **扫描震动会话**（仅握灯）：开灯 → 底噪 continuous → 近鬼线性 → 压格蓄光 1s 爬升 → 过未发现鬼格轻点 → 出场三连（底噪关）→ 三连后底噪开 / 放下停
8. **重制**按钮：鬼全隐藏、道具回托盘、停震动
9. 调参：右下 ⚙ 布局手感光效；左下 📳 震动

**明确未做：** 半透/漫射 UI、会话 Camera/Won、拍照、多关、音效、Android。  
**本轮：** 镜贴图（盘上/托盘）+ 托盘拖放点旋 + 折线光经镜。

---

## 2. 已落地修改清单（按主题）

### 2.1 光路与扫描

| 项 | 说明 | 代码 |
|----|------|------|
| 放置直线 lit | `computeLit` + `collectLightsFromGet` | `optics.ts` |
| 扫描 1 格 | 拖 light 不用幽灵灯占格；`freeBeamSpot` → 中心格 lit | `index.ts` · `lightFx.ts` |

### 2.2 鬼状态

| 项 | 说明 | 代码 |
|----|------|------|
| everLit 三态 | Hidden / Revealed / Transparent | `ghosts.ts` |
| 首次 dwell 1s | 连续 isLit ≥ 1000ms | `GHOST_REVEAL_DWELL_MS` |
| 拖灯 / 放置 dwell 时钟 | 拖灯用 input rAF；放置用 dwell rAF；禁止双 rAF | `index.ts` |

### 2.3 光效 / 鬼表现

| 项 | 说明 | 代码 |
|----|------|------|
| 扫描光效层 | beam + glow，仅拿起 | `lightFx.ts` |
| 独立鬼层 + 入场/待机 | DOM 池 + CSS + ghostIdle | `domBoard` · `ghostIdle` |

### 2.4 扫描震动（S3.1 · 本轮重点）

设计真源：**`docs/HAPTICS_SPEC.md`**

| 项 | 说明 | 代码 |
|----|------|------|
| 会话边界 | 仅 `drag.type==='light'`；放置灯不震 | `scan-haptics.ts` |
| 开灯 | 1× transient；`openToContinuousMs` 后 continuous | `haptic-patterns` |
| 底噪 continuous | base=1 + `updateContinuous` 绝对电平 | `haptic-patterns` · native |
| 近鬼 | 未发现鬼曼哈顿；`nearRadius` 内 **线性** floor→peak | `haptic-math` |
| **蓄光 1s** | 压未发现鬼格 + `litSince`：peak **线性**→ chargePeak（与 dwell 同钟） | `scanContinuousLevel` |
| 过鬼格 | 换格进入 **!everLit** 鬼格 → 轻瞬态 + 冷却 | `scan-haptics` |
| 出场 | everLit 上升沿 → **三段**瞬态；**期间 mute continuous**，#3 后重开底噪 | `playRevealPattern` · `revealGate` |
| 已发现鬼 | 不参与近距/过格/蓄光 | `undiscoveredGhosts` |
| 参数 | 定稿默认在 config | `haptic-config.ts` |
| 调参 UI | 左下 📳 试振 + 滑条 + 复制 | `hapticTuner.ts` |
| 原生桥 | `AdvancedHaptics`；`updateContinuous` / `diagnose` / `buzz` | `utils/haptics` · Swift |
| 注册硬坑 | **SceneDelegate 必须 `BridgeViewController()`** | `ios/.../SceneDelegate.swift` |

**定稿默认参数（摘要 · 与 `haptic-config.ts` 一致）：**

| 组 | 值 |
|----|-----|
| 开灯 | i=0.6 s=0.8 · 65ms → continuous |
| 底噪 / 近鬼 peak | 0.15/0.01 · 0.2/0.1 · 半径 3 格 |
| **蓄光满 chargePeak** | **0.35 / 0.15** |
| 过鬼格 | 0.51/0.18 · 冷却 180ms |
| 出场三连 | 0.53/0.46 →40ms→ 0.4/0.29 →40ms→ 0.33/0.62 |

### 2.5 重制

| 项 | 说明 | 代码 |
|----|------|------|
| HUD「重制」 | `loadLevel` 重载；鬼 Hidden；托盘恢复；`scanHaptics.end` | `domBoard` · `index.restart` |
| 对齐 | INTERACTION R15 语义 | 本关快照 = 当前 `level_001` |

### 2.6 手感2

| 项 | 说明 | 代码 |
|----|------|------|
| 抬升 Y | 默认 **`DRAG_OFFSET_Y = -1`**（MIN/MAX 同步） | `feel/defaults.ts` |

### 2.7 工程

| 项 | 说明 |
|----|------|
| 震动模块分层 | `haptic-config` / `math` / `patterns` / `scan-haptics` |
| 插件 | `plugins/native-haptics` → bootstrap / Xcode 重装 |
| 调参 | propTuner ⚙ + hapticTuner 📳 |

---

## 3. 模块地图（`src/game`）

```
src/game/
  index.ts           # mountGame · resolve · dwell · paint · restart
  types.ts · optics.ts · ghosts.ts · board.ts · level.ts
  levels/level_001.json
  layout.ts · input.ts
  propStyle.ts · viewStyle.ts
  feel/
    defaults.ts · drag-session.ts
    haptic-config.ts    # 参数真源
    haptic-math.ts      # 距离/线性
    haptic-patterns.ts  # 播放模式
    scan-haptics.ts     # 会话状态机
  view/
    domBoard.ts         # 壳 · 鬼层 · 托盘 · 重制按钮
    lightFx.ts · ghostIdle.ts
    propTuner.ts · hapticTuner.ts
```

### DOM（玩法相关）

```
#ui-root.game-ui
  .stage-bg
  #hud
    .game-title · .game-hint · #btn-restart.game-restart-btn
  #board-hit
    .board-grid
    .board-ghost-layer
  #tray
  #drag-layer
  .board-light-canvas
  #haptic-tuner-fab / #haptic-tuner
  #prop-tuner-fab / #prop-tuner
```

---

## 4. 与规格的对应

| 主题 | 规格 | 实现 |
|------|------|------|
| 鬼 + dwell | OPTICS R07 | 已落地 |
| 扫描光 | INTERACTION R11 | 已落地 |
| 震动 | **HAPTICS_SPEC** · R12 | 蓄光/出场 mute/定稿参数已同步 |
| 手感2 抬升 | feel/defaults | DRAG_OFFSET_Y=-1 |
| 重开 | INTERACTION R15 | UI + `restart()` |
| 工程震动注册 | ENGINEERING §7 | SceneDelegate 已修 |

---

## 5. 未做 / 下一步

| 优先级 | 项 |
|--------|-----|
| Step 2 | 镜 UI + 关卡；手测 S2 |
| Slice 0 收尾 | Camera/Won、拍照（重制 UI 已有） |
| S3 | 音效、安全区打磨 |
| — | 震动：真机再微调可只改 `haptic-config` |

---

## 6. 文档维护约定

| 变更类型 | 更新哪些 |
|----------|----------|
| 玩法/胜负/鬼规则 | `PRODUCT.md` → OPTICS / INTERACTION → 码 |
| 光路算法 | `OPTICS_SPEC` → `optics` / `ghosts` |
| 拖放/会话/扫描表现 | `INTERACTION_SPEC` → `input` / `view/*` |
| **扫描震动** | **`HAPTICS_SPEC.md`** → `feel/haptic-*` / `haptic-config` |
| 手感2 默认 | `feel/defaults.ts`（抬升等） |
| 资源路径 | `ASSETS.md` + `public/` |
| 切片完成度 | `IMPLEMENTATION_TODO.md` + 本文 §2 |
| 工程决策 | `ENGINEERING.md` |
| 启动链 | `ENTRYPOINTS.md` |

---

## 修订

| 版本 | 说明 |
|------|------|
| v0.4 | Step1 光效/鬼动画/dwell/鬼层 |
| v0.5 | S3.1 震动全链路 + HAPTICS_SPEC + 模块拆分 + 重制 UI + 原生注册修复 |
| v0.6 | 蓄光 continuous 爬升；出场三连 mute 底噪；定稿参数；手感2 抬升 Y=-1 |
