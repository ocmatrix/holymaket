# PR-19C：Event Sync Engine 设计文档

## 1. 目标

在独立的 `indexer/` 子项目中，实现一个最小可运行、可重复执行、可断点续跑的事件同步引擎。

本 PR 只实现：

- `npm run sync`
- `MarketFactory.MarketCreated` 历史扫描
- `IndexerEventLog` 幂等写入
- `Market` 最小 upsert
- `IndexerState` 游标读取与推进
- batch 失败不推进游标
- 重复运行不重复插入、无唯一约束异常
- 文档更新

## 2. 明确边界

本 PR 不做：

- 不改 `indexer/prisma/schema.prisma`
- 不新增 migration
- 不修改 `packages/abi/MarketFactory.json`
- 不做 `Trade` 完整业务投影
- 不做 `UserPosition` 聚合
- 不做 `Claim / Refund` 业务处理
- 不做 API
- 不改前端
- 不改合约
- 不执行链上写交易

## 3. 总体方案

采用单入口串行同步。

运行 `npm run sync` 后：

1. 读取同步配置
2. 创建 `viem` 公共客户端并校验 `chainId = 97`
3. 读取 `IndexerState(scope = "factory", contractAddress = marketFactory)`
4. 计算本轮可扫描区间
5. 按 `INDEXER_BATCH_SIZE` 切分 block range
6. 每个 batch 扫描 `MarketFactory.MarketCreated`
7. 将事件幂等写入 `IndexerEventLog`
8. 将 `Market` 做最小 upsert
9. 仅在 batch 全部写库成功后推进 `IndexerState.lastIndexedBlock`

## 4. 文件边界

新增或修改以下文件：

- `indexer/src/sync/index.ts`
  - 同步入口与主流程输出
- `indexer/src/sync/config.ts`
  - 读取 `INDEXER_START_BLOCK`、`INDEXER_CONFIRMATIONS`、`INDEXER_BATCH_SIZE`、`INDEXER_MAX_BLOCKS_PER_RUN`
- `indexer/src/sync/block-range.ts`
  - 计算 `fromBlock`、`safeToBlock`、`targetToBlock`
  - 切分 batch ranges
- `indexer/src/sync/indexer-state.ts`
  - 读取或初始化 `IndexerState`
  - 在 batch 成功后推进游标
- `indexer/src/sync/event-log.ts`
  - 幂等写入 `IndexerEventLog`
- `indexer/src/sync/market-discovery.ts`
  - 对 `MarketCreated` 做最小 `Market` upsert
- `indexer/src/sync/factory-sync.ts`
  - 扫描 `MarketFactory` 的 `MarketCreated`
  - 调用 event log 与 market discovery
- `indexer/src/abi/market-factory.ts`
  - 如果 JSON 导入不稳定，使用最小事件 ABI fragment
- `indexer/.env.example`
  - 增加同步配置
- `indexer/package.json`
  - 增加 `sync` script
- `indexer/README.md`
  - 增加同步流程与配置说明
- `docs/indexer/pr-19c-event-sync-engine.md`
  - 记录 PR-19C 交付内容
- `docs/XMarket_Phase1_PR_Plan_Status.md`
  - 更新项目状态

## 5. 同步配置

默认使用：

- `INDEXER_START_BLOCK=0`
- `INDEXER_CONFIRMATIONS=12`
- `INDEXER_BATCH_SIZE=5000`
- `INDEXER_MAX_BLOCKS_PER_RUN=20000`

规则：

- 如果 `IndexerState` 不存在，则从 `INDEXER_START_BLOCK` 开始
- 如果 `IndexerState` 存在，则从 `lastIndexedBlock + 1` 开始
- `safeToBlock = latestBlock - confirmations`
- 单次运行最多扫描 `INDEXER_MAX_BLOCKS_PER_RUN`
- 如果 `fromBlock > safeToBlock`，输出 `No new safe blocks to index.`

## 6. 事件范围

本 PR 只处理：

- `MarketFactory.MarketCreated`

事件来源优先级：

1. 优先复用 `packages/abi/MarketFactory.json` 中的 `MarketCreated`
2. 如果导入 JSON 在 `tsx` 中不稳定，则使用 `indexer/src/abi/market-factory.ts` 中的最小事件 ABI

不修改现有 ABI JSON。

## 7. IndexerEventLog 设计

每条 `MarketCreated` 事件写入：

- `chainId`
- `contractAddress`
- `eventName = "MarketCreated"`
- `txHash`
- `logIndex`
- `blockNumber`
- `blockHash`
- `blockTimestamp`
- `processedAt`

幂等依赖现有唯一约束：

- `@@unique([chainId, txHash, logIndex])`

重复运行时：

- 已存在事件不重复插入
- 不抛唯一约束异常
- 可输出 `inserted` 或 `skipped duplicate`

## 8. Market 最小 upsert 设计

`Market` 只写最小字段：

- `chainId`
- `marketId`
- `marketAddress`
- `factoryAddress`
- `createdBlockNumber`
- `createdTxHash`
- `createdLogIndex`
- `status`
- `outcome`

约束：

- 地址统一存 lowercase
- `status` 使用当前 schema 中的最小初始值
- `outcome = Unresolved`
- 使用现有唯一约束做 upsert
- 不扩展 `Market` 表字段

## 9. IndexerState 设计

本 PR 使用：

- `scope = "factory"`
- `contractAddress = marketFactory lowercase`

推进规则：

1. 读取当前 batch
2. 写入 `IndexerEventLog`
3. upsert `Market`
4. 只有以上全部成功后，才将 `lastIndexedBlock` 更新为当前 batch 的 `toBlock`

如果 batch 失败：

- 不推进游标
- 直接报错退出

## 10. 错误处理

至少处理以下错误并清晰输出：

- RPC 连接失败
- `chainId` 非 97
- `DATABASE_URL` 缺失
- `getLogs` 失败
- Prisma 写入失败
- batch 失败

本 PR 不实现复杂 retry。

## 11. 本地验证

Stage 1 需要验证：

```bash
cd indexer
npm install
npm run typecheck
npm run dev
npm run db:generate
npm run db:migrate
npm run db:check
npm run sync
npm run sync
npm run db:check

cd ../contracts
forge build --sizes
forge test --fuzz-runs 200 -vvv

cd ..
node ./node_modules/next/dist/bin/next build
```

成功标准：

- `npm run sync` 可执行
- 能扫描 `MarketFactory.MarketCreated`
- 能写入或幂等跳过 `IndexerEventLog`
- 能最小 upsert `Market`
- 能推进 `IndexerState`
- 第二次运行不重复插入、无唯一约束异常

## 12. 后续 PR

PR-19D 再处理：

- `Trade` 业务投影
- `UserPosition` 聚合
- `Claim / Refund` 业务处理
- 更完整的市场元数据与状态同步
