# PR-19B：Prisma / Database Schema 本地开发记录

## 1. PR-19B 目标

- 在独立的 `indexer/` 子项目中引入 Prisma + PostgreSQL
- 新增并冻结 Phase 1 最小数据库模型
- 增加 Prisma Client 生成能力
- 增加 migration 能力
- 增加基础数据库检查脚本
- 保持 PR-19A `npm run dev` 启动链路可用

## 2. 新增依赖

- dependencies
  - `@prisma/client`
- devDependencies
  - `prisma`

## 3. 数据库模型列表

- `Market`
- `Trade`
- `UserPosition`
- `Claim`
- `ReserveSnapshot`
- `IndexerState`
- `IndexerEventLog`

## 4. 关键唯一约束

- 事件幂等
  - `Trade`: `@@unique([chainId, txHash, logIndex])`
  - `Claim`: `@@unique([chainId, txHash, logIndex])`
  - `ReserveSnapshot`: `@@unique([chainId, txHash, logIndex])`
  - `IndexerEventLog`: `@@unique([chainId, txHash, logIndex])`
- 市场唯一性
  - `Market`: `@@unique([chainId, marketAddress])`
  - `Market`: `@@unique([chainId, marketId])`
- 持仓唯一性
  - `UserPosition`: `@@unique([chainId, marketAddress, userAddress])`
- 同步游标唯一性
  - `IndexerState`: `@@unique([chainId, scope, contractAddress])`

## 5. 金额字段为什么使用 String

链上金额、份额、储备金与 fee 字段都可能超出 JavaScript `number` 的安全整数范围。

因此 PR-19B 在 Prisma schema 中统一将金额类字段建模为 `String`，保留十进制整数字符串，后续由 PR-19C / PR-19D 在事件处理和聚合层中使用 `bigint` 或等价安全数值类型计算。

## 6. 地址字段存储规范

- 所有地址字段在数据库中使用 `String`
- 写入数据库前统一转换为 lowercase
- PR-19B 只冻结存储规范，不实现事件写入逻辑

涉及字段包括：

- `marketAddress`
- `factoryAddress`
- `collateralToken`
- `userAddress`
- `contractAddress`

## 7. 本地验证命令

```bash
cd indexer
npm install
npm run typecheck
npm run dev
npm run db:generate
npm run db:migrate
npm run db:check

cd ../contracts
forge build --sizes
forge test --fuzz-runs 200 -vvv

cd ..
node ./node_modules/next/dist/bin/next build
```

如果本地没有 PostgreSQL，可使用本地开发示例：

```bash
docker run --name xmarket-indexer-postgres \
  -e POSTGRES_USER=xmarket \
  -e POSTGRES_PASSWORD=xmarket \
  -e POSTGRES_DB=xmarket_indexer \
  -p 5432:5432 \
  -d postgres:16
```

## 8. 明确不包含

- 不包含事件同步
- 不包含链上区块扫描
- 不包含业务投影
- 不包含 HTTP API
- 不包含前端接入
- 不包含合约修改
- 不包含 ABI JSON 修改

## 9. 后续 PR-19C 计划

PR-19C 将基于本 PR 已冻结的 schema，实现：

- `MarketFactory` / `BinaryPredictionMarket` 事件扫描入口
- 事件去重与 `IndexerEventLog` 写入
- `Market` / `Trade` / `Claim` / `ReserveSnapshot` 的基础落库
- `IndexerState` 同步进度更新
