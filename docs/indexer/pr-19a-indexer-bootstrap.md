# PR-19A：Indexer Bootstrap 本地开发记录

## 1. 本 PR 目标

- 新增 `indexer/` 子项目
- 使用 Node.js + TypeScript 建立最小工程骨架
- 引入 viem 用于 BSC Testnet 只读连接
- 引入 dotenv 用于读取本地 RPC 配置
- 添加最小启动脚本，能读取 BSC Testnet chainId、ammEngine、nextMarketId
- 不做数据库、不做事件监听、不做 API、不改前端、不改合约

## 2. 新增文件

```text
indexer/
  package.json
  tsconfig.json
  README.md
  .env.example
  src/
    index.ts
    config/
      chains.ts
      contracts.ts
      env.ts
    lib/
      public-client.ts
      startup-check.ts
```

## 3. 运行命令

```bash
cd indexer
cp .env.example .env
npm install
npm run typecheck
npm run dev
```

## 4. 验证结果

```text
npm install: 通过（20 packages, 0 vulnerabilities）
npm run typecheck: 通过
npm run dev:
  XMarket Indexer Bootstrap
  Chain: BNB Smart Chain Testnet
  Connected chainId: 97
  MarketFactory: 0x45AB369F65c0eF44c1325323F283e6ACC92B8BD0
  Factory ammEngine: 0x16faE185a854a54307F6dEa9c0d53E326bB4f82F
  Factory nextMarketId: 1
  Indexer bootstrap ready

forge build --sizes: 通过（全部合约 margin > 0）
forge test --fuzz-runs 200 -vvv: 通过
  204 passed / 0 failed / 0 skipped（14 test suites）

Next build: 通过（15 pages, 0 errors）
```

## 5. 后续 PR 边界

- PR-19B：Database Schema（Prisma + PostgreSQL）
- PR-19C：Event Handlers（事件扫描、去重、写入）
- PR-19D：Query API（REST API）
- PR-19E：Local Smoke Test
- PR-19F：Frontend 接入
