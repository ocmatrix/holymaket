# PR-19C：Event Sync Engine

## 1. 目标

在独立 `indexer/` 子项目内实现最小可运行、可重复执行、可断点续跑的事件同步引擎。

本 PR 只实现：

- `npm run sync`
- `MarketFactory.MarketCreated` 历史扫描
- `IndexerEventLog` 幂等写入
- `Market` 最小 upsert
- `IndexerState` 游标读取与推进
- batch 失败不推进游标
- 重复运行不重复插入、无唯一约束异常

## 2. 新增与修改文件

新增：

- `indexer/src/abi/market-factory.ts`
- `indexer/src/sync/config.ts`
- `indexer/src/sync/block-range.ts`
- `indexer/src/sync/indexer-state.ts`
- `indexer/src/sync/event-log.ts`
- `indexer/src/sync/market-discovery.ts`
- `indexer/src/sync/factory-sync.ts`
- `indexer/src/sync/index.ts`

修改：

- `indexer/.env.example`
- `indexer/package.json`
- `indexer/README.md`
- `docs/XMarket_Phase1_PR_Plan_Status.md`

## 3. 同步流程

`npm run sync` 运行流程：

1. 读取 `INDEXER_START_BLOCK`、`INDEXER_CONFIRMATIONS`、`INDEXER_BATCH_SIZE`、`INDEXER_MAX_BLOCKS_PER_RUN`
2. 校验链 ID 必须为 `97`
3. 读取 `IndexerState(scope = "factory", contractAddress = marketFactory lowercase)`
4. 计算本轮 `fromBlock`、`safeToBlock`、`targetToBlock`
5. 按 `INDEXER_BATCH_SIZE` 串行切分 batch
6. 对每个 batch 调用 `getLogs` 扫描 `MarketFactory.MarketCreated`
7. 在同一个数据库事务中完成：
   - `IndexerEventLog` 幂等写入
   - `Market` 最小 upsert
   - `IndexerState.lastIndexedBlock = batch.toBlock`
8. 任一写库失败则回滚该 batch，且不推进游标

## 4. IndexerState 游标设计

- `scope = "factory"`
- `contractAddress = MarketFactory lowercase`
- 如果 state 不存在，则从 `INDEXER_START_BLOCK` 开始
- 如果 state 存在，则从 `lastIndexedBlock + 1` 开始
- 仅当当前 batch 全部处理成功后，才推进到当前 `toBlock`

## 5. IndexerEventLog 幂等设计

`IndexerEventLog` 使用现有唯一约束：

- `@@unique([chainId, txHash, logIndex])`

写入策略：

- 使用 Prisma `createMany(..., skipDuplicates: true)`
- 首次同步写入事件记录
- 重复运行命中同一事件时返回 `skipped_duplicate`
- 不抛唯一约束异常

## 6. MarketCreated 最小发现

`Market` 只写以下字段：

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

- 地址写库前统一转换为 lowercase
- `status = Created`
- `outcome = Unresolved`
- 不改 `schema.prisma`
- 不新增 migration

## 7. 配置项

`indexer/.env.example` 中新增：

```env
INDEXER_START_BLOCK=0
INDEXER_CONFIRMATIONS=12
INDEXER_BATCH_SIZE=5000
INDEXER_MAX_BLOCKS_PER_RUN=20000
```

说明：

- `INDEXER_START_BLOCK` 本地可先用 `0`
- 生产环境应配置为部署前安全块，避免从创世块长期扫描
- `INDEXER_CONFIRMATIONS` 用于跳过未稳定区块
- `INDEXER_MAX_BLOCKS_PER_RUN` 用于限制单次运行扫描长度
- 若默认公共 RPC 限制 `eth_getLogs`，允许只在本地未提交的 `.env` 中切换到支持日志查询的 BSC Testnet 公共端点

## 8. 本地验证命令

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

## 9. 明确边界

本 PR 不包含：

- `Trade` 完整业务投影
- `UserPosition` 聚合
- `Claim / Refund` 业务处理
- API
- 前端修改
- 合约修改
- ABI JSON 修改
- 链上写交易

## 10. 后续 PR-19D

后续 `PR-19D` 再处理：

- `Trade` 业务投影
- `UserPosition` 聚合
- `Claim / Refund` 业务处理
- 更完整的市场状态与业务查询数据
