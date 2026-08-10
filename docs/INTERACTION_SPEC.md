# 交互与会话规格（检索 R09–R15 · R21–R24）

| | |
|--|--|
| 版本 | **v0.6** |
| 状态 | 冻结基线 + A1 + 托盘/拖回 + Camera 吐纸结算 + 镜拖投影朝向 |
| 依赖 | `PRODUCT.md`、`OPTICS_SPEC.md`、`adapt/design.ts` |
| 进度索引 | `PROGRESS.md`（已落地以进度文为准） |

---

## R09 · 设计坐标 → 格索引

### 管道

```
pointer event (clientX, clientY)
  → stage.getBoundingClientRect() 得 stageOrigin
  → clientToDesign(clientX, clientY, layout, originX, originY)
  → design (dx, dy) ∈ 设计空间
  → 若 !isInDesignBounds(dx,dy) → 忽略（letterbox）
  → 若在棋盘像素矩形 boardRect 内 → 格坐标
  → 否则若在托盘 hit 区 → 托盘逻辑
```

### 棋盘矩形（设计 px，Slice 0 建议）

在 390×844 内预留 UI：

```ts
// 建议值，可调；实现用常量 BOARD_LAYOUT
const BOARD_LAYOUT = {
  // 居中偏上的正方形格网区域
  left: 35,      // (390 - 320) / 2
  top: 120,
  size: 320,     // 外框边长
  cols: 5,
  rows: 5,
  // 内边距后可用区
  padding: 8,
}

function cellSize(): number {
  return (BOARD_LAYOUT.size - BOARD_LAYOUT.padding * 2) / BOARD_LAYOUT.cols
}

function designToCell(dx: number, dy: number): { x: number; y: number } | null {
  const { left, top, size, padding, cols, rows } = BOARD_LAYOUT
  const ix = dx - left - padding
  const iy = dy - top - padding
  const usable = size - padding * 2
  if (ix < 0 || iy < 0 || ix >= usable || iy >= usable) return null
  const cs = usable / cols
  const x = Math.floor(ix / cs)
  const y = Math.floor(iy / cs)
  if (x < 0 || y < 0 || x >= cols || y >= rows) return null
  return { x, y }
}

function cellToDesignCenter(x: number, y: number): { dx: number; dy: number } {
  const cs = cellSize()
  return {
    dx: BOARD_LAYOUT.left + BOARD_LAYOUT.padding + (x + 0.5) * cs,
    dy: BOARD_LAYOUT.top + BOARD_LAYOUT.padding + (y + 0.5) * cs,
  }
}
```

### 吸附

- 拖动中：`designToCell` 非 null 且 `canPlace` → 幽灵吸附该格中心。  
- 非法格：幽灵无格 / 半透明禁止态，松手取消。

### Three 拾取（若用 3D 格）

- **Slice 0 推荐**：逻辑与 UI 全用设计 2D 坐标；Three 只跟 `board` 状态画，**不**用 raycaster 反查（少坑）。  
- 若 3D 拾取：正交相机 + 平面 unproject，结果仍落到同一 `designToCell`。

---

## R10 · 托盘与指针事件

### DOM 分工

| 区域 | 元素 | 事件 |
|------|------|------|
| 棋盘表现 | `#stage` canvas 或 board 层 | 可收 pointer；或透明 overlay 在 ui-root |
| 托盘 / 按钮 | `#ui-root` | 必收 pointer |
| 设备框 | 外层 | 不参与玩法 |

**推荐：** `#ui-root` 内：

```
#ui-root
  #board-hit    position absolute，覆盖棋盘设计矩形，pointer-events auto
  #tray         底部托盘视口（overflow hidden）
    .tray-track 内容轨（flex + translateX 横滑）
  #hud          重开等
  #camera-modal 全屏层，锁盘时显示
```

Canvas 可 `pointer-events: none`，输入只走 `#board-hit` + tray，避免和 WebGPU 争事件。

