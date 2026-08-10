# 有效来源清单 · Haunted House

| | |
|--|--|
| 版本 | **v0.4** |
| 用途 | 标明本项目**权威/有效**文档与资料；同步 NotebookLM 时以此为准 |
| NotebookLM | 笔记本 **Haunted House**（`35f7fb2d-df3d-45ff-83ee-527a09e5d387`） |
| 最近同步 | **2026-08-06** 全量；**2026-08-07** 补拍照会话来源（§4b） |

**原则：** 实现与问答以 **P0 真源** 为准；冲突时以更高优先级文档裁决（见下表）。

---

## 1. 优先级

| 优先级 | 含义 |
|--------|------|
| **P0 真源** | 规则/算法/交互/进度冻结；改代码前必改 |
| **P1 方法** | 出题、检索计划、评估；指导流程 |
| **P2 工程壳** | 底座与启动；不覆盖玩法规则 |
| **P3 参考** | 历史/外部灵感；**不**当规则真源 |

---

## 2. 仓库内有效来源（入库清单）

### P0 · 产品与实现规格

| 本地路径 | NotebookLM 标题建议 | 内容 |
|----------|---------------------|------|
| `docs/PRODUCT.md` | P0 PRODUCT 产品说明 v0.5 | 玩法、规则、dwell 1s、确定四道具、胜负 |
| `docs/OPTICS_SPEC.md` | P0 OPTICS 光路算法 v0.3 | R01–R08；R07 litSince/dwell |
| `docs/INTERACTION_SPEC.md` | P0 INTERACTION 交互会话 v0.2 | 坐标、扫描光效、鬼层、关卡 JSON |
| `docs/LEVEL_DESIGN.md` | P0 LEVEL_DESIGN 关卡制作 | 出题方法、原子、题卡模板 |
| `docs/ASSETS.md` | P0 ASSETS 美术资源 v0.3 | 定稿图路径、一物一图 |
| `docs/HANDOFF_SLICE0_STEP1.md` | P0 HANDOFF Step1 交接 v0.3 | Step1 范围与踩坑 |
| `docs/PROGRESS.md` | P0 PROGRESS 实现进度总览 | **已落地修改 / 模块地图**（以文内版本为准） |
| `docs/HAPTICS_SPEC.md` | P0 HAPTICS 扫描震动 | 开灯/底噪/近鬼/蓄光/出场 |

### P1 · 计划与评估

| 本地路径 | NotebookLM 标题建议 | 内容 |
|----------|---------------------|------|
| `docs/IMPLEMENTATION_PLAN.md` | P1 IMPLEMENTATION_PLAN 实现计划 | 三轮检索、切片、模块拆分 |
| `docs/IMPLEMENTATION_TODO.md` | P1 IMPLEMENTATION_TODO 实现清单 | Slice 勾选 |
| `docs/CONSISTENCY_REVIEW.md` | P1 CONSISTENCY 自洽评估 | 矛盾分级、就绪度 |
| `docs/CAMERA_SESSION_RESEARCH_PLAN.md` | P1 CAMERA 拍照会话检索 v0.2 | 三轮检索、截屏/吐纸选型冻结 |
| `docs/LEVEL_PUZZLE_RESEARCH_PLAN.md` | P1 LEVEL 谜题检索 | 出题检索三轮 |
| `docs/SOURCES.md` | P1 SOURCES 有效来源清单 | 本文 |
| `docs/README.md` | P1 docs索引 读写规则 | 文档维护约定 |

### P2 · 工程底座

| 本地路径 | NotebookLM 标题建议 | 内容 |
|----------|---------------------|------|
| `AGENTS.md` | P2 AGENTS 工程约定 | 390×844、WebGPU、DOM、Capacitor |
| `README.md` | P2 README 项目入口 | 上手、进度摘要 |
| `docs/ENGINEERING.md` | P2 ENGINEERING 工程决策 | 底座决策与坑 |
| `docs/ENTRYPOINTS.md` | P2 ENTRYPOINTS 启动链 | 命令与调用链 |

### P2b · 定稿图片（实现资源，非文字规则）

| 本地路径 | 说明 |
|----------|------|
| `public/board-bg.jpg` | 棋盘背景 |
| `public/ghost.png` | 鬼魂 |
| `public/prop-light.png` | 手电 |
| `public/light-glow.png` | 扫描光斑 |
| `public/light-beam.png` | 扫描连接条 |

NotebookLM 以文字规格为主；图片以仓库 `public/` 为准。

### 不入库 / 非玩法真源

| 路径 | 原因 |
|------|------|
| `docs/MERGE.md` | 历史双工程合并，与当前玩法无关 |
| `public/prop-mirror.jpg` 等 | 道具草稿，未定稿 |
| `node_modules/**` · `dist/**` | 依赖 / 构建产物 |

