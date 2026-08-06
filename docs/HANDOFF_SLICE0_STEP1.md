# 交接说明 · 实现第 1 步（基础操作 + 寻找鬼魂）

| | |
|--|--|
| 版本 | **v0.1** |
| 适用 | 新窗口 / 新会话开工编码 |
| 仓库 | `NewProject_Puzzle` |

---

## 1. 本步目标

只做：

1. 5×5 棋盘与背景  
2. 托盘拖出手电、放置、拿起、点旋四向  
3. 光直线亮格（光源格不亮）  
4. 鬼：隐藏 → 完全显示 →（离开后）透明表现  

**不做：** 镜/半透/漫射、拍照过关、多关。

验收清单见 `docs/IMPLEMENTATION_TODO.md` Slice 0 中与「拖灯找鬼」相关项。

---

## 2. 必读规格

| 顺序 | 文档 |
|------|------|
| 1 | `docs/PRODUCT.md` |
| 2 | `docs/OPTICS_SPEC.md`（至少 light + ghost + 占格） |
| 3 | `docs/INTERACTION_SPEC.md`（坐标、托盘、拖动发光） |
| 4 | `docs/ASSETS.md`（**图片路径**） |
| 5 | `docs/IMPLEMENTATION_TODO.md` |
| 6 | `AGENTS.md`（工程壳） |

裁决：PRODUCT → OPTICS → INTERACTION。

---

## 3. 正式图片资源（仅这些）

| 用途 | 路径 |
|------|------|
| 棋盘背景 | `public/board-bg.jpg` |
| 鬼魂（完全显示） | `public/ghost.png` |
| 手电 | `public/prop-light.png` |

运行时 URL（`base: './'`）：`./board-bg.jpg`、`./ghost.png`、`./prop-light.png`。

其它 `prop-mirror` 等为草稿，本步不用。

---

## 4. 建议代码落点

```
src/game/
  types.ts
  optics.ts      # 仅 light
  ghosts.ts
  board.ts
  level.ts
  session.ts     # 可先无 Camera
  input.ts
  view/…
  levels/level_001.json
  index.ts       # mountGame
```

`main.ts`：boot 后挂载玩法；UI 仅 `#ui-root`。

---

## 5. 修订

| 版本 | 说明 |
|------|------|
| v0.1 | 第 1 步交接 + 定稿资源路径 |
