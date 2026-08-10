# 实现进度 · 修改总览

| | |
|--|--|
| 版本 | **v0.9** |
| 日期 | 2026-08-10 |
| 范围 | Slice 0 · 找鬼布光 · **Camera/吐相/结算** · 放置震动 · 镜投影朝向 · 拖回托盘 |
| 真源优先级 | **PRODUCT** → **OPTICS** → **INTERACTION** → **HAPTICS** → 本文（仅进度索引，不改规则） |

> **用法：** 新会话先扫本文「当前可玩」与「本轮已落地」；改规则改 SPEC，再改码。

---

## 1. 当前可玩状态

1. **5×5** 木格 + 全屏 `board-bg` 竖屏舞台（390×844）
2. **托盘**  
   - 开局仅 **手电**；**全鬼 everLit 后** 镜等滑入  
   - 固定图标尺寸 + 横滑 + FLIP 补位 + 解锁入场滑入  
   - **盘上道具可拖回托盘**（松手在托盘视口）；盘外取消回原格  
3. **拖灯 A1**：全程跟手 beam+glow；未找全短距；找全后可长距；落盘才格心折线  
4. **落格门禁**：未找全禁止 light 落格；镜解锁后可放  
5. **镜**  
   - 双贴图；`MIRROR_REFLECT`；点旋 90°  
   - **拖动投影**：自动选 facing，使进光/出光两正面在盘内；点旋仍 4 档循环  
6. **鬼**：dwell 1s 出场；独立层 + 待机  
7. **扫描震动** + **放置震动**（镜投影换格 / 可落格手电投影 / 点旋）  
8. **HUD 弱提示**  
   - 扫描：`拿起手电找到全部的鬼魂。`  
   - 摆放：`设计路线，让所有鬼魂站光里。`  
   - 关卡标题隐藏  
9. **拍照会话（闭环）**  
   - 全员 Revealed 且无 drag → Camera  
   - 快门：闪白（下垫半透蒙黑）→ 截屏 → 假岛吐拍立得 → 飞终点 → 结算  
   - 返回 / 再玩一次；Camera 无重制  
10. **调参**  
    - 左下 📳 震动（显示）  
    - 挑战结算 / 岛 / prop 调参代码仍在，默认 **CSS 隐藏**（不挂载或 `display:none`）

**明确未做：** 半透/漫射正式 UI、多关、音效、Android、系统灵动岛。

---

## 2. 本轮（v0.9）整理 · 按主题

### 2.1 拍照 / 截屏 / 吐纸 / 结算

| 项 | 说明 | 代码 |
|----|------|------|
| 相位 | Playing → Camera → Capturing → Won | `SessionPhase` · `index` |
| 进 Camera | `allRevealed` 且无 drag（R21） | `maybeEnterCamera` |
| 取景 UI | `camera-frame.png`；进场 1.5→1 单曲线 scale≥1；控件入场后再显 | `cameraSession` · CSS |
| 闪白 | 渐入 200ms · 最短 hold 320ms · **淡出 300ms** | `playCapture` |
| 蒙黑垫底 | **Capturing 即显示** print-mask（闪白 z 下），淡出不断档 | CSS `is-capturing` |
| 会话可见 | **`is-printing` 必须可见**（吐纸时去掉 capturing） | `.camera-session.is-printing` |
| 截屏 | 移动端优先 composite；`canCommitDrop` 同步；光 bake；排除 camera/调参 | `captureBoard` |
| 吐纸 | 岛上下半 + Mask clip 滑出 → FLIP 飞终点（中心 origin + 旋转） | `printLayout` · CSS |
| 结算一体 | 同一 print 层：半透蒙黑 + 终点相纸 +「抓到了」+「再玩一次」 | `print-settle` |
| 布局 SSOT | 照片/标题/按钮位置尺寸旋转字号 | `printLayout.DEFAULT_PRINT_LAYOUT` |
| 再玩 | 取消 WAAPI/CSS fill，`resetPolaroidForPrint` | `cameraSession` |

**闪白时序（正常）：** 最短约 200+320+300 ≈ **820ms**（截屏更久则白屏更久）。

**结算默认（design 390×844）：** 照片 330 中心 (195,385) 转 -6°；标题 (195,166) 字 40；再玩 (195,653) 字 22 高 55 宽 212。

### 2.2 扫描 / 放置震动

| 项 | 说明 | 代码 |
|----|------|------|
| 扫描会话 | 开灯 → continuous 底噪/近鬼/蓄光线性 → 过鬼格 → 出场三连 mute | `scan-haptics` |
| **扫描不震换格** | 光斑普通格切换 **无** lightProj；仅过未发现鬼格 ghostPass | `maybeGhostPass` |
| 手电投影换格 | 仅 **可落格** 吸附时（找全后 `drag.cell`） | `placement-haptics` |
| 镜子投影换格 | 拖镜吸附格变化 | `placement-haptics` |
| 点旋 | 旋转成功一次 transient | `onRotate` |
| 调参 | 左下 📳；参数 `SCAN_HAPTIC` | `haptic-config` · `hapticTuner` |
| Web | continuous 失败 → pulse fallback（控制台 warn 正常） | `scan-haptics` |

真源条文：`HAPTICS_SPEC` v1.3；默认数值见该文 §6 / `haptic-config.ts`。

### 2.3 镜投影自动朝向（仅拖动）

| 项 | 说明 | 代码 |
|----|------|------|
| 规则 | 两正面外侧邻格须在盘内（`MIRROR_FRONT_OUT`） | `optics.ts` |
| 时机 | **未松手** 投影格变化时 `pickMirrorFacingForCell` | `input.syncGhostFromSession` |
| 选角 | 优先当前 facing，否则 CW 试 1～3 | `pickMirrorFacingForCell` |
| 点旋 | **不变**：仍 +90°，不过滤合法性 | `rotatePropAt` |