### 托盘内容与解锁

| 阶段 | 托盘内容 |
|------|----------|
| 开局 | 仅 `def.tray` 中的 **light**（`initialTray`） |
| 全鬼 `everLit` 一次 | 按 `TRAY_UNLOCK_ON_ALL_FOUND` 从 def 补入 mirror 等 + **滑入动画** |

### 托盘几何（对齐 BB2 思路 · DOM）

- 图标尺寸 = `traySlotScale`（% 格），**不**为塞进一屏缩小。  
- 内容窄：track pad 居中；内容宽：可横滑 `scrollX ∈ [0, contentW - viewW]`。  
- 真源：`trayMetrics.ts` · 容器框 `TRAY_LAYOUT`。

### 托盘指针（横滑 vs 拖出）

```
pointerdown on #tray
  → 武装 pending（点在 item 则记 type；空白也可横滑）
  → 明显横移且可滑 → SCROLL（排除 picking 标记，不 take）
  → 位移过 DRAG_THRESHOLD 且非纯横 → takeFromTray + DRAG
  → 轻点几乎未移 → 不 take
```

- 拿起时剩余槽 **FLIP 补位**（`data-tray-picking` 排除被拿起那颗）。  
- 解锁入场：`.tray-item-enter` 打在 `.prop-sprite`；入场期间 tray `.is-tray-entering` 临时 `overflow:visible`。

### 拖放状态机

```
Idle
  → pointerdown on tray item（过阈值）→ DragFromTray { type, facing: default }
  → pointerdown on board prop（!locked）→ DragBoard { id, fromCell }  (锁盘时禁用)
Drag*
  → pointermove → 更新 design 位；designToCell + canPlace + canCommitDrop
  → 镜：若 cell 合法 → pickMirrorFacingForCell（两正面在盘内；仅拖动投影）
  → pointerup 合法格且不在托盘视口 → place / move
  → pointerup 在托盘视口（isPointInTray）→ 盘上：removeProp + returnToTray；托盘源：returnToTray
  → pointerup 非法/盘外（非托盘）→ 托盘源回托盘；盘上源回原格（拖起未 remove）
Idle
  → click (无显著移动) on board prop → rotateCW facing（固定 +90°，不过滤边角）；重算
```

### 拖回托盘（v0.6）

- 判定：松手 **design 坐标** ∈ `TRAY_LAYOUT`（`layout.isPointInTray`）。  
- 盘上来源：`removeProp(fromCell)` + `returnToTray(type)`。  
- 托盘来源未落格：仍 `returnToTray`。  
- **锁定道具**不可拖起，故无拖回。  
- 实现：`input.endPointer` → `onReturnToTray` / `onCancelDrag`（`index.ts`）。

### 手电落格门禁（设计）

- **未全部找到**（存在 `!everLit` 的鬼）时：`light` **禁止** `canCommitDrop` → 不吸附、松手回托盘；扫描光/震动照旧。  
- **全部 everLit 后**：才允许把手电放到空格；落格精灵锚在**格心**。  
- 镜等：解锁进托盘后可落格（不受「先找鬼」限制）。  
- **实现注意**：`syncGhostFromSession` 在 pointermove / rAF **必须**传入 `canCommitDrop`，否则扫描期 light 误吸附并误触投影换格震动。

### 点击 vs 拖动阈值

```ts
const DRAG_THRESHOLD_PX = 8  // 设计坐标
// 若 total movement < threshold 且 target 为盘上道具 → 视为 click 旋转
// 托盘：需过阈值才 take；短点不拿起
```

### 默认朝向

- 从托盘拖出：`facing = 0`，光源 `dir` 初值 **E（Dir.E）**（与 facing 分离：light 用 `dir`，镜用 `facing`）。  
- **澄清**：光源朝向用 `Dir`；镜/半透用 `facing 0..3`。实现上 light 的 `facing` 可与 `Dir` 同值 0..3。

