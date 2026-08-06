# 美术资源说明 · Haunted House

| | |
|--|--|
| 版本 | **v0.3** |
| 原则 | **一物一图**；朝向用代码旋转，不拆四向贴图 |
| 实现根路径 | Vite：`public/` → 运行时 `/文件名` 或 `./文件名`（`base: './'`） |
| 备份 | `assets/` 与 `public/` 同步关键定稿 |

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
| 鬼魂·完全显示 | **`ghost.png`** | **定稿** | Q 版透明底；入场/待机/透明共用；尺寸=格边×`ghostSize%` |
| 光源 light | **`prop-light.png`** | **定稿** | 黄身手电；**一物一图**；朝向代码旋转 |
| 照射光斑 | **`light-glow.png`** | **定稿** | 扫描态末端圆光斑；Additive 染色 |
| 光束连接 | **`light-beam.png`** | **定稿** | 手电→光斑连接；独立图；Additive |

### 别名（与定稿同内容或兼容）

| 文件 | 说明 |
|------|------|
| `prop-light.jpg` / `flashlight.jpg` / `flashlight.png` | light 的 JPG/别名拷贝 |
| `ghost.jpg` / `ghost-revealed.png` | 与 `ghost.png` 同造型备份 |
| `assets/ghost-ref.png` / `assets/prop-light-ref.png` | 定稿参考备份 |
| `assets/board-bg.jpg` | 背景备份 |

**Step 1 最少依赖：**

```
public/board-bg.jpg
public/ghost.png
public/prop-light.png
public/light-glow.png
public/light-beam.png
```

动画与朝向：**一物一图**；入场/待机为 CSS/transform，不拆帧序列。

---

## 3. 草稿 / 未定稿（勿当最终美术）

以下为 AI 试稿，**尚未玩家确认**；实现可先占位，勿当视觉定稿。

| 文件 | type | 状态 |
|------|------|------|
| `prop-mirror.jpg` | mirror | 草稿 |
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
