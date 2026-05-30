# XMarket Phase 1 Final Freeze (PR-20)

## 1. Phase 1 冻结结论

XMarket Phase 1 is frozen as a controlled production-ready testnet release.

XMarket Phase 1 已完成受控生产可用测试网版本冻结。

## 2. 当前 main commit

- commit: `6d63f8fc7140974c2abbd86e8795095b588fd7c6`

## 3. 已完成模块清单

- Contracts
  - BSC Testnet 部署完成
  - Smoke test market lifecycle 验证完成（见地址清单）
- Frontend
  - 最小链上读写接入（Phase 1 仅测试网）
  - Indexer Read API 数据接入与降级展示（API 不可用时显示 unavailable）
- Indexer
  - Prisma/PostgreSQL schema 已冻结
  - Event sync engine（factory + market events）可重复运行且幂等
  - Projection / Position aggregation 可重复运行且幂等
  - Read API（Fastify）可本地启动并服务前端

## 4. 合约状态

- 网络：BSC Testnet (Chain ID: 97)
- 已部署合约：
  - MarketFactory: `0x45ab369f65c0ef44c1325323f283e6acc92b8bd0`
  - CPMMEngine: `0x16fae185a854a54307f6dea9c0d53e326bb4f82f`
  - Standalone BinaryPredictionMarket: `0x05caa8a264b2436f1851a58f4f183350fd330a2f`
  - MockUSDT: `0xb90278a476319CbDAd259e4fEAA8E7d9Da05e1EB`
- Smoke Test Market:
  - `0x87445F25F78e3eeE91090C80BdeB2F1ae1296A07`

## 5. 前端状态

- 本地默认地址：`http://localhost:3005`
- 依赖 Indexer Read API：
  - env：`NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL`（默认 `http://localhost:4000`）
  - Indexer 可用：展示市场/交易/仓位等链下聚合数据
  - Indexer 不可用：显示 unavailable 降级，不应白屏
- Phase 1 边界：
  - 不做主网部署
  - 不使用真实资产/真实 USDT（测试网使用 MockUSDT）

## 6. Indexer 状态

- Indexer 默认本地 API：`http://localhost:4000`
- 本地模式：Node.js + TypeScript + viem + Prisma + PostgreSQL + Fastify
- Phase 1 边界：
  - Indexer 为本地/自托管模式，不提供托管服务与生产化运维方案

## 7. Read API 状态

只读 API 端点（Phase 1）：

- `GET /health`
- `GET /markets`
- `GET /markets/:marketAddress`
- `GET /markets/:marketAddress/trades`
- `GET /users/:address/positions`
- `GET /users/:address/trades`
- `GET /users/:address/claims`

## 8. BSC Testnet 地址

- Chain ID: `97`
- MarketFactory: `0x45ab369f65c0ef44c1325323f283e6acc92b8bd0`
- CPMMEngine: `0x16fae185a854a54307f6dea9c0d53e326bb4f82f`
- Standalone BinaryPredictionMarket: `0x05caa8a264b2436f1851a58f4f183350fd330a2f`
- MockUSDT: `0xb90278a476319CbDAd259e4fEAA8E7d9Da05e1EB`
- Smoke Test Market: `0x87445F25F78e3eeE91090C80BdeB2F1ae1296A07`

## 9. 最终验证命令与结果

本节用于 PR-20 Stage 1 最终回归记录。命令与通过标准固定；结果将以本分支的本地验收输出为准，不包含任何密钥、私钥或真实数据库密码。

### 9.1 Indexer 验证

```bash
cd indexer
npm install
npm run typecheck
npm run dev
npm run db:generate
npm run db:migrate
npm run db:check
npm run sync
npm run db:check
npm run api
```

```bash
curl http://localhost:4000/health
curl http://localhost:4000/markets
curl http://localhost:4000/markets/0x87445f25f78e3eee91090c80bdeb2f1ae1296a07
curl http://localhost:4000/markets/0x87445f25f78e3eee91090c80bdeb2f1ae1296a07/trades
curl http://localhost:4000/users/0x910956c25fd205a03d6314a3d787194c00022802/positions
curl http://localhost:4000/users/0x910956c25fd205a03d6314a3d787194c00022802/trades
curl http://localhost:4000/users/0x910956c25fd205a03d6314a3d787194c00022802/claims
curl -i -H 'Origin: http://localhost:3005' http://localhost:4000/health
```