### 锁盘时

- 禁止：拖托盘、拖盘上道具、旋转、重开可保留或禁用（**允许重开**）。  
- 仅：`拍照`、`返回`。

### 禁用 OrbitControls

- 玩法模式**不**挂载 OrbitControls（或 completely enabled=false）。

---

## R13 / R21 · 会话与相机状态机

```ts
enum SessionPhase {
  Playing = 'playing',
  Camera = 'camera',
  Capturing = 'capturing', // 快门后：闪白+截屏→吐纸→结算
  Won = 'won',
}
```

```
Playing
  on each resolve():
    optics → stepGhosts
    if allRevealed():
      // R21：若正在 pointer 拖动中，推迟到 pointerup 后再判定
      if !isDragging: phase = Camera

Camera
  盘面输入锁定；隐藏「重制」；隐藏 .game-hint
  取景 UI：camera-frame.png + 快门（底中）+ 返回（左，无字）
  进场：chrome 1.5→1 单曲线 scale≥1；控件入场结束后再 reveal
  [拍照] → phase = Capturing → playCapture()
  [返回] → phase = Playing；不重置 everLit
  // 若返回后仍 allRevealed：下一帧 resolve 再进 Camera（正确）

Capturing（playCapture 时序）
  1. is-capturing：藏 chrome；print-mask 半透蒙黑已在；flash 全白 hold
  2. 后台截屏（captureBoard；排除 .camera-session）
  3. 闪白淡出（默认 300ms）；蒙黑已垫底 → 无断档
  4. 去 is-capturing + is-printing（会话层须对 is-printing 可见）
  5. 假岛 Mask 内滑出相纸 → FLIP 飞终点（可带 finalRotateDeg）
  6. is-won：终点相纸 +「抓到了」+「再玩一次」
  截失败：回 Camera（不写 Caught）

Won
  与打印同一 print-layer（蒙黑+相纸+文案按钮）
  [再玩一次] → restart() 全量 reset → Playing
  再玩须 resetPolaroid / 取消 fill:forwards 动画残留
```

### Capturing / 吐纸实现要点

| 项 | 约定 |
|----|------|
| 闪白 | 渐入 ~200ms · 最短 hold ~320ms · 淡出 **300ms**（`prefers-reduced-motion` 更短） |
| 蒙黑 | `rgba(0,0,0,0.72)`；Capturing 起显示在 flash 下 |
| 可见性 | `.camera-session.is-printing` 与 camera/capturing/won **同为 opacity:1**（否则吐纸不可见） |
| 布局 SSOT | `printLayout.ts` → CSS vars（终点位置/旋转/标题/按钮字号尺寸） |
| 模块 | `cameraSession.ts` · `captureBoard.ts` · `printLayout.ts` · `style.css` |

### R21 拖动中全员显示

- **禁止**在 `pointerdown` 未 `pointerup` 时进 Camera（避免拖着灯误锁）。  
- `pointerup` 成功放置后 `resolve()`，再检查 allRevealed。

### 防抖

- `allRevealed` 连续 1 帧即可（5×5 无物理抖动）；无需长时间 debounce。  
- 若动画插值导致 lit 闪烁：以**逻辑格 lit** 为准，不跟表现插值。

---

## R14 · 关卡 JSON Schema（Slice 0/1）

```ts
type LevelDef = {
  id: string
  title?: string
  intent?: string
  board: { width: number; height: number }  // default 5,5
  walls: Array<{ x: number; y: number }>
  ghosts: Array<{ id: string; x: number; y: number }>
  tray: Array<{
    type: 'light' | 'mirror' | 'beam_splitter' | 'diffuser'
    count: number
    // 可选预置 facing 池，默认 0
  }>
  // 可选：开局锁在盘上的场景镜等（非托盘）
  lockedProps?: Array<{
    type: 'mirror' | 'beam_splitter' | 'diffuser' | 'light'
    x: number
    y: number
    facing: 0 | 1 | 2 | 3
    locked: true
  }>
  difficulty?: number
  tags?: string[]
  teaches?: string[]
  requires?: string[]
}
```