---

## 3. NotebookLM 同步约定

笔记本：**Haunted House** · id `35f7fb2d-df3d-45ff-83ee-527a09e5d387`

| 操作 | 做法 |
|------|------|
| 全量同步 | 删除旧 sources → `source add` 本表路径 + `--title` |
| 防重复 | 同名只保留一份；可用 `source clean`；避免多次 add 不删 |
| 笔记 | 关键文档镜像为 note（便于侧栏浏览）；与 source 二选一为主时优先 **source** 供 ask 引用 |
| 冲突 | 以仓库 git 最新 md 为准，再覆盖 NotebookLM |

### 推荐 source 标题前缀

- `P0 ` / `P1 ` / `P2 ` + 文档名 + 版本号  

### 推荐 notes（侧栏）

- 产品说明 PRODUCT  
- 实现进度 PROGRESS v0.4  
- OPTICS / INTERACTION  
- 交接 第1步找鬼  
- 实现 Todo List  
- ASSETS / SOURCES / AGENTS / ENGINEERING / ENTRYPOINTS  

---

## 4. 外部参考（灵感级 · P3）

> **不得覆盖** P0 规则。关卡灵感与拍照会话技术分列。

### 4a · 关卡 / 品类灵感

| 类型 | 名称 | 用途 |
|------|------|------|
| （按需） | ThinkFun Laser Maze 等 | 见 `LEVEL_PUZZLE_RESEARCH_PLAN` |

### 4b · 拍照会话（三轮 Grok 检索 · 有效来源）

> 对应 `CAMERA_SESSION_RESEARCH_PLAN.md` v0.2。  
> **有效** = 直接支撑选型或实现；噪声链接不入表。

#### 体验 / 仪式（吐相参照）

| # | 来源 | URL | 有效用途 | 局限 |
|---|------|-----|----------|------|
| E1 | Pico Cam · App Store | https://apps.apple.com/us/app/pico-cam-dynamic-island-pics/id6772559415 | 产品定位：instant 卡 + Island 仪式 | 非开源；系统 DI |
| E2 | 作者 AMA · r/vibecoding | https://www.reddit.com/r/vibecoding/comments/1u7i35s/made_an_app_that_turns_your_dynamic_island_into_a/ | **主交互原文** `snap → morph to slot & eject`；纯 Swift；DI 机型差 | 无 Web 实现 |
| E3 | designspells · Pico 开镜 | https://designspells.com/spells/camera-opens-from-the-dynamic-island-in-pico-cam | 微交互观感 | 无代码 |

#### 截屏库（技术）

| # | 来源 | URL | 有效用途 | 局限 |
|---|------|-----|----------|------|
| C1 | **SnapDOM** 仓库 | https://github.com/zumerlab/snapdom | P0 spike 候选；`clip` / `exclude` / `dpr` / blend 宣称 | 需真机证伪 |
| C2 | SnapDOM 文档站 | https://snapdom.dev/docs/ | Options 全表 | — |
| C3 | SnapDOM vs h2c · DEV | https://dev.to/tinchox5/why-snapdom-beats-html2canvas-for-dom-to-image-capture-14ch | 选型论据 | 作者向 |
| C4 | **modern-screenshot** | https://github.com/qq15725/modern-screenshot | P1 备用；`options.ts` 含 **fetchFn**（Capacitor） | 无原生 clip API 同级文档 |
| C5 | modern-screenshot options | https://github.com/qq15725/modern-screenshot/blob/main/src/options.ts | `scale` / `filter` / `fetchFn` / Safari `drawImageInterval` | — |
| C6 | Monday · DOM capture 实战 | https://engineering.monday.com/capturing-dom-as-image-is-harder-than-you-think-how-we-solved-it-at-monday-com/ | 生产侧对比 h2c / modern-screenshot | 非游戏场景 |
| C7 | html-to-image 尺寸 issue | https://github.com/bubkoo/html-to-image/issues/82 | pixelRatio / 尺寸坑 | 旧库 |
| C8 | html2canvas scale bug | https://github.com/niklasvh/html2canvas/issues/1524 | **不优先 h2c** 的论据 | — |

#### blend / 光效进图

| # | 来源 | URL | 有效用途 |
|---|------|-----|----------|
| B1 | MDN mix-blend-mode | https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mix-blend-mode | `plus-lighter` 语义 |
| B2 | html2canvas-add-mix-blend-mode | https://www.jsdelivr.com/package/npm/html2canvas-add-mix-blend-mode | h2c 需 addon 才谈 blend → 反证主路径勿绑 h2c |
| B3 | SO canvas screen blend | https://stackoverflow.com/questions/50477644/how-to-add-screen-blend-mode-to-canvas-element | bake/合成兜底思路 |

#### Capacitor / WKWebView 黑图

