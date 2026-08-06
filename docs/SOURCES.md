# 有效来源清单 · Haunted House

| | |
|--|--|
| 版本 | **v0.2** |
| 用途 | 标明本项目**权威/有效**文档与资料；同步 NotebookLM 时以此为准 |
| NotebookLM | 笔记本 **Haunted House**（`35f7fb2d-df3d-45ff-83ee-527a09e5d387`） |

**原则：** 实现与问答以 **P0 真源** 为准；冲突时以更高优先级文档裁决（见下表）。

---

## 1. 优先级

| 优先级 | 含义 |
|--------|------|
| **P0 真源** | 规则/算法/交互冻结；改代码前必改 |
| **P1 方法** | 出题、检索计划、评估；指导流程 |
| **P2 工程壳** | 底座与启动；不覆盖玩法规则 |
| **P3 参考** | 历史/外部灵感；**不**当规则真源 |

---

## 2. 仓库内有效来源（入库清单）

### P0 · 产品与实现规格

| 本地路径 | 标题建议 | 内容 |
|----------|----------|------|
| `docs/PRODUCT.md` | PRODUCT 产品说明 | 玩法、规则、确定四道具、胜负 |
| `docs/OPTICS_SPEC.md` | OPTICS 光路算法 | R01–R08 光/镜/半透/漫射/鬼状态 |
| `docs/INTERACTION_SPEC.md` | INTERACTION 交互会话 | 坐标、托盘、相机、关卡 JSON |
| `docs/LEVEL_DESIGN.md` | LEVEL_DESIGN 关卡制作 | 出题方法、原子、题卡模板 |
| `docs/ASSETS.md` | ASSETS 美术资源 | **定稿图路径**、一物一图约定 |
| `docs/HANDOFF_SLICE0_STEP1.md` | HANDOFF 第1步交接 | 基础操作+找鬼 实现范围 |

### P1 · 计划与评估

| 本地路径 | 标题建议 | 内容 |
|----------|----------|------|
| `docs/IMPLEMENTATION_PLAN.md` | IMPLEMENTATION 实现检索计划 | 三轮检索、切片、模块拆分 |
| `docs/IMPLEMENTATION_TODO.md` | IMPLEMENTATION_TODO 实现清单 | Slice 勾选 |
| `docs/CONSISTENCY_REVIEW.md` | CONSISTENCY 自洽评估 | 矛盾分级、就绪度 |
| `docs/SOURCES.md` | SOURCES 有效来源清单 | 本文 |

### P2 · 工程底座（可选入库，与玩法冲突时让 P0）

| 本地路径 | 标题建议 | 内容 |
|----------|----------|------|
| `AGENTS.md` | AGENTS 工程约定 | 390×844、WebGPU、DOM、Capacitor |
| `README.md` | README 项目入口 | 上手、文档索引 |
| `docs/ENGINEERING.md` | ENGINEERING 工程决策 | 底座决策 |
| `docs/ENTRYPOINTS.md` | ENTRYPOINTS 启动链 | 命令与调用链 |

### P2b · 定稿图片（实现资源，非文字规则）

| 本地路径 | 说明 |
|----------|------|
| `public/board-bg.jpg` | 棋盘背景定稿 |
| `public/ghost.png` | 鬼魂完全显示定稿 |
| `public/prop-light.png` | 手电定稿 |

NotebookLM 以文字规格为主；图片以仓库 `public/` 为准（可另作 note 登记路径）。

### 不入库 / 非玩法真源

| 路径 | 原因 |
|------|------|
| `docs/MERGE.md` | 历史双工程合并说明，与当前玩法无关 |
| `public/prop-mirror.jpg` 等 | 道具草稿，未定稿 |
| `node_modules/**` | 依赖 |
| `dist/**` | 构建产物 |

---

## 3. 外部参考（灵感级 · P3，按需添加）

> 仅作关卡/品类灵感，**不得覆盖** P0 规则。

| 类型 | 名称 | 用途 |
|------|------|------|
| 实体光路 | ThinkFun **Laser Maze** | 题卡结构、全目标点亮 |
| 手游光路 | Laser Puzzle: Mirror & Light 等 | 转镜教学节奏 |
| 方法 | 谜题自解法倒推 / GDC 谜题设计 | 出题工序（已吸收进 LEVEL_DESIGN） |
| 品类邻近 | 半透半反/分束镜 光学概念 | 道具直觉（算法以 OPTICS 为准） |

需要时再 `notebooklm source add <url>` 或 add-research，并在本表追加一行。

---

## 4. 裁决顺序（冲突时）

```
1. PRODUCT.md          （玩家可见规则）
2. OPTICS_SPEC.md      （光与鬼算法）
3. INTERACTION_SPEC.md （输入与会话）
4. LEVEL_DESIGN.md     （出题，不改规则）
5. IMPLEMENTATION_PLAN / CONSISTENCY
6. AGENTS / ENGINEERING（仅工程）
```

特例：镜子/四向等已在 CONSISTENCY 中裁决的，以 **OPTICS + 已修订 PRODUCT** 为准。

---

## 5. NotebookLM 同步

笔记本：**Haunted House** · `35f7fb2d-df3d-45ff-83ee-527a09e5d387`

应保持 Source 最新：

- 全部 P0 规格文档  
- P1 计划 / Todo / 评估 / SOURCES / HANDOFF / ASSETS  
- P2 README、AGENTS（可选）  

图片定稿以仓库为准；笔记中保留「美术资源 ASSETS」说明路径即可。

> 同名重复 source 可在 UI 删旧留新。

---

## 6. 修订

| 版本 | 说明 |
|------|------|
| v0.1 | 初版有效来源 list + NotebookLM 入库范围 |
| v0.2 | 登记 ASSETS/HANDOFF/定稿图；Todo |