校验加载时：

- 鬼不重叠、不在墙上  
- tray count ≥ 0  
- lockedProps 可放置  

对齐 `LEVEL_DESIGN.md` §7；文件放 `src/game/levels/*.json`。

---

## R15 · 重开快照

```ts
// 加载关卡时
initialSnapshot = deepClone({ walls, ghosts初始, tray, lockedProps })

function restart():
  board = fromSnapshot(initialSnapshot)
  phase = Playing
  drag = null
  // ghosts: Hidden, everLit false
  // tray 恢复 count
  // scanHaptics.end()
  resolve()
```

不要依赖「撤销栈」做重开。

**当前实现：** HUD「重制」→ `loadLevel(level_001)` + `resetGhostAppear` + `scanHaptics.end()`（单关硬编码；多关后改为当前 def 快照）。

---

## R11 · 光路表现（Slice 0 · A1）

| 方案 | 选用 |
|------|------|
| A. 仅亮格色块 | 逻辑 lit 可有；当前格高亮可透明 |
| B. 光效贴图 | **采用**（拖灯跟手 + 放置折线） |
| C. 全屏后处理光 | 不做 |

### R11.1 拖灯 · A1 跟手照射（统一）

**目标：** 全程像拿手电照，**不**在「可吸附」时切换另一套锚格预览光。

| 层 | 规则 |
|----|------|
| **光斑中心** | 永远相对手电 `designX/Y` 连续跟手（沿 facing）；**不吸格心** |
| **连接** | 灯头锚点 → 前方；长度 = 灯心→光斑距离 |
| **长度算法** | `freeShineLengthPx`：沿 facing 格走，遇墙停、道具停在该格、否则到盘边；再与盘缘投影取 min |
| **短距 / 长距** | **未全 everLit**：再 cap `glowForward×格`；**全 everLit 后**：可用满环境长度（仍跟手） |
| **可放** | 仅多画 `snap-frame`（吸附格）；**不**改 beam/glow 算法 |
| **落盘** | 才切 R11.2 格心放置光 |

**逻辑 lit（可与表现分离）：**

- 无合法吸附：光斑 `designToCell` 至多 1 格 + 已放灯并集。  
- 有吸附且已找全：按**吸附格** + facing 做完整 `computeLit`（可经镜），供预览亮哪些格。  

**表现载体：** `board-light-canvas` 全 design；`plus-lighter`；参数 `VIEW_STYLE`。

### R11.2 放置态（已落盘 light）

- 完整 `computeLit`；多 light 并集；光源格本身不亮。  
- **发射表现：** 每盏盘上 light：  
  - `castReflectingLightPath`（空/鬼继续，墙挡，镜折，其它挡）  
  - 折线 segments 画 beam；**光斑在最后一段尽头亮格中心**  
  - 绘制 **clip 在棋盘外框内**（大光斑/加长 beam 不画出盘外）  
  - 正被拖起的灯不画放置发射  
- **镜贴图：** 托盘/拿起 `prop-mirror-tray.png`；盘上/投影 `prop-mirror-board.png` + facing×90（资源自带斜面，不另拧反射角）  
- 镜光学表见 OPTICS R02 / 代码 `MIRROR_REFLECT`（标定：3↔4 正面）。

### R11.3 鬼表现

| 状态 | 表现 |
|------|------|
| Hidden | 不挂 DOM |
| Revealed / Transparent | `ghost.png`；Transparent 用 CSS opacity |
| 首次出场 | CSS 入场 640ms（S&S + 后仰 + 微左右拧/移）→ smoothstep 接待机 |
| 待机 | rAF：bob + 轻 squash；质心 `ghostPivotY`（默认贴图中心 50%） |

