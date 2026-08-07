# 扫描震动规格 · HAPTICS_SPEC

| | |
|--|--|
| 版本 | **v1.2** |
| 状态 | 设计冻结（玩法语义）；定稿参数见 §6 |
| 范围 | 握着手电扫描会话 |
| 实现 | `src/game/feel/haptic-*` · `src/utils/haptics.ts` · `plugins/native-haptics` |
| 调参 | 左下 📳 · 参数真源 `haptic-config.ts` |

> 玩法规则仍认 `PRODUCT.md`；本文只定 **扫描震动语义与分层**。  
> 工程注册坑见 `ENGINEERING.md` § Haptics。

---

## 1. 产品语义

震动表达的是 **手电探查过程**，不是通用 UI 触感。

| 阶段 | 玩家感受 | 语义 |
|------|----------|------|
| 开灯 | 一下通电 | 灯亮了 |
| 扫描中 | 很浅、稳定的持续震 | 灯开着、在扫 |
| 靠近未发现的鬼 | 持续震略变强（越近越强） | 感应变强 |
| 光斑压过未发现鬼格 | 轻轻一点 | 扫到了实体 |
| 压住鬼格蓄光 1s | continuous 从 peak 线性爬到 chargePeak | 充能 |
| 鬼首次完全显示 | 底噪关 → 三段尖峰 → 底噪开 | 现身 |
| 放下灯 | 立刻静 | 探查结束 |

**放置在盘上的灯** 即使仍在照鬼 → **不震**。

---

## 2. 会话边界

```
进入：drag.type === 'light' 且首次 onScanFrame
退出：放下 / 取消 / 重制 / dispose → end()
```

| 条件 | 行为 |
|------|------|
| 非 light 拖动 | 不进会话 |
| 会话外 | 无 continuous、无过格/近鬼 |
| 重制 | `end()` + 关卡重载 |

---

## 3. 事件设计

### 3.1 开灯（Open）

- **一次** Core transient：`openIntensity` / `openSharpness`
- 可选叠 UIKit impact（强度跟 openIntensity）
- `openToContinuousMs` 后再开 continuous

### 3.2 持续底噪（Continuous）

- Core continuous：事件 **base intensity/sharpness = 1**
- 实际手感由 `updateContinuous` 写入 **绝对 0…1**（动态参数作乘数）
- 默认浅底噪 `floor*`；≤30s 到期前 `renewBeforeMs` 续播
- 失败时 UIKit 脉冲兜底（`pulseFallbackMs`）

### 3.3 近鬼加强（仅未发现鬼）

距离 = 光斑中心格 ↔ **最近 !everLit 鬼** 的曼哈顿格数。

| dist | continuous |
|------|------------|
| `≥ nearRadius` | `floor*` |
| `0` | `peak*` |
| `(0, nearRadius)` | **线性** 插值 |

**已发现**（`everLit`）的鬼 **不参与** 距离计算。

### 3.3b 蓄光充能（Charge）

条件：光斑在 **未发现** 鬼格上，且该鬼 `litSince` 计时中（与 `GHOST_REVEAL_DWELL_MS` 同源）。

```
progress = clamp((now - litSince) / dwellMs, 0, 1)
level = peak + (chargePeak - peak) × progress   // 线性
```

- 中途离开 → progress 清零，回到普通近鬼/底噪  
- progress→1 → everLit，接出场三连（此时 mute continuous）

### 3.4 过鬼格（Ghost Pass）

- 触发：光斑中心 **换格** 且新格上有 **!everLit** 鬼
- 一次轻 transient：`ghostPass*`
- `ghostPassCooldownMs` 防抖
- **已发现** 鬼格路过 **不触发**

### 3.5 出场三连（Reveal）

触发：某鬼 `everLit` **false → true**（每只鬼最多一次）。

```
t = 0              → hit #1 (reveal1*)
t = +reveal1to2Ms  → hit #2 (reveal2*)
t = +reveal2to3Ms  → hit #3 (reveal3*)  （相对 #2 的间隔）
```

- 每 hit：独立 intensity / sharpness
- UIKit 仅可选叠在 **#1**（`useImpactReveal`）
- 出场后该鬼退出 3.3 / 3.4
- **三连期间 continuous 底噪立刻 stop**；**#3 触发后**若仍握灯，再按当前近鬼电平 `startContinuous`

---

## 4. 分层与职责

```
玩法 resolve（拖 light）
  → scanHaptics.onScanFrame / end
       → haptic-math     纯距离/插值
       → haptic-patterns 开灯/过格/出场播放
       → haptic-config   参数
       → utils/haptics   Capacitor 桥
            → AdvancedHaptics (Swift)
```

| 模块 | 职责 |
|------|------|
| `haptic-config.ts` | 参数表、默认值、复制快照 |
| `haptic-math.ts` | 未发现鬼过滤、曼哈顿、线性强度 |
| `haptic-patterns.ts` | open / pass / reveal 播放（无会话状态） |
| `scan-haptics.ts` | 扫描会话状态机 |
| `hapticTuner.ts` | 调试 UI |
| `utils/haptics.ts` | 原生桥；失败静默 |
| `plugins/native-haptics` | UIKit + Core Haptics 真源 |

---

## 5. 原生约定

1. **SceneDelegate 必须** `BridgeViewController()`（勿裸 `CAPBridgeViewController`）
2. continuous：`start(1,1)` + `updateContinuous(level)` = 绝对手感
3. impact 可选 `intensity`；调试 buzz 用 AudioServices，玩法默认不绑
4. 验收：**iOS 真机 Capacitor**；Web 无细腻 continuous

---

## 6. 参数真源与定稿默认

文件：`src/game/feel/haptic-config.ts`（`SCAN_HAPTIC` / `DEFAULT_SCAN_HAPTIC`）。  
调参 📳「复制参数」→ 回写该文件。

| 参数 | 定稿默认 |
|------|----------|
| openIntensity / openSharpness | 0.6 / 0.8 |
| openToContinuousMs | 65 |
| floorIntensity / floorSharpness | 0.15 / 0.01 |
| peakIntensity / peakSharpness | 0.2 / 0.1 |
| nearRadius（曼哈顿格） | 3 |
| chargePeakIntensity / Sharpness | 0.35 / 0.15 |
| ghostPassIntensity / Sharpness | 0.51 / 0.18 |
| ghostPassCooldownMs | 180 |
| reveal1 | 0.53 / 0.46 |
| reveal1to2Ms | 40 |
| reveal2 | 0.4 / 0.29 |
| reveal2to3Ms | 40 |
| reveal3 | 0.33 / 0.62 |
| useImpactOpen / Reveal / GhostPass | 1 / 1 / 0 |

---

## 7. 刻意不做

- 放置灯照鬼持续震
- 已发现鬼的近距/过格反馈
- 光斑每换格默认 impact
- 出场三连每下都叠 UIKit（默认仅 #1）

---

## 8. 相关 UI

| UI | 说明 |
|----|------|
| 左下 📳 | 震动调参 / 试振 / 诊断 |
| HUD「重制」 | 关卡重载 + `scanHaptics.end()`（非震动设计本身，但结束会话） |

---

## 修订

| 版本 | 说明 |
|------|------|
| v1.0 | 会话模型、线性近鬼、过格边沿、出场三连、分层模块 |
| v1.1 | 写入定稿默认参数表；索引重制结束会话 |
| v1.2 | 蓄光 chargePeak；出场 mute continuous 再恢复；参数同步 haptic-config |
