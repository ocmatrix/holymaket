# XMarket Indexer

XMarket 链下数据索引层，负责将链上合约事件转换为结构化查询数据。

## 当前状态

当前 `indexer/` 已完成三个阶段的基础设施：

- PR-19A：Bootstrap
  - 最小 Node.js + TypeScript 工程
  - viem 只读连接到 BSC Testnet
  - 读取 `MarketFactory.ammEngine()` 与 `nextMarketId()`
- PR-19B：Prisma / Database Schema
  - 独立的 Prisma + PostgreSQL schema
  - Prisma Client 生成与 migration 能力
  - 基础数据库连通性检查脚本
- PR-19C：Event Sync Engine
  - `npm run sync` 单次串行同步入口
  - `MarketFactory.MarketCreated` 历史扫描
  - `IndexerEventLog` 幂等写入
  - `IndexerState` 游标读取与推进
  - `Market` 最小 upsert

## 当前边界

当前 `indexer/` **不包含**：

- 完整 `Trade` 业务投影
- `UserPosition` 聚合逻辑
- `Claim / Refund` 业务处理
- HTTP API
- 前端接入
- 合约修改
- ABI JSON 修改

## 环境变量

在 `indexer/` 目录下复制示例环境文件：

```bash
cp .env.example .env
```

`indexer/.env.example` 当前包含：

- `BSC_TESTNET_RPC_URL`
- `INDEXER_CHAIN_ID`
- `DATABASE_URL`
- `INDEXER_START_BLOCK`
- `INDEXER_CONFIRMATIONS`
- `INDEXER_BATCH_SIZE`
- `INDEXER_MAX_BLOCKS_PER_RUN`

注意：

- `DATABASE_URL` 只允许本地开发示例值
- 不要提交真实数据库密码
- 不要提交 `indexer/.env`
- `INDEXER_START_BLOCK` 生产环境应配置为部署前安全块，而不是长期使用 `0`
- 某些公共 BSC Testnet RPC 会限制 `eth_getLogs`，本地同步验证时可仅在未提交的 `.env` 中替换为支持日志查询的公共端点

## 本地数据库示例

如果本地尚未运行 PostgreSQL，可以使用以下本地开发示例：

```bash
docker run --name xmarket-indexer-postgres \
  -e POSTGRES_USER=xmarket \
  -e POSTGRES_PASSWORD=xmarket \
  -e POSTGRES_DB=xmarket_indexer \
  -p 5432:5432 \
  -d postgres:16
```

如果容器已存在：

```bash
docker start xmarket-indexer-postgres
```

以上仅用于本地开发示例，不代表生产配置。

## 常用命令

```bash
npm install

# 保持 PR-19A bootstrap 可用
npm run typecheck
npm run dev

# Prisma / PostgreSQL
npm run db:generate
npm run db:migrate
npm run db:check
npm run db:studio

# PR-19C event sync
npm run sync
```

## 期望输出

`npm run dev` 期望输出：

```text
XMarket Indexer Bootstrap
Chain: BNB Smart Chain Testnet
Connected chainId: 97
MarketFactory: 0x45AB369F65c0eF44c1325323F283e6ACC92B8BD0
Factory ammEngine: 0x16faE185a854a54307F6dEa9c0d53E326bB4f82F
Factory nextMarketId: 1
Indexer bootstrap ready
```

`npm run db:check` 期望输出：

```text
XMarket Indexer DB Check
Markets: 0
Indexer states: 0
Indexer event logs: 0
Database check ready
```

`npm run sync` 期望输出类似：

```text
XMarket Indexer Event Sync
Chain ID: 97
Factory scope: factory
Factory state key: 0x45ab369f65c0ef44c1325323f283e6acc92b8bd0
Factory: 0x45AB369F65c0eF44c1325323F283e6ACC92B8BD0
Latest block: ...
Safe to block: ...
Start block: ...
Batch size: 5000
Scanning factory blocks X - Y
Found MarketCreated: marketId=0 market=0x87445F25F78e3eeE91090C80BdeB2F1ae1296A07
Saved IndexerEventLog: MarketCreated tx=... (inserted or skipped_duplicate)
Upserted Market: 0x87445f25f78e3eee91090c80bdeb2f1ae1296a07
Updated IndexerState: lastIndexedBlock=Y
Sync completed
```

重复运行规则：

- `IndexerEventLog` 依赖 `(chainId, txHash, logIndex)` 做幂等
- 同一事件重复扫描时只会 `skipped_duplicate`，不会抛唯一约束异常
- `IndexerState` 仅在 batch 全部写库成功后推进
- batch 失败时不推进游标

## 目录结构

```text
indexer/
  prisma/
    schema.prisma
    migrations/
  src/
    index.ts
    config/
      chains.ts
      contracts.ts
      env.ts
    lib/
      public-client.ts
      startup-check.ts
      prisma.ts
      db-check.ts
    abi/
      market-factory.ts
    sync/
      config.ts
      block-range.ts
      indexer-state.ts
      event-log.ts
      market-discovery.ts
      factory-sync.ts
      index.ts
  package.json
  tsconfig.json
  .env.example
  README.md
```

## 数据库模型

PR-19B 当前冻结的最小 Phase 1 模型：

- `Market`
- `Trade`
- `UserPosition`
- `Claim`
- `ReserveSnapshot`
- `IndexerState`
- `IndexerEventLog`

设计约束：

- 所有链上金额字段使用 `String`，避免 JS number 精度问题
- 地址字段按约定统一存 lowercase
- 事件幂等统一依赖 `(chainId, txHash, logIndex)` 复合唯一约束

## 后续 PR 计划

| PR | 内容 |
|----|------|
| PR-19D | Projection / Position Aggregation |
| PR-19E | Read API |
| PR-19F | Frontend 接入 Indexer 数据层 |
