# 实现进度 · 修改总览

| | |
|--|--|
| 版本 | **v0.8** |
| 日期 | 2026-08-07 |
| 范围 | Slice 0 · … · **Camera / 截屏 / 吐相 / 结算** |
| 真源优先级 | **PRODUCT** → **OPTICS** → **INTERACTION** → **HAPTICS** → 本文（仅进度索引，不改规则） |

> **用法：** 新会话先扫本文「当前可玩」与「本轮已落地」；改规则改 SPEC，再改码。

---

## 1. 当前可玩状态

1. **5×5** 木格 + 全屏 `board-bg` 竖屏舞台（390×844）
2. **托盘**  
   - 开局仅 **手电**；**全鬼 everLit 后** 镜等滑入（`TRAY_UNLOCK_ON_ALL_FOUND`）  
   - 图标固定 `traySlotScale`，**不**为塞屏缩小；溢出可**横滑**  
   - 拿起补位 **FLIP**；解锁入场 **自下而上滑入**（入场时临时 `overflow:visible`）  
   - 横滑 vs 拖出：轴锁分流（见 `input` + `trayMetrics`）
3. **拖灯 · 视觉 A1（统一跟手照射）**  
   - 全程 beam + glow **跟手**（`designX/Y`），长度 = 朝向障碍/盘边（`freeShineLengthPx`）  
   - **未找全鬼**：短距 cap（`glowForward`）；**找全后**：可照远，吸附**不换另一套光**  
   - **可放**：仅多 snap 框；**落盘**后才切格心放置光 + 折线
4. **落格门禁**：未找全鬼禁止 `light` 落格；找全后可放；镜等可随时放（解锁后）
5. **放置态光**：`castReflectingLightPath` 折线 + 尽头光斑；盘上 clip 在棋盘框内
6. **镜**：托盘/拿起立式图 · 盘上斜置图；`MIRROR_REFLECT` 单面 3↔4 正面；点旋四向
7. **鬼**：Hidden / Revealed / Transparent；首次 dwell 1s；独立层入场 + 待机；Revealed Additive
8. **扫描震动**（仅握灯）：见 `HAPTICS_SPEC` / §2.4
9. **重制**：鬼隐藏、道具回盘、停震动、托盘 scroll 归零
10. **调参**：右下 ⚙ prop/布局/光效；左下 📳 震动

**明确未做：** 半透/漫射正式 UI、多关、音效、Android、拖灯长度软过渡、shake 显影、系统灵动岛。

---

## 2. 本轮（v0.7）已落地 · 按主题

### 2.1 拖灯光效 A1（跟手统一）

| 项 | 说明 | 代码 |
|----|------|------|
| 一套跟手光 | 扫描/可放**同一套** beam+glow；可放只加 snap | `lightFx.ts` · `index.resolve` |
| 长度 | `freeShineLengthPx`：沿 facing 走到墙/道具/盘边；未找全再 cap `glowForward` | `lightFx.ts` |
| 连接长度 | = 灯心→光斑投影距离 | `paint` |
| 逻辑 lit | 未吸附：光斑格；已吸附且找全：落点格完整 `computeLit`（可经镜） | `index.ts` |
| 放置发射 | 格心锚 + 折线；`withBoardClip` 不画出棋盘外框 | `paintPlacedLight` |

**沟通结论（A1）：** 不像「吸附瞬间换成长预览光」；像一直拿手电照，能放时只多落点框。

### 2.2 镜与折线光

| 项 | 说明 | 代码 |
|----|------|------|
| 双贴图 | tray/拿起 `prop-mirror-tray`；盘/投影 `prop-mirror-board` | `domBoard` · `ASSETS` |
| 反射表 | 标定 3↔4 正面、1/2 背面挡；facing×90 与贴图同旋 | `optics.MIRROR_REFLECT` |
| 放置路径 | `castReflectingLightPath` segments + end 光斑 | `optics` · `lightFx` |
| 四层尺寸 | 托盘容器 / 托盘图标 / 拿起 / 盘上+投影 解耦 | `propStyle` · `layout.TRAY_*` |

### 2.3 托盘

| 项 | 说明 | 代码 |
|----|------|------|
| 开局 / 解锁 | 仅 light → 全 everLit 后补镜等 + 滑入 | `level` · `index.maybeUnlockTray` |
| 固定图标 + 横滑 | BB2 思路：preferred 尺寸不缩；track `translateX` | `trayMetrics` · `domBoard` · `input` |
| 补位 FLIP | 拿起后剩余槽从旧屏位滑到新位（排除 `data-tray-picking`） | `domBoard.playTrayFlip` |
| 入场动画 | `.tray-item-enter` 打在 `.prop-sprite`；`.is-tray-entering` 放开 overflow | `style.css` |

### 2.4 扫描震动（沿用 v0.6）

真源：`docs/HAPTICS_SPEC.md` · 模块：`feel/haptic-*` · `scan-haptics` · 原生 `plugins/native-haptics`  
定稿参数见 `haptic-config.ts`（开灯 / 底噪 / 近鬼 / 蓄光 / 过格 / 出场三连 mute）。

### 2.5 拍照会话（v0.8）

| 项 | 说明 | 代码 |
|----|------|------|
| 相位 | Playing → Camera → Capturing → Won | `SessionPhase` · `index.ts` |
| 进 Camera | `allRevealed` 且无 drag（R21） | `maybeEnterCamera` |
| UI | `camera-frame.png` + 绘制快门/返回 | `cameraSession.ts` |
| 截屏 | SnapDOM clip 棋盘±pad；光 bake screen；失败回 Camera | `captureBoard.ts` |
| 仪式 | 先截 → 闪白 → 假岛吐拍立得 → 黑底结算 | `cameraSession` + CSS |
| 返回 | 回 Playing；仍全显再进 | `onReturnFromCamera` |
| 再玩一次 | `restart()` | Won 按钮 |
| Camera 无重制 | HUD 重制隐藏 | `setPlayLock` |

