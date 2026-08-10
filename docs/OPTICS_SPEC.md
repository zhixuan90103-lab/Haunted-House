# 光路与状态算法规格（检索结论 R01–R08）

| | |
|--|--|
| 版本 | **v0.4** |
| 状态 | **实现以代码 `optics.MIRROR_REFLECT` 为准**；与贴图标定同步 |
| 范围 | R01–R08 + 反查补丁（§补漏） |
| 非范围 | 斜向光、备选道具；交互见 `INTERACTION_SPEC.md` |
| 进度 | `PROGRESS.md` |

改算法先改本文 + `PRODUCT.md`，再改代码。

---

## 0. 约定

### 0.1 坐标

- 格：`x ∈ [0, W)`，`y ∈ [0, H)`，默认 `W=H=5`。  
- **x 向右增大，y 向下增大**（与常见 2D UI 一致；俯视渲染时注意相机）。  
- 一格中心用于表现吸附；逻辑只认整数格。

### 0.2 方向 `Dir`

```ts
enum Dir { N = 0, E = 1, S = 2, W = 3 }

const DELTA: Record<Dir, { dx: number; dy: number }> = {
  [Dir.N]: { dx: 0, dy: -1 },
  [Dir.E]: { dx: 1, dy: 0 },
  [Dir.S]: { dx: 0, dy: 1 },
  [Dir.W]: { dx: -1, dy: 0 },
}

function opposite(d: Dir): Dir { return (d + 2) % 4 }
function rotateCW(d: Dir): Dir { return (d + 1) % 4 }
```

**Slice 0/1 标准解仅使用四向。** 斜向不实现。

### 0.3 占格实体 `Occupant`

```ts
type Occupant =
  | { kind: 'wall' }
  | { kind: 'ghost'; id: string }
  | { kind: 'prop'; id: string; type: PropType; facing: 0|1|2|3 }
  | null  // 空
```

- **墙 / 道具 / 鬼** 互斥。  
- **光不占格**。

---

## R01 · 格点光路算法

### 数据结构

```ts
type Ray = { x: number; y: number; dir: Dir }
// 语义：光在格 (x,y) 内，正沿 dir 前进，下一步进入邻格

type OpticsInput = {
  width: number
  height: number
  // 查询
  get: (x: number, y: number) => Occupant
  lights: Array<{ x: number; y: number; dir: Dir }>  // 已放置或拖动幽灵位姿
}

type OpticsOutput = {
  lit: Set<string>           // key = `${x},${y}` 被照亮的格
  // 可选调试
  segments?: Array<{ x0,y0,x1,y1 }>
}
```

### 核心传播（伪代码）

```
function computeLit(input) -> OpticsOutput:
  lit = empty set
  queue = empty queue of Ray
  visited = empty set of (x, y, dir)   // 在该格以该方向「离开去下一步」时记录，防环

  for each light L in input.lights:
    // 光源格不亮；从光源沿 dir 迈出的第一格开始
    queue.push({ x: L.x, y: L.y, dir: L.dir })

  while queue not empty:
    ray = queue.pop()
    edgeKey = (ray.x, ray.y, ray.dir)
    if edgeKey in visited: continue
    visited.add(edgeKey)

    nx = ray.x + DELTA[ray.dir].dx
    ny = ray.y + DELTA[ray.dir].dy

    if not inBounds(nx, ny): continue

    occ = get(nx, ny)

    // --- 墙：停止，墙格不亮 ---
    if occ.kind == wall:
      continue

    // --- 鬼：亮，光穿过，方向不变 ---
    if occ.kind == ghost or occ == null:
      lit.add(nx, ny)
      queue.push({ x: nx, y: ny, dir: ray.dir })
      continue

    // --- 道具格：不亮；按类型处理 ---
    if occ.kind == prop:
      handleProp(occ, nx, ny, ray.dir, lit, queue)
      continue
```

### 进入邻格的语义

- 射线状态表示「从当前格沿 dir 射出」。  
- **首次进入**的目标格 ` (nx,ny) ` 才判断占用。  
- 光源起步：`ray` 放在光源格，第一次循环进入前方格。

### 复杂度

- 5×5、四向、边访问：`O(W*H*4 * 分支)`，可忽略。

---

## R02 · 基础镜 4 朝向映射表

### 模型：单面直角镜（实现标定 2026-08）

