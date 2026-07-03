# auto-evo · 架构蓝图与区域轮巡表（REGIONS）

> 本文件是 /auto-evo 的**权威选区蓝图**。每轮（默认每 3 小时一次）只聚焦**一个区域**，
> 区域由时钟确定性选出（见下方"选区算法"），轮巡一圈后从头再来。
> 维护者新增/拆分模块时更新本表并保持 `order` 连续；区域总数 N = 表中条目数。

## 选区算法（确定性、免持久化游标）
- `blockIndex = floor(UTC_epoch_seconds / 10800)`（10800 = 3 小时）
- `regionIndex = blockIndex mod N`
- 取 `order == regionIndex` 的区域为**本轮唯一聚焦区**。
- cron `0 */3 * * *` 在 00/03/06/09/12/15/18/21 UTC 触发，每次 blockIndex 恰好 +1 → 逐区前进、每日巡满一圈。
- 计算示例：`date -u +%s` → 除以 10800 取整 → 对 N 取模。

## 维度优先级（与 SKILL.md §0 一致）
1) 资金/托管安全 > 2) API/越权与数据安全 > 3) 撮合/结算一致性 > 4) 并发/吞吐/延迟

## 区域表（N = 8）

| order | region | 层 | 主聚焦维度 | 代码范围（glob/文件） | 门禁画像 | 已知锚点/重点 |
|---|---|---|---|---|---|---|
| 0 | `contracts-settlement-escrow` | contracts | ①资金（最高） | `contracts/src/market/BinaryPredictionMarket.sol` | 合约重门禁：fork@pinned + invariant/fuzz + slither + storage-layout；§8 资金安全论证 | escrow 状态机、claim/refund 偿付、solvency 不变量；全程 `safeTransfer/safeTransferFrom`（202–375 行）；`erc20-unchecked-transfer@145` 为 forge-lint 误锚，勿臆造修复 |
| 1 | `contracts-pricing-cpmm` | contracts | ①资金 + ③一致性 | `contracts/src/pricing/CPMMEngine.sol`、`contracts/src/interfaces/ICPMMEngine.sol` | 合约重门禁 + buy/sell 域 fuzz@pinnedSeed | 定价数学、精度/舍入、quote==execution 等价、费率累计；已有 `testFuzz_sell*`（runs≥200） |
| 2 | `contracts-factory-fees` | contracts | ①资金 | `contracts/src/market/MarketFactory.sol`、`contracts/src/fees/{Treasury,FeeRouter,ITreasury}.sol` | 合约重门禁 + 费用路由对账 | 工厂参数校验、费用路由、Treasury sweep/refund 窗口、`treasury_delta == trading_fees + sweep_delta` |
| 3 | `contracts-tokens` | contracts | ①资金 + ③一致性 | `contracts/src/tokens/{OutcomeToken,MockUSDT}.sol`、`contracts/src/settlement/AdminOracleResolver.sol`、`contracts/src/interfaces/*` | 合约重门禁 + resolver 边界 + 接口面 | OutcomeToken 铸销权限、resolver 授权边界、接口/事件面稳定性（改 ABI→上报项） |
| 4 | `server-auth` | backend | ②API/越权（高） | `server/src/auth/**`（jwt/guards/roles/decorators） | 后端重门禁：API 集成 + 越权负样本套件 + semgrep + 依赖审计 | authN 正确性、JWT 校验/过期/签名、`roles.guard`/`admin-token.guard`/`jwt-auth.guard`；鉴权只增不减 |
| 5 | `server-market-amm` | backend | ②越权 + ③一致性 | `server/src/market/**`、`server/src/amm/**`、`server/src/events/**` | 后端重门禁 + 撮合不变量/fuzz@pinnedSeed + 负载@loadProfile | 下单/成交端点、AMM 代理、market 资源 IDOR/BOLA、撮合幂等与事务一致 |
| 6 | `server-user-rewards` | backend | ②越权（高） | `server/src/user/**`、`server/src/referral/**`、`server/src/quest/**`、`server/src/season/**`、`server/src/round/**`、`server/src/strategy/**`、`server/src/team/**` | 后端重门禁 + 越权负样本（每个用户态资源） | 用户自有资源/奖励/邀请/任务的 IDOR/BOLA 热点、奖励发放幂等、限流 |
| 7 | `indexer-reconciliation` | indexer/跨层 | ③一致性 + ①资金（XMarket 硬门禁） | `indexer/src/projections/**`、`indexer/src/sync/**`、`indexer/src/api/**` | 跨层对账测试（链上↔链下）+ 投影幂等 + 最终一致 | reserve/trade/claim/market/position 投影、Σ链上托管余额 == 后端账本未结算额、事件→账本幂等、event-log 回放 |

## 上报项（跨区契约，单轮不自动改）
- 合约 ABI / 接口 / 事件签名（影响 indexer abi 与 packages/abi、packages/sdk）。
- OpenAPI / 路由契约、authZ 角色-资源模型、DB schema（server/prisma、indexer/prisma、license-server/prisma）。
- 事件→账本映射口径、资金守恒等式。
变更以上者：开 PR + 人工 review，绝不自动合受保护分支。

## 非轮巡区（默认排除，显式指定才进）
- `src/**`（Next.js 前端）、`admin-web/**`、`license-server/**`、`docs/**`、`scripts/**`、`packages/**`（仅作上报项关联，不主动改）。