### 2.6 其它保留

| 项 | 说明 |
|----|------|
| 重制 | HUD · `loadLevel` · 清 tray scroll（仅 Playing） |
| 手感2 | `DRAG_OFFSET_Y = -1` |
| 鬼 Additive | `.ghost-lit-add` plus-lighter（Revealed） |

---

## 3. 模块地图（`src/game`）

```
src/game/
  index.ts              # mountGame · resolve（A1 跟手 + lit）· dwell · restart
  types.ts · board.ts · ghosts.ts · optics.ts · level.ts
  levels/level_001.json # 1 灯 + 3 镜 · 中心墙 · 四鬼
  layout.ts             # BOARD_LAYOUT · TRAY_LAYOUT
  trayMetrics.ts        # 槽尺寸 · scroll · 横滑阈值
  propStyle.ts          # 四层道具尺度 SSOT
  viewStyle.ts          # 光斑/beam/鬼/snap 表现
  input.ts              # 托盘横滑/拖出 · 盘上拖/旋
  feel/
    defaults.ts · drag-session.ts
    haptic-config.ts · haptic-math.ts · haptic-patterns.ts
    scan-haptics.ts
  view/
    domBoard.ts         # 壳 · 鬼层 · 托盘 track · FLIP · 重制
    lightFx.ts          # freeShine · 放置折线 · snap
    cameraSession.ts    # 取景 · 快门/返回 · 闪白 · 吐纸 · Won
    captureBoard.ts     # SnapDOM clip 合影
    ghostIdle.ts · propTuner.ts · hapticTuner.ts
```

### DOM（玩法）

```
#ui-root.game-ui
  .stage-bg
  #hud · #btn-restart
  #board-hit
    .board-grid
    .board-ghost-layer
  #tray.game-tray-bare          ← 视口 overflow hidden
    .tray-track                 ← flex 槽 + translateX 滚动
      .tray-item[.tray-item-enter]
  #drag-layer
  .board-light-canvas
  #prop-tuner* · #haptic-tuner*
```

---

## 4. 规格对应

| 主题 | 规格 | 状态 |
|------|------|------|
| 鬼 + dwell | OPTICS R07 | 已落地 |
| 镜反射 | OPTICS R02 · 代码标定表 | 已落地 |
| 拖灯 A1 / 放置光 / snap | **INTERACTION R11** | v0.5 文档已对齐 |
| 托盘解锁 / 横滑 / FLIP | **INTERACTION R10** | v0.5 文档已对齐 |
| 落格门禁 | INTERACTION R10 手电门禁 | 已落地 |
| 震动 | HAPTICS_SPEC | 已落地 |
| 重开 | INTERACTION R15 | 已落地 |
| 拍照会话 | INTERACTION R13 · Capturing | **v0.8 已落地** |
| 资源 | ASSETS.md | 镜双图 + camera-frame |

---

## 5. 未做 / 下一步

| 优先级 | 项 |
|--------|-----|
| 手感 | 找全瞬间短→长 / 落盘跳变 · 可选软过渡 |
| 合影 | 截屏真机调参 · 吐纸手感 · 可选慢显影 |
| 关卡 | 多关 JSON · 关卡选择 |
| 道具 | 半透 / 漫射正式美术与逻辑 UI |
| 音频 | SFX |
| 平台 | Android |

---

## 6. 文档维护约定（规范）

| 变更类型 | 更新哪些 |
|----------|----------|
| 玩法 / 胜负 / 鬼 | `PRODUCT.md` → OPTICS / INTERACTION → 码 |
| 光路 / 反射表 | `OPTICS_SPEC.md` → `optics.ts` |
| 拖放 / 托盘 / 扫描表现 / A1 | `INTERACTION_SPEC.md` → `input` / `lightFx` / `domBoard` |
| 扫描震动 | `HAPTICS_SPEC.md` → `feel/haptic-*` |
| 资源路径 | `ASSETS.md` + `public/` |
| **做完了什么** | **本文 PROGRESS** + 必要时 `IMPLEMENTATION_TODO` |
| 工程坑 | `ENGINEERING.md` |
| 启动 / DOM 硬约定 | `AGENTS.md` · `ENTRYPOINTS.md` |
| 索引与读写规则 | `docs/README.md` |

**原则：**

1. **规则真源**在 PRODUCT / SPEC；PROGRESS **不发明规则**，只记落地与模块。  
2. 改行为：先改对应 SPEC 一句，再改码，再改 PROGRESS 一行。  
3. 大版本：PROGRESS 升 `v0.x` + 修订表；SPEC 各自升补丁版本。  
4. 过时交接文（如 HANDOFF_STEP1）不删，但以 PROGRESS 为准。

---

## 修订

| 版本 | 说明 |
|------|------|
| v0.4 | Step1 光效/鬼动画/dwell/鬼层 |
| v0.5 | S3.1 震动全链路 + 重制 + 原生注册 |
| v0.6 | 蓄光 continuous；出场 mute；手感2 Y=-1 |
| **v0.7** | 镜+折线；托盘解锁/横滑/FLIP/入场；拖灯 **A1 跟手统一**；文档规范 |
| **v0.8** | **Camera 会话**：取景 UI、截屏、闪白、吐拍立得、结算再玩；R13 Capturing |