### 2.4 拖回托盘

| 项 | 说明 | 代码 |
|----|------|------|
| 判定 | 松手 design 点在 `TRAY_LAYOUT` 视口 | `layout.isPointInTray` |
| 盘上 → 托盘 | `removeProp` + `returnToTray` | `onReturnToTray` |
| 盘外取消 | 盘上来源回原格（拖起未真正 remove）；托盘来源回托盘 | `onCancelDrag` |
| 锁定道具 | 不可拖起（原逻辑） | `input` `!occ.locked` |

### 2.5 UI 文案与调参可见性

| 项 | 说明 |
|----|------|
| 弱提示 | 扫描 / 摆放两句见 §1.8；样式未改弱化 |
| 标题 | 关卡 title 隐藏 |
| 震动 FAB | 显示 |
| prop / island / 挑战结算 | 隐藏（代码保留 `settleTuner` 等） |

### 2.6 历史已落地（v0.7 摘要）

拖灯 A1、镜双图+折线、托盘解锁/横滑/FLIP、扫描 dwell/震动基线 — 见修订表 v0.7。

---

## 3. 模块地图（`src/game`）

```
src/game/
  index.ts                 # mountGame · resolve · 会话 · 拖回托盘 · 提示文案
  types.ts · board.ts · ghosts.ts · optics.ts · level.ts
  levels/level_001.json
  layout.ts                # BOARD · TRAY · isPointInTray
  trayMetrics.ts · propStyle.ts · viewStyle.ts
  printLayout.ts           # 岛/Mask/吐纸/结算 SSOT + CSS vars
  input.ts                 # 拖放 · 镜投影 facing · 回托盘松手 · canCommitDrop 同步
  feel/
    defaults.ts · drag-session.ts
    haptic-config.ts · haptic-math.ts · haptic-patterns.ts
    scan-haptics.ts        # 扫描 continuous / 过鬼 / 出场
    placement-haptics.ts   # 投影换格 · 点旋
  view/
    domBoard.ts · lightFx.ts · ghostIdle.ts
    cameraSession.ts       # 取景 · 闪白 · 吐纸 · 结算 · 预览
    captureBoard.ts        # 截屏 composite / snapdom
    hapticTuner.ts         # 📳（显示）
    settleTuner.ts · islandTuner.ts · propTuner.ts  # 保留，默认隐藏
```

### DOM（玩法 + 会话）

```
#ui-root.game-ui
  .stage-bg
  #hud · .game-hint · #btn-restart
  #board-hit · .board-grid · .board-ghost-layer
  #tray · .tray-track
  #drag-layer · .board-light-canvas
  .camera-session          # z=40；is-camera|capturing|printing|won 可见
    .camera-chrome · .camera-controls · .camera-flash(z55)
    .print-layer(z50) · .print-mask · 岛 · eject · polaroid · .print-settle
  #haptic-tuner-fab · #haptic-tuner
```

---

## 4. 规格对应

| 主题 | 规格 | 状态 |
|------|------|------|
| 鬼 + dwell | OPTICS R07 | 已落地 |
| 镜反射 + 拖动合法朝向 | OPTICS R02 + 补 | 已落地 |
| 拖灯 A1 / 放置光 | INTERACTION R11 | 已落地 |
| 托盘 / 拖回托盘 | INTERACTION R10 | **v0.9** |
| 落格门禁 | INTERACTION R10 | 已落地 |
| 扫描 + 放置震动 | HAPTICS_SPEC | **v1.3** |
| 拍照会话 / 吐纸 / 结算 | INTERACTION R13 | **v0.9 细化** |
| 弱提示文案 | INTERACTION R24 | **v0.9** |
| 资源 | ASSETS.md | camera-frame + 镜双图 |

---

## 5. 未做 / 下一步

| 优先级 | 项 |
|--------|-----|
| 手感 | 找全瞬间短→长可选软过渡 |
| 合影 | 真机进一步压截屏耗时；吐纸曲线微调 |
| 关卡 | 多关 JSON · 选关 |
| 道具 | 半透 / 漫射 |
| 音频 | SFX |
| 平台 | Android |

---

## 6. 文档维护约定

| 变更类型 | 更新哪些 |
|----------|----------|
| 玩法 / 胜负 / 鬼 | `PRODUCT.md` → OPTICS / INTERACTION → 码 |
| 光路 / 反射 / 镜朝向 | `OPTICS_SPEC.md` → `optics.ts` |
| 拖放 / 托盘 / 相机会话 | `INTERACTION_SPEC.md` → `input` / `cameraSession` |
| 震动 | `HAPTICS_SPEC.md` → `feel/*` |
| 资源 | `ASSETS.md` |
| **做完了什么** | **本文 PROGRESS** |
| 工程坑 | `ENGINEERING.md` |
| 启动 / DOM | `AGENTS.md` · `ENTRYPOINTS.md` |

---

## 修订

| 版本 | 说明 |
|------|------|
| v0.4–v0.6 | 光效/鬼/dwell/震动基线 |
| v0.7 | 镜+折线；托盘解锁/横滑；拖灯 A1 |
| v0.8 | Camera 会话初版 |
| **v0.9** | 闪白+蒙黑不断档；吐纸可见性修复；结算布局定稿；放置震动；扫描禁换格震；镜拖投影合法朝向；拖回托盘；弱提示；调参显隐；文档全量整理 |
