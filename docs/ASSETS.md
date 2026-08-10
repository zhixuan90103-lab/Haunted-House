# 美术资源说明 · Haunted House

| | |
|--|--|
| 版本 | **v0.5** |
| 原则 | **一物一图**；朝向用代码旋转，不拆四向贴图 |
| 实现根路径 | Vite：`public/` → 运行时 `./文件名`（`base: './'`） |
| 备份 | `assets/` 与 `public/` 同步关键定稿 |
| 进度 | 定稿以本文为准；落地清单见 `PROGRESS.md` |

---

## 1. 资源约定

```
1 道具 / 1 角色态 = 1 主文件
盘上朝向：CSS/transform 或矩阵 rotate(90° * n)
禁止：prop-light-N.png、prop-light-E.png …
```

| 项 | 约定 |
|----|------|
| 棋盘相机 | 近纯俯视（见 `board-bg`） |
| 道具构图 | 可作棋子贴在格上；**light 已定稿**为侧俯通用角 |
| 背景 | 定稿图可用透明底或纯色底；实现可抠边 |
| 命名 | 正式：`public/prop-{type}.png` 优先；`type` = PRODUCT id |

---

## 2. 正式资源（实现请用这些）

| 用途 | 主文件（public） | 状态 | 说明 |
|------|------------------|------|------|
| 棋盘背景 | **`board-bg.jpg`** | **定稿** | 空 5×5 木格，无 UI、无鬼、无道具 |
| 鬼魂·在光中 (Revealed) | **`ghost-revealed.png`** | **定稿** | 哭泣脸；完全被照亮时 |
| 鬼魂·离开光 (Transparent) | **`ghost-revealed2.png`** | **定稿** | 开心脸；已发现但不在光中 |
| 光源 light | **`prop-light.png`** | **定稿** | 黄身手电；**一物一图**；朝向代码旋转 |
| 镜子·盘上 / 投影 | **`prop-mirror-board.png`** | **定稿** | 斜置金框镜；facing×90 点旋；**勿再加光学偏移旋** |
| 镜子·托盘 / 拿起本体 | **`prop-mirror-tray.png`** | **定稿** | 立式金框镜；拿起跟手用此图 |
| 照射光斑 | **`light-glow.png`** | **定稿** | 拖灯跟手尖端 + 放置尽头格；Additive |
| 光束连接 | **`light-beam.png`** | **定稿** | 手电→光斑 / 折线段；Additive |
| 可落格吸附框 | **`snap-frame.png`** | **定稿** | 可放手电时格上框；与光效同 canvas Additive |
| 拍照取景框 | **`camera-frame.png`** | **定稿** | Camera 全屏铬（中心透明）；快门/返回代码绘制 |

### 别名（与定稿同内容或兼容）

| 文件 | 说明 |
|------|------|
| `prop-light.jpg` / `flashlight.jpg` / `flashlight.png` | light 的 JPG/别名拷贝 |
| `ghost.png` / `ghost.jpg` | 兼容别名（当前同步伤心图） |
| `assets/ghost-ref.png` / `assets/prop-light-ref.png` | 定稿参考备份 |
| `assets/board-bg.jpg` | 背景备份 |

**当前可玩最少依赖：**

```
public/board-bg.jpg
public/ghost-revealed2.png
public/ghost-revealed.png
public/prop-light.png
public/prop-mirror-board.png
public/prop-mirror-tray.png
public/light-glow.png
public/light-beam.png
public/snap-frame.png
public/camera-frame.png
```

动画与朝向：**一物一图**；入场/待机为 CSS/transform，不拆帧序列。

---

## 3. 草稿 / 未定稿（勿当最终美术）

以下为 AI 试稿或旧单图；**镜请用 §2 双图定稿**。

| 文件 | type | 状态 |
|------|------|------|
| `prop-mirror.jpg` | mirror | 旧草稿（已被 board/tray 双图取代） |
| `prop-beam_splitter.jpg` | beam_splitter | 草稿 |
| `prop-diffuser.jpg` | diffuser | 草稿 |

历史试稿（可忽略）：`ghost-sprite.jpg`、`ghost-transparent.png`、`archive-flashlight-board.jpg`、`shoudian.png` 等。

---

## 4. 与玩法状态对应

| 游戏状态 | 建议贴图 |
|----------|----------|
| 鬼 Hidden | 不绘制或占位不可见 |
| 鬼 Revealed（完全显示） | **`ghost.png`** |
| 鬼 Transparent | 暂无独立定稿；可用 `ghost.png` + CSS opacity，或后补 |
| 手电在托盘/盘上 | **`prop-light.png`** + 运行时旋转 |

---

## 5. 实现引用示例

```ts
// 路径注意 Capacitor：base './'
const ASSETS = {
  boardBg: './board-bg.jpg',
  ghost: './ghost.png',
  light: './prop-light.png',
  lightGlow: './light-glow.png',
  lightBeam: './light-beam.png',
} as const
```

---

## 6. 修订

| 版本 | 说明 |
|------|------|
| v0.1 | 一物一图初版 |
| v0.2 | 定稿：board-bg / ghost / prop-light；草稿道具分离；实现最小集 |
| v0.3 | Step1 最小集含 glow/beam；鬼图说明对齐现网 |
| v0.4 | 镜 board/tray 双图定稿；snap-frame；最少依赖对齐可玩状态 |
| **v0.5** | camera-frame 纳入最少依赖；拍照会话已落地 |
