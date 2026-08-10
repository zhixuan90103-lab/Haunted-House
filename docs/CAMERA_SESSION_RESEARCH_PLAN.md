# 拍照会话 · 检索计划（三轮）

| | |
|--|--|
| 版本 | **v0.2（三轮完成 · 选型冻结）** |
| 日期 | 2026-08-07 |
| 目的 | 全显 → Camera → 闪白 → 截屏 → 拍立得吐出 → 结算；一次做对 |
| 产品真源 | `PRODUCT.md` §7 · `INTERACTION_SPEC` R13/R21 |
| 体验参照 | Pico Cam（slot & eject）· 用户取景 UI 稿 |
| 约束 | **不落玩法代码**至本文冻结后；Web + Capacitor iOS；设计 390×844 |
| 原始检索 | `docs/research/r2_*.md` · `r3_*.md`（Grok 全网） |

> 结构对齐 `LEVEL_PUZZLE_RESEARCH_PLAN.md`：反查补漏 → 改计划 → 再检索。

---

## 0. 已定产品（检索边界，不重开）

| # | 定稿 |
|---|------|
| 进 Camera | 全员同时完全显示 + 非拖拽（R21） |
| UI | 用户取景稿；快门底中；**返回在快门左侧**；**无重制** |
| 截屏范围 | 取景内游戏画面 ≈ 棋盘上下多一点 |
| 快门后 | 闪白 → 截图上拍立得 → 打印吐出动画 |
| 结算 | 黑底 + 定格相 +「再玩一次/重开」 |
| 不做（本切片） | 系统 Dynamic Island API、分享相册、下一关、shake 显影、真机 DI 像素对齐 |

---

## 1. 三轮状态

| 轮次 | 主题 | 状态 |
|------|------|------|
| **第 1 轮** | 外部标杆 + 截屏库广度 + 吐相 CSS + Capacitor | **完成**（§2） |
| **第 2 轮** | 反查 G1–G10：叠层 / 缩放 / blend / 黑图 / 吐纸 / API | **完成**（§3） |
| **第 3 轮** | 冻结选型 + 时序 + spike + 风险 + reduce-motion | **完成**（§4） |

---

## 2. 第 1 轮 · 广度结论

### 2.1 Pico Cam（体验真源）

- 主链路（作者）：`drag open → snap → morph to slot & eject`
- 纯 Swift；DI **机型像素差大**（作者 AMA）→ **我们用假岛/出片缝隐喻，不接系统 DI**
- 一手：Reddit r/vibecoding · App Store · designspells

### 2.2 截屏库（初筛）

| 库 | 判断 |
|----|------|
| html2canvas | **不优先**（scale/blend 历史坑多） |
| modern-screenshot | 成熟 fork；含 **`fetchFn` 利 Capacitor** |
| SnapDOM | 新一代；宣称 blend；有 **clip / exclude** |

### 2.3 吐相 / 闪白

- 槽 `overflow:hidden` + `translateY`；可选 `clip-path`
- 闪白全屏 overlay
- 参照：Fossheim / Bryce / Agathe CSS Polaroid · Emil clip-path

### 2.4 Capacitor

- 原生 `takeSnapshot`：**不适合**精确棋盘裁切（整页/空白风险）
- Web 库在 Ionic 有 **黑图** 报告 → 必须真机 spike

---

## 3. 第 2 轮 · 反查补漏与检索

### 3.1 第 1 轮缺口表（修订后）

| ID | 缺口 | 第 2 轮结论 |
|----|------|-------------|
| **G1 多层** | board / ghost / light-canvas 兄弟层 | **截共同祖先 `#ui-root`（或专用 capture 根）+ clip 区域**；勿只截 `#board-hit`（丢光）。备用：分层 `drawImage` 合成（§4.3） |
| **G2 transform** | stage contain 缩放 | html2canvas 有 scale bug 史；**SnapDOM `outerTransforms` + `clip` + 固定 `dpr`**；spike 时在缩放预览下校验对齐 |
| **G3 blend** | `plus-lighter` 光层 | SnapDOM 文案支持 blend；html2canvas 需第三方 addon。**Spike 必测光**；失败则截前 bake：`mix-blend-mode: normal` 或 light 画到离屏再叠 |
| **G4 黑图** | Capacitor/WKWebView | 常见因 CORS / 资源不可读 / 时序。规避：同域 `public/` 资源、`fetchFn`（modern-screenshot）、截前确保图已 decode |
| **G5 吐纸** | 实现结构 | **假岛 z 高挡卡顶 + slot overflow + polaroid translateY(-100%→0)**；注意 overflow 会新建 stacking context |
| **G6 显影** | Pico slow reveal | **v1 不做** 慢显影/shake；吐出后即清晰图（二期可加 filter 过渡） |
| **G7 API** | crop/exclude | **SnapDOM**：`clip`、`exclude`/`filter`、`scale`/`dpr`、`backgroundColor`。**modern-screenshot**：`width/height`、`scale`、`filter`、**`fetchFn`**（Capacitor 友好） |
| **G8 会话时序** | R21 | 仅 `!dragging` 进 Camera；快门：先截后闪；Capturing 锁输入防连点 |
| **G9 性能** | 大图 | `dpr` 上限 **2**；动态 `import()` 库；一拍一图即可 |
| **G10 a11y** | reduced-motion | 见 §4.5：缩短/跳过吐纸，直达结算 |

