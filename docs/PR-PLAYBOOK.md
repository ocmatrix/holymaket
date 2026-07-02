# XMarket auto-evo · PR 规划手册（PR-PLAYBOOK）

> **本文件是 auto-evo 计划与状态的单一真相源（living document）。**
> 每轮 T0 只读它恢复计划；每轮 T-末 门禁全绿后回写它。运行态计数在 `.auto-evo/daily-<date>.json`，两者不混。
> 架构蓝图（只读权威）：`docs/XMarket_Phase1_Architecture_Blueprint.md` + `docs/XMarket_Phase1_Boundary_And_Freeze_Spec.md` + `.claude/skills/auto-evo/REGIONS.md`。
> 冻结/未冻结基线来自蓝图 §7/§8；本手册的"上报项"以冻结面为准。

## 0. 领域优先级（沿用 §0 四维，不新增）
资金/托管安全 > API/越权与数据安全 > 撮合/结算一致性 > 并发/吞吐/延迟。

## 1. 巡次与轮换记录（Sweep / Rotation Log）
- **Sweep 0 — Bootstrap（本轮）**：扫描架构蓝图与仓库，产出下方模块清单与每模块 PR 路线图，生成 config；cursor=0。未改任何业务代码。
- 选区节律：每 3h 一小轮、按时钟 `regionIndex = floor(epoch/10800) mod 8` 落区；8 小轮 = 一大轮（全模块覆盖一圈）→ 打 `baseline-<K+1>`。
- 当前基线锚点：`baseline-1`（人工冻结起点，指向 skill-setup 分支良好提交）。
- 冷启动时刻参考：`regionIndex(now)=7`（仅参考；正式开工从下一轮按时钟选区）。

## 2. 模块清单（Module Inventory，8 区，与 REGIONS.md 对齐）

| order | 模块 | 路径 | 依赖方向 | 主风险面 | 主维度 |
|---|---|---|---|---|---|
| 0 | contracts-settlement-escrow | `contracts/src/market/BinaryPredictionMarket.sol` | 依赖 CPMMEngine(报价)、Treasury/FeeRouter(费)、OutcomeToken/collateral | escrow 状态机、claim/refund 偿付、solvency、重入 | ①资金(最高) |
| 1 | contracts-pricing-cpmm | `contracts/src/pricing/CPMMEngine.sol`、`interfaces/ICPMMEngine.sol` | 被 BinaryPredictionMarket 调用；不持资金 | 定价数学、精度/舍入、quote==exec、k 不变量 | ①资金+③一致性 |
| 2 | contracts-factory-fees | `contracts/src/market/MarketFactory.sol`、`fees/{Treasury,FeeRouter,ITreasury}.sol` | Factory 建市；Treasury 收费/sweep | createMarket 原子注资(未冻结)、费用路由、sweep 授权 | ①资金 |
| 3 | contracts-tokens | `contracts/src/tokens/{OutcomeToken,MockUSDT}.sol`、`settlement/AdminOracleResolver.sol`、`interfaces/*` | OutcomeToken 由 market 铸销；Resolver 写结算态 | 铸销权限、resolver 授权边界、接口/事件面 | ①资金+③一致性 |
| 4 | server-auth | `server/src/auth/**` | 被各 controller 依赖(guards/roles) | authN、JWT、guards、越权基线 | ②API/越权(高) |
| 5 | server-market-amm | `server/src/market/**`、`amm/**`、`events/**` | 依赖 auth；对接链上/indexer | 下单/成交端点、AMM 代理、IDOR/BOLA、撮合幂等 | ②越权+③一致性 |
| 6 | server-user-rewards | `server/src/{user,referral,quest,season,round,strategy,team}/**` | 依赖 auth；用户自有资源 | 奖励/邀请/任务 IDOR/BOLA、发放幂等、限流 | ②越权(高) |
| 7 | indexer-reconciliation | `indexer/src/{projections,sync,api}/**` | 消费链上事件→后端账本 | reserve/trade/claim/position 投影、Σ托管==账本、事件幂等 | ③一致性+①资金(跨层) |

## 3. 每模块 PR 路线图（待办 / 进行 / 已完成）

> 说明：以下为**前瞻性加固路线图**（Phase 1 已冻结基线之上的安全/一致性/质量强化）。
> 触及"上报项"（§4 冻结面）者一律开 PR 候人工 review，不自动改。每条 PR 起工时在此登记"进行"，门禁全绿后转"已完成"并附提交/PR 链接。

### 0 · contracts-settlement-escrow
- [ ] 待办 E1：claim/refund 偿付路径重入与幂等复核，补 solvency 不变量/负样本测试（不改结算数学）。
- [ ] 待办 E2：escrow 状态机迁移守卫的显式 revert 断言测试增强（等价、只增测试）。
- ⚠ 上报项：结算数学、精度/舍入、refundWindow、托管状态机语义（冻结）。

