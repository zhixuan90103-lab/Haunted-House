# 实现检索计划 · Haunted House（光路捉鬼）

| | |
|--|--|
| 版本 | **v0.3** |
| 目的 | 拆系统、三轮检索、补漏、冻结规格，再编码 |
| 规则真源 | `docs/PRODUCT.md` |
| 关卡方法 | `docs/LEVEL_DESIGN.md` |
| 光路算法 | **`docs/OPTICS_SPEC.md`** |
| 交互会话 | **`docs/INTERACTION_SPEC.md`** |
| 工程约定 | `AGENTS.md` |

---

## 1. 三轮检索总览

| 轮次 | 范围 | 产出 | 状态 |
|------|------|------|------|
| **第 1 轮** | R01–R08 逻辑内核 | `OPTICS_SPEC.md` | **完成** |
| **第 2 轮** | 反查补漏 + R09–R10 + 会话相关 | 补丁写入 OPTICS；`INTERACTION_SPEC` 骨架 | **完成** |
| **第 3 轮** | R11–R15、R21–R24 体验与数据 | `INTERACTION_SPEC.md` 全文 | **完成** |

**检索阶段结束。** 下一动作：按 Slice 0 写 `src/game/**`。

---

## 2. 反查补漏总结（对照 PRODUCT）

### 2.1 已覆盖

- 直线光、四向、光源不自亮、多源并集  
- 镜 / 半透 / 漫射确定件  
- 鬼三态 + 拍照才抓到  
- 一格一物、鬼不挡光、不可叠放  
- 托盘拖放、点旋、重开、锁盘相机  

### 2.2 第 1 轮后发现的缺口 → 已补

| 缺口 | 处理 |
|------|------|
| 拖动中误触发锁盘拍照 | R21：pointerup 后再判定全员显示 |
| 光打到另一盏灯 | 当墙停，不二次发射 |
| 返回后仍全亮 | 允许再次进 Camera |
| 逻辑多角度 vs 四向 | 逻辑只四向；表现可吸附 |
| 设计坐标如何落格 | R09：boardRect + designToCell |
| 托盘与 canvas 抢事件 | R10：ui-root hit 层，canvas 可 none |
| click/drag 混淆 | R23 阈值 8px |
| light.dir vs mirror.facing | R23 字段分离 |
| 关卡数据长什么样 | R14 JSON schema |
| 重开一致性 | R15 深拷贝快照 |
| 最小怎么画 | R11：Slice0 优先 DOM 格网 |
| 震动 | R12：距离档位 + throttle |
| 会话相位 | R13：Playing / Camera / Won |
| locked 场景道具 | OPTICS 补漏：locked 不可拖 |

### 2.3 明确推迟（非阻塞 Slice 0）

| 项 | 原因 |
|----|------|
| 斜向光真实占格 | PRODUCT 标准解四向 |
| 备选道具 | PRODUCT 备选表 |
| 关卡编辑器 / 求解器 | Slice 2+ |
| 存档进度 | Slice 2+ |
| 精美 3D 房间 | 表现层后期 |
| Vitest 是否引入 | 实现时再定；optics 可先导出纯函数手测 |

### 2.4 规格冲突裁决

| 冲突 | 裁决 |
|------|------|
| PRODUCT「多角度手感」vs 格点光学 | **光学四向**；手感旋转用 4 档 |
| Three WebGPU 底座 vs 出片速度 | Slice0 **DOM 棋盘可先**；Three 作壳/背景 |
| 拖动预览其它道具 | 推荐做；非 Slice0 必做（光源拖动必做） |

---

## 3. 目标与非目标

### 3.1 目标

1. WebGPU 底座上可替换 demo 跑通玩法。  
2. 逻辑与表现分离（optics/ghost 无 Three）。  
3. 确定四道具可分 Slice 落地。  
4. 规格可测：S1–S5 + 交互状态机。

### 3.2 非目标

- 备选道具全量、Android、真物理光学、斜向标准解。

---

## 4. 现状基线

| 已有 | 说明 |
|------|------|
| Vite + TS + Three WebGPU | 底座 |
| `clientToDesign` / 390×844 | 输入基础 |
| haptics | 震动 |
| `src/game/*` | **仍无**（待 Slice 0） |

---

## 5. 系统拆分

```
UI (#ui-root: tray, board-hit, camera modal)
  → Input (pointer, 阈值, 锁盘)
  → Session (Playing | Camera | Won)
  → Board + DragGhost
  → OpticsEngine (纯) + Ghosts (纯)
  → View (DOM 格 / 可选 Three)
```

规格映射：