- 贴图本地边：`1=上 2=右 3=下 4=左`（随 facing×90 与盘上图同旋）。  
- **正面 = 3、4**；**背面 = 1、2**（背面挡光）。  
- 从 **3 进 → 折向 4**；从 **4 进 → 折向 3**。  
- `facing=0` 时本地=世界：1N 2E 3S 4W → 光行进 **N→W、E→S**。  
- `facing+1` 顺时针，整表方向 +90°。

每档只接受 **两个入射** 做 90° 反射；其余 **block**。

| facing | 入射 → 出射（实现表） |
|--------|----------------------|
| **0** | N→W，E→S |
| **1** | E→N，S→W |
| **2** | S→E，W→N |
| **3** | W→S，N→E |

```ts
// 真源：src/game/optics.ts
const MIRROR_REFLECT = {
  0: { [Dir.N]: Dir.W, [Dir.E]: Dir.S },
  1: { [Dir.E]: Dir.N, [Dir.S]: Dir.W },
  2: { [Dir.S]: Dir.E, [Dir.W]: Dir.N },
  3: { [Dir.W]: Dir.S, [Dir.N]: Dir.E },
}
```

> 旧文档 NE 对角表已废弃；改反射只改 `optics.ts` 并回写本表。

### 镜格上的处理

```
// 光即将进入镜格 (nx,ny)，入射方向为 ray.dir（从外侧指向镜）
// 注意：入射方向 = 射线前进方向

out = mirrorOut(facing, ray.dir)
if out == 'block':
  stop  // 反面当墙；镜格不亮
else:
  // 不亮镜格；从镜格以新方向继续
  queue.push({ x: nx, y: ny, dir: out })
```

### 旋转

```
facing = (facing + 1) % 4   // 点击旋转
```

### 手算样例

- 光源 (0,2) 朝 E；镜 (2,2) facing 0。  
- 光进入 (1,2) 亮 → (2,2) 镜：E→N → 从 (2,2) 向 N 出。  
- 下一格 (2,1) 亮……

---

## R03 · 半透半反镜（beam_splitter）

### 规则冻结

- **同一套 facing 与反射表**（与基础镜相同的 `MIRROR_REFLECT`）。  
- **正面入射**（表中有映射）：  
  1. **反射支路**：`out = MIRROR_REFLECT[facing][inDir]`，从该格 `queue.push({x,y,dir:out})`  
  2. **透射支路**：原方向继续，`queue.push({x,y,dir:inDir})`  
- **反面入射**（表中无映射）：**当墙**，停止。  
- 自身格不亮。

```
function handleBeamSplitter(facing, x, y, inDir, queue):
  out = mirrorOut(facing, inDir)
  if out == 'block':
    return
  queue.push({ x, y, dir: out })      // 反射
  queue.push({ x, y, dir: inDir })    // 透射
```

### 防环

- 沿用全局 `visited (x,y,dir)`：同一格同一离开方向只处理一次。  
- 半透会增加分支，5×5 仍安全。

### 与基础镜差异（单测对照）

| | mirror | beam_splitter |
|--|--------|---------------|
| 正面 | 仅反射 | 反射 + 透射 |
| 反面 | 挡 | 挡 |

---

## R04 · 漫射灯（diffuser）

```
function handleDiffuser(x, y, lit):
  // 光束已进入漫射灯格 (x,y)；格本身不亮
  for each (dx,dy) in 8-neighborhood:
    nx, ny = x+dx, y+dy
    if not inBounds: continue
    occ = get(nx, ny)
    if occ.kind == wall: continue        // 墙不亮
    if occ.kind == prop: continue        // 道具格不亮（与 PRODUCT 一致）
    // 空地或鬼：亮
    lit.add(nx, ny)
  // 原光束终止：不再 queue.push 任何前进
```

**激活条件**：任意光束按传播规则**进入**该格（与射入方向无关）。  
**不**：8 邻再出射二次光（防爆亮）。

---

## R05 · 多光源并集

```
lights = 下列全部：
  · 盘上 type==light 的道具（含 lockedProps 锁定灯）
  · 拖动中的幽灵 light（已吸附合法格时）
一次 computeLit 内：
  for each light: 将起步 ray 推入同一 queue
lit 为共享 set → 自然并集
```

无需分光源多次调用后再 merge（也可等价实现）。

**注意：** `locked && type==light` 必须加入 `lights[]`，否则关卡预置灯不发光。

---

## R06 · 拖动中实时光（幽灵位姿）

### 模型

