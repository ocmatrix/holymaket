# PR-19D Projection / Position Aggregation + Read API

## 范围

本 PR 在 `indexer/` 内完成以下能力：

- 扩展 `BinaryPredictionMarket` 事件扫描
- 将链上事件投影到 `Trade`、`Claim`、`ReserveSnapshot`
- 基于事件增量聚合 `UserPosition`
- 提供本地只读 HTTP API

本 PR 不包含：

- 前端接入
- 链上写交易
- 合约修改
- `packages/abi/*.json` 修改
- GraphQL / WebSocket / Redis / BullMQ

## 事件来源

事件签名直接核对自：

- `contracts/src/interfaces/IBinaryPredictionMarket.sol`
- `contracts/src/market/BinaryPredictionMarket.sol`

Indexer 内使用 `indexer/src/abi/binary-prediction-market.ts` 的最小 `parseAbi` fragment，不修改导出的 ABI JSON。

## 同步策略

- 保持 `MarketFactory.MarketCreated` 的既有同步逻辑不变
- 从 `Market` 表读取已发现的 `marketAddress`
- 对每个市场使用独立 `IndexerState`
  - `scope = "market"`
  - `contractAddress = marketAddress.toLowerCase()`
- 起始块优先使用 `Market.createdBlockNumber`
- 若 `createdBlockNumber` 缺失，则回退到 `INDEXER_START_BLOCK`
- 每个 batch 内按 `blockNumber + logIndex` 顺序处理事件
- 事务内先写 `IndexerEventLog`
- 只有事件日志首次插入时才执行业务投影
- batch 全部成功后再推进 market 级游标
- batch 失败时不推进游标

## Projection 规则

### Trade

- `PositionBought` -> `Trade(action=Buy)`
- `PositionSold` -> `Trade(action=Sell)`
- `side` 映射：
  - `1 -> Yes`
  - `2 -> No`
- `collateralAmount / sharesAmount / feeAmount` 全部以 `string` 入库

### Market

- `MarketResolved(outcome=Yes|No)` -> `Market.status = Resolved`
- `MarketResolved(outcome=Cancelled|Invalid)` -> `Market.status = Canceled`
- `resolvedBlockNumber / resolvedTxHash` 在投影时写入
- `ReservesUpdated / PositionBought / PositionSold` 会把 `Created` 市场提升为 `Open`

## Claim

- `RewardClaimed` -> `Claim(type=Reward)`
- `RefundClaimed` -> `Claim(type=Refund)`
- `TreasuryRefundClaimed` -> `Claim(type=TreasuryRefund, userAddress=null)`

## UserPosition 聚合

- 主键：`(chainId, marketAddress, userAddress)`
- `PositionBought`：累加对应 side shares
- `PositionSold`：扣减对应 side shares
- 如果卖出导致份额为负，抛错并回滚 batch
- `RewardClaimed`：设置 `claimed = true`，并清零获胜 side
- `RefundClaimed`：设置 `refunded = true`，并清零双边 shares

## API

启动：

```bash
cd indexer
npm run api
```

路由：

- `GET /health`
- `GET /markets`
- `GET /markets/:marketAddress`
- `GET /markets/:marketAddress/trades`
- `GET /users/:address/positions`
- `GET /users/:address/trades`
- `GET /users/:address/claims`

API 规则：

- 仅提供 GET
- 地址查询统一 lower-case
- 所有金额和 `BigInt` 字段返回 `string`
- 所有 `DateTime` 字段返回 ISO string
- 不暴露 `DATABASE_URL` 或 RPC secret

## 本地验证摘要

- `npm run typecheck`：通过
- `npm run dev`：通过
- `npm run db:generate`：通过
- `npm run db:migrate`：通过
- `npm run db:check`：通过
- `npm run sync`：通过
- 重复 `npm run sync`：通过，无重复插入
- `npm run api` + `curl`：通过

## 已知限制

- 当前 schema 仅显式表达 `MarketOutcome.Yes / No / Unresolved`
- `Cancelled / Invalid` 市场在 Phase 1 先折叠为 `Market.status = Canceled`、`Market.outcome = Unresolved`
- 若使用强限流公共 RPC，短时间高频重复同步可能遇到 `429`，本地建议使用更稳定的只读 RPC

## 后续计划

- PR-19E：前端接入 indexer 只读 API
