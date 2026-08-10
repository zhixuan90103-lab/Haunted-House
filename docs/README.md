# 文档索引 · NewProject_Puzzle

> 打开仓库：先 **`AGENTS.md`**（工程）+ **`PROGRESS.md`**（已落地），再按问题进 SPEC。

---

## 1. 读哪份（按问题）

| 问题 | 文档 | 优先级 |
|------|------|--------|
| 玩法 / 胜负 / 道具定义 | [PRODUCT.md](./PRODUCT.md) | 产品真源 |
| **现在做成啥了 / 模块地图** | **[PROGRESS.md](./PROGRESS.md)** | 进度真源 |
| 光路 / 镜反射 / 鬼状态算法 | [OPTICS_SPEC.md](./OPTICS_SPEC.md) | 算法真源 |
| 拖放 / 托盘 / 拖灯 A1 / 会话 | [INTERACTION_SPEC.md](./INTERACTION_SPEC.md) | 交互真源 |
| 扫描震动 | [HAPTICS_SPEC.md](./HAPTICS_SPEC.md) | 震动真源 |
| 美术路径 | [ASSETS.md](./ASSETS.md) | 资源真源 |
| 关卡怎么做 | [LEVEL_DESIGN.md](./LEVEL_DESIGN.md) | 设计工序 |
| 切片计划 / Todo | [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) · [IMPLEMENTATION_TODO.md](./IMPLEMENTATION_TODO.md) | 计划 |
| 工程坑 / 启动 | [ENGINEERING.md](./ENGINEERING.md) · [ENTRYPOINTS.md](./ENTRYPOINTS.md) | 工程 |
| 仓库硬约定 | [../AGENTS.md](../AGENTS.md) | 工程入口 |
| 上手 | [../README.md](../README.md) | 人类 README |

其余：`HANDOFF_*`（历史交接）、`CONSISTENCY_REVIEW`、`SOURCES`、`MERGE`、`LEVEL_PUZZLE_RESEARCH_PLAN` — **不优先**，有冲突以 PRODUCT / SPEC / PROGRESS 为准。

---

## 2. 文档层级（勿倒置）

```
PRODUCT.md          产品规则（能不能、胜负、道具表）
    ↓
OPTICS_SPEC         格点光路 / 鬼状态
INTERACTION_SPEC    输入 / 托盘 / 光表现 / 会话
HAPTICS_SPEC        扫描震动
ASSETS.md           贴图路径
    ↓
代码 src/game/*
    ↓
PROGRESS.md         已实现索引（不发明规则）
```

---

## 3. 维护规范

### 3.1 改什么更新什么

| 变更 | 必更新 |
|------|--------|
| 规则（玩法/光路/交互/震动） | 对应 SPEC → 代码 → `PROGRESS` 一行 |
| 只改代码表现、规则不变 | `PROGRESS` 即可；SPEC 有句子过时则改一句 |
| 新资源文件 | `ASSETS.md` + `public/` |
| 工程命令 / Safe Area / base | `AGENTS.md` · `ENTRYPOINTS` · `ENGINEERING` |

### 3.2 写法

- **PROGRESS**：表格 + 模块路径；不写长篇设计辩论。  
- **SPEC**：条文编号（Rxx）；改行为先改条文。  
- **版本**：各文档头表 `版本` + 文末「修订」表；PROGRESS 大功能升 `v0.x`。  
- **禁止**：在 PROGRESS 写与 PRODUCT 冲突的「新规则」而不改 PRODUCT。

### 3.3 新会话检查清单

1. `PROGRESS.md` §1 可玩状态  
2. 相关 SPEC 条文  
3. `AGENTS.md` DOM / 硬约定  
4. 再动 `src/game/*`

---

## 4. 当前实现摘要（v0.7）

- 找鬼：拖灯短距跟手照 + 震动 + dwell 1s  
- 找全：镜滑入托盘；灯可落格；拖灯长距仍跟手（A1）；落盘折线经镜  
- 托盘：固定图标尺寸、横滑、FLIP 补位  
- 未做：拍照会话、多关、音效、Android  

细节以 **PROGRESS v0.7** 为准。