| 模块 | 规格文档 |
|------|----------|
| optics / ghost 内核 | OPTICS_SPEC |
| 输入 / 托盘 / 会话 / 关卡 JSON / 震动 / 表现策略 | INTERACTION_SPEC |
| 规则文案 | PRODUCT |
| 出题 | LEVEL_DESIGN |

---

## 6. 检索项总表

### 第 1 轮 · 逻辑

| ID | 主题 | 状态 | 文档 |
|----|------|------|------|
| R01 | 格点光路 | **完成** | OPTICS |
| R02 | 镜映射表 | **完成** | OPTICS |
| R03 | 半透双路径 | **完成** | OPTICS |
| R04 | 漫射 | **完成** | OPTICS |
| R05 | 多源并集 | **完成** | OPTICS |
| R06 | 拖动幽灵光 | **完成** | OPTICS |
| R07 | 鬼状态机 | **完成** | OPTICS |
| R08 | 占格放置 | **完成** | OPTICS |

### 第 2 轮 · 补漏 + 输入

| ID | 主题 | 状态 | 文档 |
|----|------|------|------|
| 反查 | PRODUCT 对照缺口表 | **完成** | 本文 §2 |
| R09 | design→cell | **完成** | INTERACTION |
| R10 | 托盘/指针/锁盘输入 | **完成** | INTERACTION |
| R21 | 拖动中不进相机 | **完成** | INTERACTION + OPTICS 补漏 |
| R22 | 双坐标系 | **完成** | INTERACTION |
| R23 | dir/facing、点拖阈值 | **完成** | INTERACTION |

### 第 3 轮 · 会话体验与数据

| ID | 主题 | 状态 | 文档 |
|----|------|------|------|
| R11 | 最小表现策略 | **完成** | INTERACTION |
| R12 | 震动 | **完成** | INTERACTION |
| R13 | 相机会话机 | **完成** | INTERACTION |
| R14 | 关卡 JSON | **完成** | INTERACTION |
| R15 | 重开快照 | **完成** | INTERACTION |
| R24 | 胜负 UI 最小 | **完成** | INTERACTION |

### 推迟

| ID | 主题 | 状态 |
|----|------|------|
| R16 | 斜向光 | 推迟 |
| R17 | 备选道具 | 推迟 |
| R18 | 编辑器/求解器 | 推迟 |
| R19 | 性能（非阻塞） | 已有 visited |
| R20 | 存档进度 | 推迟 |

---

## 7. 垂直切片（实现用）

| Slice | 范围 | 规格依赖 |
|-------|------|----------|
| **0** | light + mirror + 墙 + 鬼 + 托盘拖放 + 点旋 + 拍照/返回/重开；DOM 格网 | OPTICS R01–02,06–08 + INTERACTION 全 |
| **1** | beam_splitter + diffuser + 多 light | OPTICS R03–05 |
| **2** | 多关 JSON + 教学序 | R14 + LEVEL_DESIGN |
| **3** | 表现、震动曲线打磨、房间皮 | R11–12 |

Slice 0 Done：

```
dev 下一关可玩：拖灯扫鬼 → 摆镜折光 → 两鬼全显示
→ 松手后锁盘 → 拍照过关 / 返回 / 重开
```

---

## 8. 建议目录

```
src/game/
  types.ts
  optics.ts      # OPTICS_SPEC
  ghosts.ts
  board.ts
  session.ts     # INTERACTION phase
  input.ts
  level.ts
  view/domBoard.ts
  levels/level_001.json
  index.ts
```

---

## 9. 风险（更新）

| 风险 | 缓解 |
|------|------|
| 规格与 PRODUCT 再漂移 | 改规则先改 PRODUCT → OPTICS/INTERACTION |
| DOM 与 WebGPU 双轨 | Slice0 DOM 盘；壳保留 WebGPU |
| 事件抢占 | canvas pointer-events none |
| 半透环 | visited |
| 拖动锁盘 | R21 |

---

## 10. 实现启动检查表

```
[ ] 读 PRODUCT + OPTICS + INTERACTION
[ ] 建 src/game/types.ts + optics.ts（S1–S5 手测）
[ ] board + ghosts + session
[ ] DOM board + tray input
[ ] level_001.json
[ ] main 挂 mountGame
[ ] Slice 0 闭环
```

---

## 11. NotebookLM

Haunted House 笔记本建议源：PRODUCT、LEVEL_DESIGN、IMPLEMENTATION_PLAN、OPTICS_SPEC、INTERACTION_SPEC。

---

## 12. 修订记录

| 版本 | 说明 |
|------|------|
| v0.1 | 初版计划 |
| v0.2 | 第 1 轮 R01–R08 |
| v0.3 | 反查补漏；第 2/3 轮完成；三轮检索收束 |

---

*检索阶段关闭。下一步：Slice 0 编码。*
