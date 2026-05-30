# PR-19E Frontend Indexer Data Integration

## 1. 目标

PR-19E 在现有前端中接入 PR-19D 已提供的 Indexer Read API，用于展示：

- 市场列表与市场详情
- 当前市场 indexed trade history
- 钱包地址维度的 indexed positions
- 钱包地址维度的 indexed trades
- 钱包地址维度的 indexed claims

本 PR 只新增前端只读数据接入，不改变链上交易路径。

## 2. 使用的 Indexer API

- `GET /health`
- `GET /markets`
- `GET /markets/:marketAddress`
- `GET /markets/:marketAddress/trades`
- `GET /users/:address/positions`
- `GET /users/:address/trades`
- `GET /users/:address/claims`

地址参数统一 lower-case 后请求。

## 3. 前端环境变量

前端公开配置增加：

```env
NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL=http://localhost:4000
```

说明：

- 默认本地开发地址为 `http://localhost:4000`
- 仅允许使用 `NEXT_PUBLIC_` 前缀公开 URL
- 不向前端暴露 `DATABASE_URL`、RPC secret 或私钥

## 4. 页面接入点

### market 页

- 通过 `c10-prediction-panel` 展示 `Indexer Read API` 状态
- 展示 smoke test market 的 indexed status、outcome、trade count、latest data
- 保留现有链上 approve / buy / sell / claim 按钮与逻辑

### market/[id] 页

- 读取 `GET /markets/:marketAddress`
- 读取 `GET /markets/:marketAddress/trades`
- 展示 indexed market metadata 与 trades 列表

### profile 页

- 展示 indexed positions / trades / claims count
- 展示主要持仓摘要
- 钱包未连接时展示 connect wallet 提示

### portfolio 页

- 展示 indexed positions 明细
- 展示 indexed trades 明细
- 展示 indexed claims 明细

## 5. 状态处理

每个接入点都需要覆盖：

- `loading`
- `error`
- `empty`
- `Indexer unavailable`

当 Indexer 不可用时，前端展示：

- `Indexer data unavailable`
- `On-chain trading remains available`

并保持页面可渲染、钱包可连接、链上交易按钮可继续使用。

## 6. 链上交易路径保留

PR-19E 不修改以下链上写交易路径：

- `approve`
- `buyYes`
- `buyNo`
- `sellYes`
- `sellNo`
- `claim`

结论：

- 链上读写继续走 `viem / wagmi / contract`
- 历史与聚合展示走 Indexer Read API

## 7. 明确不做的内容

- 不修改合约
- 不修改 `packages/abi/*.json`
- 不修改 `schema.prisma`
- 不新增 migration
- 不修改 Indexer projection / aggregation 逻辑
- 不新增后端写 API
- 不执行链上写交易
- 不做大规模 UI 重构

## 8. 后续计划

PR-20 Final Freeze 将在 PR-19E 前端只读接入稳定后，对 Phase 1 范围进行最终冻结与验收收口。
