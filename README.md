# XMarket

Phase 1: Binary prediction market（BSC Testnet）+ Indexer（Prisma/PostgreSQL）+ Frontend（Next.js）最小集成交付。

## Phase 1 Final Freeze

- 冻结页：[phase1-final-freeze.md](file:///Users/mac/Documents/zhangyu/XMarket/docs/release/phase1-final-freeze.md)
- Release notes：[phase1-release-notes.md](file:///Users/mac/Documents/zhangyu/XMarket/docs/release/phase1-release-notes.md)
- Known limitations：[phase1-known-limitations.md](file:///Users/mac/Documents/zhangyu/XMarket/docs/release/phase1-known-limitations.md)
- Pre-deployment checklist：[phase1-pre-deployment-checklist.md](file:///Users/mac/Documents/zhangyu/XMarket/docs/release/phase1-pre-deployment-checklist.md)

## Phase 1 本地运行（验收路径）

Phase 1 的本地验收以 “Indexer Read API + Frontend 展示” 为核心，不要求本地部署合约或执行链上写交易。

### 1) Indexer

参考 [indexer/README.md](file:///Users/mac/Documents/zhangyu/XMarket/indexer/README.md)。

```bash
cd indexer
cp .env.example .env
npm install
npm run typecheck
npm run db:generate
npm run db:migrate
npm run sync
npm run api
```

默认 API：`http://localhost:4000`

### 2) Frontend

根目录配置运行时 env（仅示例，不提交）：

- `NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL=http://localhost:4000`

启动：

```bash
node ./node_modules/next/dist/bin/next build
node ./node_modules/next/dist/bin/next dev -p 3005
```

默认前端：`http://localhost:3005`

### 3) Contracts（仅本地测试）

```bash
cd contracts
forge build --sizes
forge test --fuzz-runs 200 -vvv
```

## 环境变量与安全边界

- 根目录 [.env.example](file:///Users/mac/Documents/zhangyu/XMarket/.env.example) 主要用于合约部署脚本配置模板，不代表“运行系统”必填项
- 任何 `.env` / `.env.local` / `indexer/.env` 不得提交到 git
- 禁止提交私钥、RPC secret、真实 `DATABASE_URL` 密码
