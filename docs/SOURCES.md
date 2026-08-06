# 有效来源清单 · Haunted House

| | |
|--|--|
| 版本 | **v0.3** |
| 用途 | 标明本项目**权威/有效**文档与资料；同步 NotebookLM 时以此为准 |
| NotebookLM | 笔记本 **Haunted House**（`35f7fb2d-df3d-45ff-83ee-527a09e5d387`） |
| 最近同步 | **2026-08-06** · 清空重复源后全量重入库 + 笔记刷新 |

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
| `docs/PROGRESS.md` | P0 PROGRESS 实现进度总览 v0.4 | **已落地修改 / 模块地图** |

### P1 · 计划与评估

| 本地路径 | NotebookLM 标题建议 | 内容 |
|----------|---------------------|------|
| `docs/IMPLEMENTATION_PLAN.md` | P1 IMPLEMENTATION_PLAN 实现计划 | 三轮检索、切片、模块拆分 |
| `docs/IMPLEMENTATION_TODO.md` | P1 IMPLEMENTATION_TODO 实现清单 v0.4 | Slice 勾选 |
| `docs/CONSISTENCY_REVIEW.md` | P1 CONSISTENCY 自洽评估 | 矛盾分级、就绪度 |
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

## 4. 外部参考（灵感级 · P3，按需添加）

> 仅作关卡/品类灵感，**不得覆盖** P0 规则。

| 类型 | 名称 | 用途 |
|------|------|------|
| （按需） | — | 关卡灵感 |

---

## 5. 修订

| 版本 | 说明 |
|------|------|
| v0.1 | 初版来源清单 |
| v0.2 | 对齐 Haunted House 笔记本 id |
| v0.3 | 2026-08-06 全量重同步；含 PROGRESS；去重约定 |
