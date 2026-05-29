# XMarket Indexer

XMarket 链下数据索引层，负责将链上合约事件转换为结构化查询数据。

## 当前状态

当前 `indexer/` 已完成两个阶段的基础设施：

- PR-19A：Bootstrap
  - 最小 Node.js + TypeScript 工程
  - viem 只读连接到 BSC Testnet
  - 读取 `MarketFactory.ammEngine()` 与 `nextMarketId()`
- PR-19B：Prisma / Database Schema
  - 独立的 Prisma + PostgreSQL schema
  - Prisma Client 生成与 migration 能力
  - 基础数据库连通性检查脚本

## 当前边界

当前 `indexer/` **不包含**：

- 事件同步 / Event Sync Engine
- 业务投影 / UserPosition 聚合逻辑
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

注意：

- `DATABASE_URL` 只允许本地开发示例值
- 不要提交真实数据库密码
- 不要提交 `indexer/.env`

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
| PR-19C | Event Sync Engine（事件扫描、去重、写入） |
| PR-19D | Projection / Position Aggregation |
| PR-19E | Read API |
| PR-19F | Frontend 接入 Indexer 数据层 |
