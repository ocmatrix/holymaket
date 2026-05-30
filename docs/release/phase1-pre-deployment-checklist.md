# XMarket Phase 1 Pre-Deployment Checklist

本文件用于后续“自托管服务器部署”前检查。Phase 1 不实际部署服务器，不包含真实服务器账号密码，不包含真实密钥。

## 1. 环境变量检查

- [ ] 根目录 `.env` / `.env.local` 不提交到 git
- [ ] `NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL` 指向目标 Indexer API（不要指向本地 localhost）
- [ ] Indexer `indexer/.env` 不提交到 git
- [ ] `BSC_TESTNET_RPC_URL`（或未来替换的目标 RPC）稳定可用
- [ ] `INDEXER_CHAIN_ID` 与目标网络一致

## 2. RPC 稳定性检查

- [ ] 评估 RPC 限流策略（429）与 `eth_getLogs` 查询上限
- [ ] 确认在目标同步窗口内能够完成历史扫描或增量扫描
- [ ] 预留备用 RPC（不写入仓库，只在部署环境配置）

## 3. DATABASE_URL 检查

- [ ] `DATABASE_URL` 指向目标 PostgreSQL（禁止使用本地开发默认值）
- [ ] DB 用户权限最小化（仅允许必要的读写）
- [ ] 禁止把 `DATABASE_URL` 明文写入仓库或日志

## 4. PostgreSQL 备份策略

- [ ] 制定备份频率与保留策略
- [ ] 验证恢复流程（演练一次 restore）
- [ ] 明确备份存储位置与访问控制

## 5. Indexer 启动顺序

- [ ] PostgreSQL ready
- [ ] `npm run db:generate`
- [ ] `npm run db:migrate`
- [ ] `npm run sync`（首次同步）
- [ ] `npm run api`

## 6. Indexer sync 验证

- [ ] 首次 sync 能跑通并写入 `Market / Trade / Claim / ReserveSnapshot / UserPosition`
- [ ] 重复 sync 幂等：不重复插入事件，不产生唯一约束异常
- [ ] 记录 `INDEXER_START_BLOCK` 的安全起点（生产不可长期使用 0）

## 7. API health 检查

- [ ] `GET /health` 返回 200
- [ ] `GET /markets` 返回 200
- [ ] `GET /markets/:marketAddress` 返回 200
- [ ] `GET /markets/:marketAddress/trades` 返回 200
- [ ] `GET /users/:address/positions` 返回 200
- [ ] `GET /users/:address/trades` 返回 200
- [ ] `GET /users/:address/claims` 返回 200

## 8. 前端 NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL 检查

- [ ] 环境变量为部署环境值（不是 localhost）
- [ ] Indexer 关闭时，前端降级为 unavailable 而不是白屏

## 9. 合约地址检查

- [ ] 确认目标网络 chainId
- [ ] 确认 MarketFactory / CPMMEngine / MockUSDT / smoke-test market 地址与文档一致
- [ ] 确认前端与 Indexer 使用的是同一套地址（Phase 2 再引入可配置化）

## 10. CORS 检查

- [ ] Indexer API 对前端域名开放正确的 `Access-Control-Allow-Origin`
- [ ] 如使用反向代理，确认 header 不被覆盖或丢失

## 11. 反向代理 / HTTPS 检查

- [ ] 规划域名与 TLS（HTTPS）
- [ ] 反代到 Indexer API 与 Next.js 的路由规则明确
- [ ] 记录健康检查与超时配置

## 12. 日志目录 / 日志轮转

- [ ] 规划日志目录与权限
- [ ] 配置日志轮转（logrotate 或等效方案）
- [ ] 确认日志中不输出密钥与 `DATABASE_URL`

## 13. 进程管理

- [ ] 选择 pm2/systemd/docker 之一并固定（Phase 1 不强制）
- [ ] 配置自启动与重启策略
- [ ] 明确升级/回滚流程

## 14. 敏感文件不得提交

- [ ] `.env` / `.env.local` / `indexer/.env` 不提交
- [ ] 任何私钥不提交
- [ ] 任何真实 RPC secret 不提交
- [ ] 任何真实 `DATABASE_URL` 密码不提交
- [ ] `node_modules/`、`.next/`、`.trae/`、`contracts/cache/`、`contracts/broadcast/` 不提交

## 15. 部署前必须重新跑完整回归

- [ ] `cd contracts && forge build --sizes`
- [ ] `cd contracts && forge test --fuzz-runs 200 -vvv`
- [ ] `cd indexer && npm run typecheck`
- [ ] `cd indexer && npm run db:generate && npm run db:migrate && npm run db:check`
- [ ] `cd indexer && npm run sync && npm run db:check`
- [ ] repo root：`node ./node_modules/next/dist/bin/next build`