### 3.2 第 2 轮 Grok 落盘

| 文件 | 主题 |
|------|------|
| `docs/research/r2_multilayer.md` | 多层/复合 DOM 截取 |
| `docs/research/r2_transform_scale.md` | scale/pixelRatio/crop |
| `docs/research/r2_blend_mode.md` | mix-blend / SnapDOM / h2c addon |
| `docs/research/r2_capacitor_black.md` | 黑图/WKWebView |
| `docs/research/r2_eject_impl.md` | 吐纸/overflow/mask |
| `docs/research/r2_api_options.md` | SnapDOM / modern-screenshot API |

### 3.3 关键 API 摘录（官方 README / options）

**SnapDOM（`@zumer/snapdom`）**

| 选项 | 用途（本项目） |
|------|----------------|
| `clip: { x, y, width, height }` | 取景矩形（棋盘±pad） |
| `exclude` / `filter` | 排除快门、角框、返回、调参 |
| `scale` / `dpr` | 清晰度；dpr≤2 |
| `outerTransforms` | 处理根 transform（默认 true） |
| `backgroundColor` | 避免透明底发黑观感 |
| `fast` | 降延迟 |
| `invalidate` + canvas | 若 light canvas 改像素后需重采 |

**modern-screenshot**

| 选项 | 用途 |
|------|------|
| `scale` / `width` / `height` | 输出尺寸 |
| `filter` | 排除节点 |
| **`fetchFn`** | Capacitor 自定义拉图绕 CORS |
| `drawImageInterval` | Safari 解码间隔 |
| `backgroundColor` | 底色 |

---

## 4. 第 3 轮 · 冻结选型

### 4.1 截屏主路径（冻结）

```
P0  Spike：@zumer/snapdom
    target = #ui-root（或 .capture-root）
    exclude = Camera 铬 + HUD 调参 + 托盘（若出框）
    clip   = board 设计框 ± 上下 PAD（对齐取景 L 内沿）
    dpr    = min(devicePixelRatio, 2)

P1  备用：modern-screenshot + fetchFn（Capacitor 黑图时优先试）

P2  兜底：离屏逻辑重绘 board+ghost+light 路径
    或 light-canvas.toDataURL + DOM 截盘 再 drawImage 合成
```

**不做：** 原生 WebView 全屏截图作合影源。

### 4.2 裁切几何（冻结草案）

```
// 设计坐标 390×844
const padY = 24..40  // 常量，spike 时用红框对齐四角 UI
const padX = 同左右 L 或 0
captureRect = {
  x: boardLeft - padX,
  y: boardTop - padY,
  w: boardWidth + 2*padX,
  h: boardHeight + 2*padY,
}
// 传给 snapdom.clip（相对 capture root）
```

### 4.3 光效 / blend（冻结策略）

```
1) 默认：直接截（SnapDOM 声称支持 blend）
2) 若光丢失：
   a. 截前 light canvas 临时 mix-blend-mode: normal / screen
   b. 或 lightCanvas 像素 drawImage 到合成 canvas（globalCompositeOperation）
3) 合影不要求 100% 实时扫描光；放置折线光优先正确
```

### 4.4 吐纸 + 闪白（冻结）

```
DOM:
  #camera-chrome（角框/REC/快门/返回）  // capture exclude
  #print-slot
    .fake-island（z 高，遮卡顶）
    .slot-clip（overflow:hidden）
      .polaroid（translateY -100% → 0, 0.9–1.2s ease-out）
        .polaroid-frame + img

时序:
  0     点快门 → phase=Capturing；锁输入
  0     await capture()           // 先截！
  0–150 闪白 overlay
  150–1100 吐纸
  1100–1600 黑底结算位 + 按钮
```

