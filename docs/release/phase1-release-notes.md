# XMarket Phase 1 Release Notes

## 1. Phase 1 版本范围

Phase 1 的目标是交付一个“受控生产可用”的测试网版本，覆盖最小链上市场生命周期 + 最小链下 Indexer 数据层 + 前端最小集成。

本版本冻结结论见 [phase1-final-freeze.md](file:///Users/mac/Documents/zhangyu/XMarket/docs/release/phase1-final-freeze.md)。

## 2. 合约能力

- 支持 BinaryPredictionMarket 市场生命周期（测试网验证）
- 支持使用 MockUSDT 作为抵押物的测试路径
- BSC Testnet 已部署地址已整理（见下文）

## 3. 前端能力

- 本地 Next.js 启动并展示市场页与市场详情页
- 未连接钱包时提示正常
- 保留 approve / buy / sell / claim 入口按钮（Phase 1 不扩展业务逻辑）
- 接入 Indexer Read API 展示链下聚合数据，并在 API 不可用时提供 unavailable 降级

## 4. Indexer 能力

- 基于 viem 的只读链上事件扫描与幂等写库
- Prisma/PostgreSQL 数据库 schema（Phase 1 冻结）
- Projection / Position aggregation：
  - trades（Buy/Sell）
  - claims（Reward/Refund/TreasuryRefund）
  - reserves snapshots
  - user positions 聚合

## 5. API 能力

只读 HTTP API（Fastify）：

- `GET /health`
- `GET /markets`
- `GET /markets/:marketAddress`
- `GET /markets/:marketAddress/trades`
- `GET /users/:address/positions`
- `GET /users/:address/trades`
- `GET /users/:address/claims`

## 6. 测试网部署信息

- 网络：BSC Testnet (Chain ID: 97)
- MarketFactory: `0x45ab369f65c0ef44c1325323f283e6acc92b8bd0`
- CPMMEngine: `0x16fae185a854a54307f6dea9c0d53e326bb4f82f`
- Standalone BinaryPredictionMarket: `0x05caa8a264b2436f1851a58f4f183350fd330a2f`
- MockUSDT: `0xb90278a476319CbDAd259e4fEAA8E7d9Da05e1EB`
- Smoke Test Market: `0x87445F25F78e3eeE91090C80BdeB2F1ae1296A07`

## 7. 验证结果摘要

Phase 1 的最终回归命令与 Stage 1 本地验收记录统一收敛在：

- [phase1-final-freeze.md](file:///Users/mac/Documents/zhangyu/XMarket/docs/release/phase1-final-freeze.md)

## 8. 不包含内容

Phase 1 明确不包含：

- 不包含主网部署
- 不包含真实资产 / 真实 USDT
- 不包含中心化撮合
- 不包含订单簿
- 不包含后台管理
- 不包含自由转让 YES/NO 份额
- 不包含自建行情源
- 不包含生产服务器部署

## 9. 后续 Phase 2 候选方向

- 自托管部署工程化（docker/pm2/systemd）、健康检查、日志轮转、告警、备份与恢复演练
- 多网络/多环境配置策略与可配置化合约地址管理
- 生产化稳定性：RPC 选择、限流处理、重试策略与观测指标
- 安全审计与上线演练流程（主网前置条件）