### 1 · contracts-pricing-cpmm
- [ ] 待办 C1：buy 域 fuzz 与 quote==execution 等价断言补强（sell 域已冻结，勿动）。
- ⚠ 上报项：sell quote 数学、quoteSell 输入域、k 不变量、rounding≤5（全部冻结）→ 只对标、只补测试、不改实现。

### 2 · contracts-factory-fees
- [ ] 待办 F1：createMarket 原子注资闭环（**未冻结**）——设计+PR 候审，补 fork/对账测试证明无资金错配。
- [ ] 待办 F2：Treasury sweep / feeRouter 授权与费用路由对账测试增强。
- ⚠ 上报项：Treasury sweep 规则（冻结）；费率/精度改动。

### 3 · contracts-tokens
- [ ] 待办 T1：OutcomeToken 铸销权限最小化复核 + 负样本（非市场调用被拒）。
- [ ] 待办 T2：AdminOracleResolver 授权边界与证据字段校验测试（受控 resolver，治理属未冻结）。
- ⚠ 上报项：接口/事件签名（牵动 indexer abi、packages/abi/sdk）。

### 4 · server-auth
- [ ] 待办 A1：搭建后端测试脚手架（vitest + supertest），JWT 校验/过期/签名单测。
- [ ] 待办 A2：guards（jwt/roles/admin-token）越权基线测试。
- ⚠ 上报项：authZ 角色-资源模型。

### 5 · server-market-amm
- [ ] 待办 M1：market/amm 受保护端点 IDOR/BOLA 负样本套件（非 owner→401/403/404）。
- [ ] 待办 M2：撮合/下单幂等与事务一致性属性测试（fast-check @pinnedSeed）。
- ⚠ 上报项：OpenAPI 路由契约、撮合不变量。

### 6 · server-user-rewards
- [ ] 待办 U1：user/referral/quest/season 用户态资源 IDOR/BOLA 负样本套件。
- [ ] 待办 U2：奖励/邀请发放幂等键与限流复核。
- ⚠ 上报项：奖励规则涉及的 DB schema。

### 7 · indexer-reconciliation
- [ ] 待办 I1：链上↔链下对账断言（Σ链上托管余额 == 后端账本未结算额）测试化。
- [~] 进行 I2：投影幂等与事件重放最终一致测试。
  - [x] position 投影：invariants + idempotency 覆盖（sell 越额拒绝/round-trip 守恒/claim·refund 幂等与终态）— round 1，commit 774e1df，13/13 green。
  - [ ] 残留：reserve/trade/claim 投影的幂等与"带 DB 的事件重放最终一致"测试（需 Prisma client 生成；本环境引擎二进制下载被 egress 策略拦截 → 上报项 D2）。
- ⚠ 上报项：事件→账本映射口径、`schema.prisma`。

## 4. 上报项（冻结面与跨层契约 · 不自动改，开 PR 候人工 review）
- 合约：CPMM sell quote 数学与输入域、显式 revert 规则、k 不变量、rounding≤5、refundWindow、Treasury sweep、Phase 1 测试基线。
- 跨层契约：合约 ABI/接口/事件签名（→ `packages/abi`、`packages/sdk`、`indexer/src/abi`）、OpenAPI 路由、authZ 角色-资源模型、`schema.prisma`（server/indexer/license-server）、事件→账本映射、资金守恒等式。

## 5. 关键决策（Decisions Log）
- D0（bootstrap）：以 Phase 1 冻结基线为红线，auto-evo 只做冻结面之上的加固；后端目前无测试，故 server-* 各区首要 PR 是"补测试脚手架 + 越权负样本"，再谈优化。
- D1：合约类区若无只读 RPC，fork 门禁降级为 build+unit+invariant/fuzz+slither+snapshot 并在报告标注。
- D2（上报项/环境）：indexer 全量 `tsc --noEmit` 与带 DB 的投影测试在本环境无法通过——`@prisma/client` 生成需下载引擎二进制，被 egress 策略拦截（ECONNRESET）。故本区暂只做"纯 reducer"层测试（`node --test`，不依赖 Prisma runtime）。补齐带 DB 的对账测试需：可访问 Prisma 引擎的环境，或将 indexer typecheck/test 纳入仓库 CI。归上报项待人工决策。

## 6. 巡次历史（追加式）
- 2026-07 Sweep 0：Bootstrap 完成，计划与 config 落盘，cursor=0，未改业务代码。
- 2026-07-02 round 1（region 7 indexer-reconciliation）：I2 position 投影 invariants/idempotency 测试（+8，13/13 green，test-only），commit 774e1df。大轮未满（仅覆盖 region 7），P7 跳过基线。新增决策 D2。
