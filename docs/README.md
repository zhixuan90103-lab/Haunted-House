# 文档索引

| 文档 | 用途 |
|------|------|
| [PRODUCT.md](./PRODUCT.md) | **产品与玩法真源**（房间光路捉鬼） |
| [PROGRESS.md](./PROGRESS.md) | **实现进度 / 已落地修改总览**（新会话优先） |
| [LEVEL_DESIGN.md](./LEVEL_DESIGN.md) | **谜题/关卡如何制作** |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | **实现检索计划**（模块拆分、切片） |
| [IMPLEMENTATION_TODO.md](./IMPLEMENTATION_TODO.md) | **实现 Todo 清单**（完成度勾选） |
| [OPTICS_SPEC.md](./OPTICS_SPEC.md) | **光路/鬼状态算法**（含首次出场 dwell） |
| [INTERACTION_SPEC.md](./INTERACTION_SPEC.md) | **交互/会话/扫描表现/关卡 JSON** |
| [ASSETS.md](./ASSETS.md) | **美术资源**（定稿路径、一物一图） |
| [HANDOFF_SLICE0_STEP1.md](./HANDOFF_SLICE0_STEP1.md) | **Step 1 交接** |
| [CONSISTENCY_REVIEW.md](./CONSISTENCY_REVIEW.md) | 规格自洽评估 |
| [SOURCES.md](./SOURCES.md) | 有效来源清单 |
| [ENGINEERING.md](./ENGINEERING.md) | 工程设计决策与踩坑 |
| [ENTRYPOINTS.md](./ENTRYPOINTS.md) | 命令、启动链、DOM |
| [MERGE.md](./MERGE.md) | 历史双工程合并说明 |

仓库根目录：

| 文档 | 用途 |
|------|------|
| [../AGENTS.md](../AGENTS.md) | AI / 开发第一入口（工程硬约定） |
| [../README.md](../README.md) | 上手说明 |

---

## 读写规则

| 变更类型 | 更新 |
|----------|------|
| 玩法 / 胜负 / 鬼规则 | `PRODUCT.md` → OPTICS / INTERACTION → 代码 |
| 光路算法 | `OPTICS_SPEC.md` → `optics.ts` / `ghosts.ts` |
| 拖放 / 扫描表现 / 会话 | `INTERACTION_SPEC.md` → `input` / `view/*` |
| 资源路径 | `ASSETS.md` + `public/` |
| 完成了哪些功能 | `PROGRESS.md` + `IMPLEMENTATION_TODO.md` |
| 工程坑 / 架构决策 | `ENGINEERING.md` |
| 启动链 | `ENTRYPOINTS.md` |

**规则变更：** 只改 `PRODUCT.md`（及相关 SPEC），再改代码。  
**工程变更：** 遵守 `AGENTS.md`。