假岛 = **视觉隐喻**，非系统 Dynamic Island。

### 4.5 会话（冻结）

```
Playing → (allRevealed && !drag) → Camera
Camera  → 返回 → Playing（仍全亮则再进）
Camera  → 快门 → Capturing → Won
Won     → 再玩一次 → restart() → Playing
Camera/Capturing/Won：无「重制」按钮（产品已定）
```

### 4.6 reduced-motion（冻结）

```
if (matchMedia('(prefers-reduced-motion: reduce)')):
  截屏后：可极短闪白或跳过
  跳过吐纸：照片直接出现在结算位
```

（web.dev / a11y 惯例：动效可关，结果不可丢。）

### 4.7 截前时序（冻结）

```
// 关卡资源已在玩法中加载，仍建议：
await document.fonts.ready  // 若有自定义字
// light canvas 若刚改像素：requestAnimationFrame 双帧
// SnapDOM Safari：库内已有字体/首绘等待；仍需真机验鬼图
```

### 4.8 模块边界（落地时，非本轮写码）

| 模块 | 职责 |
|------|------|
| `session` phase | playing / camera / capturing / won |
| `view/cameraUi` | 取景铬 + 返回 + 快门 |
| `view/capture` | clip 计算 + snapdom/modern-screenshot |
| `view/polaroidPrint` | 闪白、吐纸、结算布局 |
| SPEC | INTERACTION R13 扩展 Capturing/Won UI |

### 4.9 Spike 验收（落地前必过）

| # | 验收 |
|---|------|
| S1 | 桌面：clip 区含鬼+镜+折线光，无快门/黑边 |
| S2 | 桌面 letterbox 缩放后棋盘不偏、不太糊（dpr=2） |
| S3 | 假图吐纸 1s 内观感接近「从缝吐出」 |
| S4 | iOS WKWebView：**非黑图**、鬼贴图在 |
| S5 | plus-lighter 丢失时 bake 路径可用 |
| S6 | reduced-motion 可直达结算 |

### 4.10 第 3 轮 Grok 落盘

| 文件 | 主题 |
|------|------|
| `docs/research/r3_reduced_motion.md` | reduced-motion |
| `docs/research/r3_capture_timing.md` | 截前等待 / Safari |
| `docs/research/r3_canvas_composite.md` | 多层 canvas 合成兜底 |

### 4.11 第 3 轮反查：仍开放但可落地后定

| 项 | 处理 |
|----|------|
| PAD 精确像素 | spike 红框对齐你的 UI 后写死常量 |
| 托盘是否入镜 | 默认 **裁掉托盘**；若取景下沿带一点房间底可接受 |
| 结算按钮文案 | 「再玩一次」vs「重开本关」——产品已等同 restart |
| SnapDOM vs modern 最终依赖 | **以 S1+S4 胜出为准** 再写进 package.json |

---

## 5. 总冻结表（给实现用）

| 环节 | 冻结选择 |
|------|----------|
| 截屏库 | **先 Spike SnapDOM**；黑图/Cap 问题试 modern-screenshot+fetchFn |
| 截目标 | `#ui-root` + **clip** 棋盘±pad + **exclude** 铬层 |
| 时序 | **先截 → 闪白 → 吐纸 → 结算** |
| 吐纸 | 假岛 + overflow 槽 + translateY；非系统 DI |
| 显影 | v1 不做 |
| 会话 | Playing/Camera/Capturing/Won；返回；无重制 |
| 结算 | 黑底 + 相 + restart |
| a11y | reduced-motion 跳过长吐纸 |
| 原生截屏 | 不用作合影 |

---

## 6. 维护

| 变更 | 动作 |
|------|------|
| Spike 出结果 | 更新 §4.1 最终库 + §4.2 PAD 常量 |
| 落地实现 | `INTERACTION_SPEC` · `PROGRESS` · 代码 |
| 新缺口 | 加 G# 到 §3.1，必要时开第 4 轮（默认不需要） |

---

## 修订

| 版本 | 说明 |
|------|------|
| v0.1 | 三轮骨架；第 1 轮结论；反查 G1–G10 |
| **v0.2** | 第 2～3 轮 Grok 补漏完成；**选型冻结**；Spike 验收；research 落盘索引 |