```ts
type DragGhost = {
  type: PropType
  facing: 0|1|2|3
  // 吸附后的格；未入格可为 null → 不参与光路
  cell: { x: number; y: number } | null
}
```

### 合成 board 视图

```
function getOccupantForOptics(x, y):
  if dragGhost?.cell matches (x,y):
    return prop dragGhost   // 覆盖托盘未放置；不可叠已有实体
  return board.get(x,y)
```

### 规则

| 状态 | 光路 | 鬼状态 |
|------|------|--------|
| 拖动中，已吸附合法格 | 若 type=light，计入 lights[] | 按 lit 更新 |
| 拖动中，未吸附 / 非法格 | 该幽灵不发光、不占格 | — |
| 已放置 | 正常 | 正常 |

- **同一套** `computeLit`。  
- 松手成功 → 写入 board，清除 dragGhost。  
- 松手失败 → 回托盘或回原格。

### 非 light 拖动

- 拖镜/半透/漫射时，若板面上**已有 light**，应用「幽灵占位」重算光路（预览折光）。  
- 与 PRODUCT「拖动也发光」主指光源；其它道具拖动预览为推荐实现。

---

## R07 · 鬼状态转移表

```ts
enum GhostState {
  Hidden = 'hidden',           // 完全隐藏
  Revealed = 'revealed',       // 完全显示（当前在灯下）
  Transparent = 'transparent', // 透明（知位置）
  Caught = 'caught',           // 拍照后
}

type Ghost = {
  id: string
  x: number
  y: number
  state: GhostState
  everLit: boolean   // 是否曾经完成「首次出场」
  litSince?: number  // 当前连续被照亮起点 performance.now()；离开光清除
}

/** 首次出场：须连续 isLit 达到此时长（ms）；中途离开清零 */
const GHOST_REVEAL_DWELL_MS = 1000
```

### 每帧 / 每次光路重算后

```
function stepGhost(g, litSet, nowMs, phase):
  // phase: 'playing' | 'camera' | 'won'
  if g.state == Caught: return

  const isLit = litSet.has(g.x, g.y)

  if isLit:
    if g.everLit:
      // 已出过场：再照立刻完全显示
      g.state = Revealed
      g.litSince = g.litSince ?? nowMs
    else:
      // 首次出场：连续照亮满 dwell 才 everLit + Revealed
      g.litSince = g.litSince ?? nowMs
      if nowMs - g.litSince >= GHOST_REVEAL_DWELL_MS:
        g.everLit = true
        g.state = Revealed
      else:
        g.state = Hidden   // 蓄光中，仍完全隐藏
  else:
    g.litSince = undefined   // 离开光格：计时重置
    if g.everLit:
      g.state = Transparent
    else:
      g.state = Hidden
```

**实现注意：**

- 拖动手电静止时也须推进 `nowMs`（input rAF 每帧 resolve，或放置后 dwell rAF）。
- **拖灯时不要再开第二套 dwell rAF**，避免 double-paint。

### 拍照成功

```
if all ghosts state == Revealed:
  // 已由 session 锁盘并打开相机
  onPhotoConfirm:
    for g in ghosts: g.state = Caught
    win
```

### 返回调整

```
// 解锁盘面；鬼保持 everLit / Transparent|Revealed 逻辑继续 stepGhost
// 不自动 Caught
```

### 重开

```
all ghosts: state=Hidden, everLit=false
```

### 真值表（playing）

| 当前 state | isLit | everLit | dwell 满？ | 下一 state | 备注 |
|------------|-------|---------|------------|------------|------|
| Hidden | 0 | 0 | — | Hidden | 清 litSince |
| Hidden | 1 | 0 | 否 | Hidden | 蓄光中 |
| Hidden | 1 | 0 | 是 | Revealed | everLit←true |
| Revealed | 1 | 1 | — | Revealed | |
| Revealed | 0 | 1 | — | Transparent | |
| Transparent | 0 | 1 | — | Transparent | |
| Transparent | 1 | 1 | — | Revealed | 立刻，无 dwell |
| Caught | * | * | — | Caught | |

---

## R08 · 一格一物与放置合法性

### 查询

```
function canPlaceProp(board, x, y, ignorePropId?):
  if not inBounds: return false
  occ = board.get(x,y)
  if occ == null: return true
  if ignorePropId and occ.kind==prop and occ.id==ignorePropId:
    return true  // 自己挪动
  return false   // 墙、鬼、其它道具 → 否
```

