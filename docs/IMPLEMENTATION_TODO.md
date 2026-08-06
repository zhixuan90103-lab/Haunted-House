# 实现 Todo List · Haunted House

| | |
|--|--|
| 版本 | **v0.3** |
| 规格 | `PRODUCT` · `OPTICS_SPEC` · `INTERACTION_SPEC` · `IMPLEMENTATION_PLAN` |
| 审核 | NotebookLM · Haunted House 审稿（2026-08-06）已吸收建议 |
| 状态约定 | `[ ]` 未做 · `[~]` 进行中 · `[x]` 完成 · `[-]` 取消/推迟 |

**Done 定义（Slice 0）：**  
`npm run dev` 可：拖灯扫鬼 → 摆镜折光 → 两鬼全显示 → 松手锁盘 → 拍照过关 / 返回 / 重开。

**Step 1 Done（本步，2026-08-06）：**  
托盘拖灯 → 5×5 放置/再拿起 → 点旋四向 → 直线 lit → 鬼 Hidden→Revealed→Transparent；`npm run build` 通过。

---

## 0. 开工前

- [x] 通读 `PRODUCT.md` §1–9
- [x] 通读 `OPTICS_SPEC.md`（含 S1–S5）
- [x] 通读 `INTERACTION_SPEC.md`（R09–R15、R21–R24）
- [x] 确认本列表与 `IMPLEMENTATION_PLAN` Slice 划分一致

---

## Slice 0 · 最小可玩（优先）

### A. 核心逻辑（无 UI）

- [x] **A1** `src/game/types.ts`  
  - Dir、PropType、GhostState、Occupant、LevelDef、SessionPhase 等
- [~] **A2** `src/game/optics.ts` · `computeLit`  
  - 队列传播、visited、墙/空/鬼/light **已做**  
  - mirror / beam_splitter / diffuser 代码已按 OPTICS 表写好，**本步未接 UI 与关卡**  
  - 镜必须用 **OPTICS R02 单面 90° 映射表**（禁止按物理双向 45° 斜镜实现）  
- [~] **A3** optics 手测或断言 · **S1 直射** 由玩法手测覆盖；**S2 镜拐** 待 Step 2
- [x] **A4** `src/game/board.ts`  
  - get/set、canPlace（排除墙与**鬼格**）、ignore 自己挪动  
  - locked 字段支持；完整 locked 场景待会话层
- [x] **A5** `src/game/ghosts.ts` · `stepGhosts`  
  - Hidden / Revealed / Transparent / everLit；Caught 仅拍照写（未接）
- [x] **A6** `src/game/level.ts`  
  - 加载 LevelDef、校验鬼不在墙上  
  - lockedProps / light→lights 路径已具备
- [ ] **A7** `src/game/session.ts`  
  - Playing / Camera / Won 与 resolve **强关联**  
  - resolve：optics → ghosts → allRevealed（**非拖动中 / pointerup 后**，R21）  
  - 拍照 → Caught → Won；返回 → Playing；重开 → snapshot  
  - **本步未做**（明确不做相机/过关）

### B. 关卡数据

- [~] **B1** `src/game/levels/level_001.json`  
  - 5×5、1 墙、2 鬼、tray：`light×1`（**无 mirror**，符合 Step 1）  
  - 有 reference 手算提示

### C. 交互 + DOM 表现

- [x] **C1** `BOARD_LAYOUT` 常量（design px → cell）  
  - `designToCell` / `cellToDesignCenter`（INTERACTION R09）→ `src/game/layout.ts`
- [~] **C2** `#ui-root` 结构  
  - `#board-hit` · `#tray` · `#hud` 已有；`#camera-modal` **未做**  
  - canvas `pointer-events: none`  
  - 棋盘矩形用绝对 design 坐标；HUD 用 safe-top
- [x] **C3** `src/game/view/domBoard.ts`  
  - 绘制格、墙、鬼三态、道具、lit 高亮
- [~] **C4** `src/game/input.ts`  
  - 托盘直接拖出 · 盘上拖移 · 点旋（阈值 8px）  
  - DragGhost + 松手放置/取消；canPlace（墙/鬼格不可放）  
  - locked / 锁盘 **未做**（无 session）
- [x] **C5** 禁用 OrbitControls（玩法模式）
- [ ] **C6** 相机 UI：拍照 / 返回
- [ ] **C7** HUD：重开