### 9.2 Frontend 验证

```bash
node ./node_modules/next/dist/bin/next build
node ./node_modules/next/dist/bin/next dev -p 3005
```

### 9.3 Contracts 验证

```bash
cd contracts
forge build --sizes
forge test --fuzz-runs 200 -vvv
```

### 9.4 PR-20 Stage 1 本地验收记录

- Indexer
  - `npm run typecheck`：PASS
  - `npm run dev`：PASS（Connected chainId=97, nextMarketId=1）
  - `npm run db:generate`：PASS（Prisma Client v6.19.3）
  - `npm run db:migrate`：PASS（Already in sync）
  - `npm run db:check`（before sync）：PASS（Markets=1, Trades=4, UserPositions=1, Claims=1, ReserveSnapshots=5）
  - `npm run sync`：PASS（说明：公共 `data-seed-prebsc-*` RPC 存在 `eth_getLogs` limit exceeded；`bsc-testnet.publicnode.com` 存在历史裁剪，需要以已有 DB + 推进 indexer state 的方式做增量 sync 验证）
  - `npm run db:check`（after sync）：PASS（数据计数保持一致）
  - `npm run api`：PASS（listening on http://localhost:4000；已按验收要求停止）
  - `GET /health`：200 OK
  - `GET /markets`：200 OK
  - `GET /markets/:marketAddress`：200 OK
  - `GET /markets/:marketAddress/trades`：200 OK
  - `GET /users/:address/positions`：200 OK
  - `GET /users/:address/trades`：200 OK
  - `GET /users/:address/claims`：200 OK
  - CORS（Origin: `http://localhost:3005`）：PASS（`access-control-allow-origin: *`）
- Frontend
  - `next build`：PASS（存在 Reown Config 403 warning）
  - `next dev -p 3005`：PASS（已按验收要求停止）
  - `/` 渲染：200 OK（curl）
  - `/market` 渲染：200 OK（curl）
  - `/market/[id]` 渲染：200 OK（curl，market=`0x8744...a07`）
  - Indexer 可用时数据展示：未做浏览器交互验证（以 Indexer API 200 + 页面 200 作为最小渲染证明）
  - Indexer 不可用时 unavailable 降级：PASS（停止 Indexer API 后 `/market` 与 `/market/[id]` 仍 200）
  - 钱包未连接提示：未做浏览器交互验证
  - approve / buy / sell / claim 按钮保留：未做浏览器交互验证
- Contracts
  - `forge build --sizes`：PASS（存在 forge lint warnings）
  - `forge test --fuzz-runs 200 -vvv`：PASS
  - passed：204
  - failed：0
  - skipped：0

## 10. 边界确认

- 本 PR 不新增合约功能，不修改合约业务逻辑，不修改 CPMM 数学
- 本 PR 不修改 `packages/abi/*.json`
- 本 PR 不修改 Prisma schema，不新增 migration
- 本 PR 不修改 Indexer 投影逻辑/同步逻辑/API 逻辑
- 本 PR 不修改前端交易路径与业务逻辑
- 本 PR 不进行链上写交易，不重新部署合约
- 本 PR 不提交任何 `.env` / 私钥 / RPC secret / `DATABASE_URL` 密码

## 11. 已知限制

见 [phase1-known-limitations.md](file:///Users/mac/Documents/zhangyu/XMarket/docs/release/phase1-known-limitations.md)。

## 12. 下一阶段建议

- 优先将 Phase 1 的“自托管部署路径”工程化（docker/pm2/systemd）、并补齐监控告警与备份策略
- 明确多网络/多部署的合约地址配置策略（Phase 2 再引入，不在 PR-20 做逻辑变更）
- Phase 2 如进入主网/真实资产，需在发布前完成安全审计与上线演练流程冻结
