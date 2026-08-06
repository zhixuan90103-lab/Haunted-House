# 交互与会话规格（检索 R09–R15 · R21–R24）

| | |
|--|--|
| 版本 | **v0.1** |
| 状态 | **第 2、3 轮检索冻结** |
| 依赖 | `PRODUCT.md`、`OPTICS_SPEC.md`、`adapt/design.ts` |

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
  #tray         底部托盘
  #hud          重开等
  #camera-modal 全屏层，锁盘时显示
```

Canvas 可 `pointer-events: none`，输入只走 `#board-hit` + tray，避免和 WebGPU 争事件。

### 拖放状态机

```
Idle
  → pointerdown on tray item → DragFromTray { type, facing: default }
  → pointerdown on board prop → DragBoard { id }  (锁盘时禁用)
Drag*
  → pointermove → 更新 design 位；尝试 designToCell + canPlace
  → pointerup 合法格 → place / move；重算 optics + ghosts
  → pointerup 非法/盘外 → 回托盘或回原格
Idle
  → click (无显著移动) on board prop → rotateCW facing；重算
```

### 点击 vs 拖动阈值

```ts
const DRAG_THRESHOLD_PX = 8  // 设计坐标
// 若 total movement < threshold 且 target 为盘上道具 → 视为 click 旋转
// 从托盘始终为 drag 意图；短移动松手在盘外 = 取消
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
  盘面输入锁定
  [拍照] → 全员 Caught；phase = Won
  [返回] → phase = Playing；不重置 everLit
  // 若返回后仍 allRevealed：下一帧 resolve 再进 Camera（正确）

Won
  显示过关；输入锁定（除「下一关/重开」）
  [重开] → 全量 reset → Playing
```

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
  resolve()
```

不要依赖「撤销栈」做重开。

---

## R11 · 光路表现（Slice 0 最小）

| 方案 | 选用 |
|------|------|
| A. 仅亮格色块 | **Slice 0 采用** |
| B. 光束线段 mesh | Slice 1+ 可选 |
| C. 全屏后处理光 | 不做 |

- 逻辑 `lit` → view 每格 emissive/颜色。  
- 鬼：Hidden 不渲染或全透明不可见；Revealed 实心；Transparent 半透；Caught 特殊。  
- 道具：简单几何或 emoji/图标纹理即可。

**渲染路径：** OrthographicCamera 俯视，xy 平面铺格；**或** 纯 DOM/CSS grid 画盘（更快出片）。  
**Slice 0 决策：DOM/CSS 棋盘 + ui-root 交互优先**；Three 可只作背景氛围或暂时不用盘面。  
（底座 WebGPU 保留；玩法不阻塞在 3D。）

若坚持 Three 盘面：同样正交俯视，格 = PlaneGeometry。

---

## R12 · 震动

```ts
// 仅当拖着 light 且 cell 吸附合法时
// 用 light 前方「光锥」最近鬼距，或 lit 预览下到鬼的距离

function hapticFromLight(lightCell, dir, ghosts, board):
  // 简化：沿 dir 扫描直到墙/出界，看是否碰到鬼格
  // 或：computeLit 后，对每个 Hidden/Transparent 鬼，若在 lit 中 → 强震一次 edge
  // PRODUCT：光越近越强

  minDist = min over ghosts of manhattan( light front cells, ghost )
  if minDist == 0: haptics.heavy() // 或 medium
  else if minDist == 1: haptics.medium()
  else if minDist <= 3: haptics.light()
  // throttle 100–150ms
```

- 无鬼/太远：不震。  
- 锁盘/Won：不震。  
- 调用现有 `haptics` API，失败静默。

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
| Playing | 托盘 + 重开 |
| Camera | 遮罩 +「拍照」+「返回」 |
| Won | 「抓到了！」+ 重开 |

无失败相位；仅未过关。

---

## 修订

| 版本 | 说明 |
|------|------|
| v0.1 | R09–R15、R21–R24 冻结 |