### D. 接入底座

- [x] **D1** `src/game/index.ts` · `mountGame({ stage, uiRoot, getLayout })`
- [x] **D2** 改 `main.ts`：boot 舞台后 `mountGame`；去掉立方体 demo / OrbitControls
- [~] **D3** `npm run dev` 手测（Step 1 清单，见下）
- [x] **D4** `npm run build` 通过

### Slice 0 · 手测清单

- [x] 拖灯在盘上移动，鬼：隐藏→显示→透明
- [x] 灯放下后有直线 lit
- [ ] 镜放入、旋转后光 90° 折（Step 2）
- [ ] 两鬼同时显示 → **松手后** 进相机（拖动中不进）
- [ ] 拍照 → 过关
- [ ] 返回 → 可改布局
- [ ] 重开 → 全藏 + 道具回托盘
- [x] 鬼格不能放道具；墙不能放
- [x] letterbox 外点击忽略

---

## Slice 1 · 确定四件齐

- [ ] **S1.1** optics：`beam_splitter`（反射+透射，反面挡）— 算法已有，待接 UI
- [ ] **S1.2** optics：`diffuser`（8 邻，原光止）— 算法已有，待接 UI
- [ ] **S1.3** 多 light 并集（含 locked light）
- [ ] **S1.4** 手测 S3 半透、S4 漫射
- [ ] **S1.5** 托盘/渲染支持 splitter + diffuser
- [ ] **S1.6** `level_002.json`（半透或漫射教学向）

---

## Slice 2 · 多关与教学序

- [ ] **S2.1** 关卡列表 / 选关或顺序下一关
- [ ] **S2.2** 按 LEVEL_DESIGN 批次 A→D 至少 4 关 JSON
- [ ] **S2.3** teaches/requires 元数据（可选校验）
- [ ] **S2.4** Won → 下一关入口

---

## Slice 3 · 手感与表现

- [ ] **S3.1** 震动：拖灯近鬼档位 + throttle（haptics）
- [ ] **S3.2** lit / 光束表现增强（可选线段）
- [ ] **S3.3** 鬼/道具/房间基础美术皮
- [ ] **S3.4** 音效（可选）
- [ ] **S3.5** 安全区下托盘/HUD 不挡操作

---

## 工程卫生（穿插）

- [x] 类型无 any 滥用；optics 无 DOM/Three 依赖
- [x] 改规则先改 PRODUCT/OPTICS/INTERACTION 再改码
- [ ] （可选）Vitest + optics S1–S5
- [ ] （可选）NotebookLM 同步更新后的 md

---

## 明确不做（本 Todo 范围外）

- [-] 斜向光真实算法  
- [-] 备选道具全量  
- [-] 关卡编辑器 / 自动求解  
- [-] 存档云进度  
- [-] Android  

---

## 进度摘要

| Slice | 进度 |
|-------|------|
| 0 最小可玩 | ~55%（Step 1：拖灯找鬼；缺镜/相机/重开 UI） |
| 1 四件齐 | 0%（optics 分支预留） |
| 2 多关 | 0% |
| 3 表现 | 0% |

---

## 修订

| 版本 | 说明 |
|------|------|
| v0.1 | 初版实现 todolist（Slice 0–3） |
| v0.2 | 吸收 NotebookLM 审稿：单面镜、locked、canPlace 鬼格、safe-area、R21 |
| v0.3 | **Step 1 交付**：types/optics/ghosts/board/level + DOM 拖灯扫鬼；勾选 A1/A4–A6/C1/C3/C5/D1–D2/D4 |

---

## Step 1 偏差说明

| 项 | 说明 |
|----|------|
| B1 tray | 规格 Slice0 含 mirror×1；本步范围仅 light×1，有意收窄 |
| A2 mirror | `optics.ts` 已实现 R02 映射，但无镜 UI/关卡，未手测 S2 |
| session | 未建 `session.ts` / 相机 / 过关（本步明确不做） |
| 资源路径 | 使用 `./prop-light.png`、`./ghost.png`、`./board-bg.jpg`（Vite public + `base: './'`） |
| 坐标 | pointer → `stage.getBoundingClientRect()` / scale（等价 design 管道，letterbox 外忽略） |