### 规则汇总

| 目标格内容 | 可放道具？ | 光 |
|------------|------------|-----|
| 空 | 是 | 可亮 |
| 墙 | 否 | 不亮、停止 |
| 鬼 | **否** | 可亮、穿过 |
| 其它道具 | 否 | 见道具处理，格不亮 |
| 自己（拖动原格） | 是 | — |

### 托盘

- 放置成功：托盘 count-- 或移除实例；盘上登记 prop。  
- 拿起回托盘：盘清空该 prop；count++。

### 关卡加载

- 先铺 wall，再登记 ghost 坐标（占格），托盘 props 不在盘上。  
- 校验：鬼不重叠、不在墙上。

---

## 统一 handleProp

```
function handleProp(prop, x, y, inDir, lit, queue):
  switch prop.type:
    case 'light':
      // 另一盏灯占格：视为挡光固体（停止，不亮）
      return
    case 'mirror':
      out = mirrorOut(prop.facing, inDir)
      if out != 'block':
        queue.push({ x, y, dir: out })
      return
    case 'beam_splitter':
      handleBeamSplitter(prop.facing, x, y, inDir, queue)
      return
    case 'diffuser':
      handleDiffuser(x, y, lit)
      return
```

**说明**：光「射入」灯具格时，该灯不作为新光源触发（光源只从 `lights[]` 列表发射，避免递归炸光）。若日后要「二次源」再开备选。

---

## 全员显示检测（接 session）

```
function allGhostsRevealed(ghosts):
  return ghosts.every(g => g.state == Revealed)

// 每次 optics + stepGhost 后：
if playing and allGhostsRevealed:
  enterCameraMode()  // 锁盘
```

---

## 实现文件映射

| 规格 | 建议文件 |
|------|----------|
| Dir / 表 / computeLit | `src/game/optics.ts` |
| stepGhost | `src/game/ghosts.ts` |
| canPlace / board | `src/game/board.ts` |
| 单测样例 | `src/game/optics.test.ts`（若加 vitest） |

---

## 手算验收样例（实现后对照）

### S1 直射

- 5×5；light (0,2) E；ghost (3,2)  
- lit 含 (1,2)(2,2)(3,2)(4,2)  
- ghost → Revealed  

### S2 镜拐

- light (0,2) E；mirror (2,2) facing 0；ghost (2,0)  
- 路径亮 (1,2)；镜不亮；亮 (2,1)(2,0)  
- ghost Revealed  

### S3 半透

- light (0,2) E；splitter (2,2) facing 0；ghostA (4,2)；ghostB (2,0)  
- 透射亮到 (3,2)(4,2)；反射亮 (2,1)(2,0)  
- 两鬼均可 Revealed  

### S4 漫射

- light (0,1) E；diffuser (2,1)；ghost (2,2)（邻格）  
- 进入漫射后 8 邻中 (2,2) 亮；不向 E 继续 (3,1) 不因原光而亮  

### S5 鬼占格

- ghost (1,1)；不可 place prop 于 (1,1)  
- 光可从 (0,1) E 穿过 (1,1) 亮之  

---

## 反查补漏（第 2 轮对照 PRODUCT）

| 缺口 | 补丁 |
|------|------|
| 光射入另一 light 格 | 当固体：**停、不亮**（不二次发射） |
| 拖动中全员 Revealed | **不进相机**；pointerup 后再 resolve（见 INTERACTION R21） |
| 返回后仍全员 Revealed | 允许立即再次进入 Camera |
| lit 只用于逻辑 | 表现闪烁不得驱动状态 |
| 漫射 8 邻含对角 | 是（dx,dy ∈ {-1,0,1}² \ {0,0}） |
| 半透+镜环 | visited 足够；5×5 无需额外深度上限 |
| PRODUCT「多角度」 | **逻辑仅四向**；多角度若做只作吸附到四向的表现 |
| lockedProps 场景镜 | 占格同 prop；可参与光学；不可拖走（session/board 标记 locked） |

---

## 修订记录

| 版本 | 说明 |
|------|------|
| v0.1 | R01–R08 冻结 |
| v0.2 | 反查补漏；与 INTERACTION_SPEC 分工 |
| v0.3 | R07 首次出场 dwell 1s；`litSince`；真值表更新 |
| **v0.4** | R02 镜表与实现标定对齐（3↔4 正面；N→W/E→S @f0） |