| # | 来源 | URL | 有效用途 |
|---|------|-----|----------|
| W1 | SO · html-to-image 黑图 Ionic | https://stackoverflow.com/questions/69244429/black-images-when-transforming-html-to-jpeg | 真机黑图风险 |
| W2 | Capacitor issue CORS/localhost | https://github.com/ionic-team/capacitor/issues/788 | 同源/CORS 与 canvas |
| W3 | SO · WKWebView takeSnapshot blank | https://stackoverflow.com/questions/76349413/wkwebview-takesnapshot-returns-a-blank-image-on-very-specific-sites | **勿用原生全页截作合影主路径** |
| W4 | capawesome screenshot 诉求 | https://github.com/capawesome-team/capacitor-plugins/issues/343 | 原生截定位=排错，非游戏合影 |

#### 吐纸 / 闪白 / 拍立得 CSS

| # | 来源 | URL | 有效用途 |
|---|------|-----|----------|
| P1 | Bryce · CSS Polaroid 交互 | https://dev.to/bryce/bringing-the-css-only-polaroid-camera-to-life-2881 | 闪白、快门感 |
| P2 | Fossheim · CSS Polaroid 相机 | https://fossheim.io/writing/posts/css-polaroid-camera/ | 造型层次 |
| P3 | Agathe · CSS Polaroid 动画 | https://dev.to/agathacco/how-to-create-pure-css-illustrations-and-animate-them---part-2-1ao4 | keyframes 闪/按 |
| P4 | Emil · clip-path reveal | https://emilkowal.ski/ui/the-magic-of-clip-path | 吐出/露出不抖布局 |
| P5 | CSS-Tricks · clip pop-out | https://css-tricks.com/lets-create-an-image-pop-out-effect-with-svg-clip-path/ | 弹出露出 |
| P6 | Polaroid 白边布局教程 | https://medium.com/@SavvStudio/tutorial-make-your-images-look-like-polaroid-pictures-with-html-and-css-7b1120732dd1 | 相纸框样式 |
| P7 | SO · overflow vs z-index | https://stackoverflow.com/questions/77034181/overflowhidden-breaks-z-index-and-translatez-but-visible-does-not-why | 槽+岛层级坑 |

#### 时序 / a11y / 合成兜底

| # | 来源 | URL | 有效用途 |
|---|------|-----|----------|
| T1 | SnapDOM Safari 缺图 issue | https://github.com/zumerlab/snapdom/issues/129 | 截前等待/decode |
| T2 | html-to-image delay issue | https://github.com/bubkoo/html-to-image/issues/369 | 截前时序 |
| T3 | SO · image render + rAF | https://stackoverflow.com/questions/53423742/waiting-for-an-image-to-finish-rendering | 双 rAF |
| T4 | web.dev reduced-motion | https://web.dev/learn/accessibility/motion | 跳过长动画 |
| T5 | SO canvas 多层 | https://stackoverflow.com/questions/3008635/html5-canvas-element-multiple-layers | P2 合成兜底 |
| T6 | SO drawImage + composite | https://stackoverflow.com/questions/5399052/should-the-canvas-globalcompositeoperation-modes-work-from-drawimage | bake 光层 |

#### 刻意不列入（噪声 / 非有效）

| 原因 | 示例类型 |
|------|----------|
| 与 Polaroid 硬件/FPV/无关关键词误召 | 杂 Reddit / 硬件帖 |
| 仅营销短视频无技术信息 | 部分 IG/TikTok/Shorts |
| 未读正文、未影响选型 | 泛 GitHub awesome 列表 |
| 系统 DI 实现细节（我们不做） | Live Activity 教程 |

---

## 5. 拍照会话 · 仓库内真源（实现时读序）

| 序 | 路径 | 角色 |
|----|------|------|
| 1 | `docs/PRODUCT.md` §6–8 | 抓到=拍照；返回；重开 |
| 2 | `docs/INTERACTION_SPEC.md` R13/R21 | 会话（落地前需补 Capturing / 无重制） |
| 3 | `docs/CAMERA_SESSION_RESEARCH_PLAN.md` | 截屏/吐纸/时序冻结 |
| 4 | `docs/PROGRESS.md` | 是否已接 Camera |
| 5 | `AGENTS.md` | DOM / 390×844 / ui-root |
| 6 | 本文 §4b | 外部有效链接 |

---

## 6. 修订

| 版本 | 说明 |
|------|------|
| v0.1 | 初版来源清单 |
| v0.2 | 对齐 Haunted House 笔记本 id |
| v0.3 | 2026-08-06 全量重同步；含 PROGRESS；去重约定 |
| **v0.4** | 补 HAPTICS / CAMERA 检索计划；**§4b 拍照会话有效外链**；§5 读序；剔除噪声规则 |
