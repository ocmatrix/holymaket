# XMarket Indexer

XMarket 链下数据索引层，负责监听链上合约事件并将其转换为结构化查询数据。

## PR-19A 当前状态：Bootstrap

本 PR 当前只做 Indexer 工程骨架与 BSC Testnet 只读连通性验证：

- 最小 Node.js + TypeScript 工程
- viem 只读连接到 BSC Testnet
- 读取 MarketFactory 的 `ammEngine()` 和 `nextMarketId()`
- 校验 chainId === 97

**本 PR 不包含**：

- 数据库（PR-19B）
- 事件同步 / Event Sync Engine（PR-19C）
- 业务投影 / API 服务（PR-19D）
- 前端接入
- 合约修改

## 快速开始

```bash
# 在 indexer/ 目录下
cp .env.example .env

npm install
npm run typecheck
npm run dev
```

期望输出：

```text
XMarket Indexer Bootstrap
Chain: BSC Testnet
Connected chainId: 97
MarketFactory: 0x45AB369f65C0ef44c1325323F283e6acc92B8BD0
Factory ammEngine: 0x16faE185a854a54307F6dEa9c0d53E326bB4f82F
Factory nextMarketId: 1
Indexer bootstrap ready
```

## 目录结构

```text
indexer/
  package.json
  tsconfig.json
  .env.example
  src/
    index.ts              # 启动入口，运行最小启动检查
    config/
      chains.ts           # BSC Testnet 链定义
      contracts.ts        # PR-16 已部署合约地址
      env.ts              # dotenv 环境变量读取
    lib/
      public-client.ts    # viem publicClient 创建
      startup-check.ts    # 启动检查逻辑（chainId / ammEngine / nextMarketId）
```

## 后续 PR 计划

| PR | 内容 |
|----|------|
| PR-19B | Database Schema（Prisma + PostgreSQL） |
| PR-19C | Event Handlers（事件扫描、去重、写入） |
| PR-19D | Query API（REST API 查询层） |
| PR-19E | Local Smoke Test（全量回溯验证） |
| PR-19F | Frontend 接入 Indexer 数据层 |