- **DOM：** `.board-ghost-layer` 与 grid 同框；鬼节点池复用，**禁止**每帧销毁重建。  
- **尺寸：** `cellSize × ghostSize%`（`--ghost-box`），不是相对整层棋盘。  
- **用语：** 只说 **图片左/右**（CSS ±X），不说「鬼的左/右」。

**渲染路径：** **DOM/CSS 棋盘 + ui-root**（已定）；Three 仅底座/可选氛围。

---

## R12 · 震动（扫描会话）

**真源设计：** `docs/HAPTICS_SPEC.md`（会话边界、近鬼线性、过格、出场三连、模块分层）。

**范围：** 仅握 `light` 扫描；放置灯不震；已发现鬼（everLit）不参与近距/过格。

| 事件 | 摘要 |
|------|------|
| 开灯 | 1× transient → 延迟 → continuous 底噪 |
| 近鬼 | 未发现鬼曼哈顿线性 floor→peak |
| 蓄光 | 压未发现鬼格 1s：peak→chargePeak 线性（与 dwell 同钟） |
| 过格 | 换格进入未发现鬼格 → 轻 transient |
| 出场 | everLit 上升沿 → mute 底噪 → 3× 瞬态 → 恢复底噪 |
| 关灯 | stop continuous |

实现：`feel/haptic-{config,math,patterns}.ts` · `scan-haptics.ts` · `hapticTuner`

---

## R22 · 双坐标系（补漏）

| 空间 | 用途 |
|------|------|
| client | 事件 |
| design 390×844 | UI、托盘、boardRect |
| cell | 逻辑 optics |
| three 本地 | 仅 view 同步 |

禁止混用 client 直接算格。

---

## R23 · 光源 dir 与镜 facing

| 道具 | 字段 | 旋转 |
|------|------|------|
| light | `dir: Dir` | click → `dir = rotateCW(dir)` |
| mirror / beam_splitter | `facing: 0..3` | click → `+1 % 4` |
| diffuser | `facing` 仅表现 | click → `+1 % 4` 反馈 |

---

## R24 · 胜负与 UI 文案（最小）

| 相位 | UI |
|------|-----|
| Playing | 托盘 + 重开 + **弱提示**（见下） |
| Camera | 取景框 + 快门 + 返回（无重制；藏提示） |
| Capturing | 闪白 + 蒙黑 + 吐拍立得 |
| Won | 蒙黑 + 合影 +「抓到了！」+「再玩一次」 |

### Playing 弱提示（`.game-hint`）

| 阶段 | 条件 | 文案 |
|------|------|------|
| 扫描 | `!trayUnlocked`（未全 everLit） | 拿起手电找到全部的鬼魂。 |
| 摆放 | `trayUnlocked` | 设计路线，让所有鬼魂站光里。 |

- 关卡 **title 不展示**（`titleEl.hidden`）。  
- 提示为弱引导，**不**承担规则说明全文。

无失败相位；仅未过关。

---

## 修订

| 版本 | 说明 |
|------|------|
| v0.1 | R09–R15、R21–R24 冻结 |
| v0.2 | R11 扫描光效/鬼层/入场待机；R12 标明未实现与换格勿默认震 |
| v0.3 | R12 指向 HAPTICS_SPEC（已实现）；R15 重制 UI 说明 |
| v0.4 | R13 增 Capturing；取景 UI / 截屏吐纸 / Camera 无重制 / Won 再玩一次 |
| v0.4 | R12 补蓄光 continuous、出场 mute 底噪 |
| v0.5 | R10 托盘解锁/横滑/FLIP；R11 **A1 跟手统一** + 放置 clip + 镜双图 |
| **v0.6** | R10 拖回托盘；R13 闪白+蒙黑/吐纸可见性/结算一体；镜拖投影朝向；R24 弱提示 |
