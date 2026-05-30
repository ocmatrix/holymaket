# PR-19C Event Sync Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为独立 `indexer/` 子项目实现最小可运行、可重复执行、可断点续跑的 `MarketFactory.MarketCreated` 事件同步引擎。

**Architecture:** 使用单入口串行同步。同步流程按 `IndexerState` 读取游标，按配置切分 block range，逐 batch 扫描 `MarketCreated`，在数据库事务里完成 `IndexerEventLog` 幂等写入、`Market` 最小 upsert，并仅在成功后推进 `IndexerState`。

**Tech Stack:** Node.js、TypeScript、tsx、viem、dotenv、Prisma、PostgreSQL

---

## File Map

- Create: `indexer/src/abi/market-factory.ts`
- Create: `indexer/src/sync/config.ts`
- Create: `indexer/src/sync/block-range.ts`
- Create: `indexer/src/sync/indexer-state.ts`
- Create: `indexer/src/sync/event-log.ts`
- Create: `indexer/src/sync/market-discovery.ts`
- Create: `indexer/src/sync/factory-sync.ts`
- Create: `indexer/src/sync/index.ts`
- Modify: `indexer/.env.example`
- Modify: `indexer/package.json`
- Modify: `indexer/README.md`
- Modify: `docs/indexer/pr-19c-event-sync-engine.md`
- Modify: `docs/XMarket_Phase1_PR_Plan_Status.md`

## Task 1: 同步配置与 ABI

- [ ] 新增 `indexer/src/abi/market-factory.ts`，定义 PR-19C 专用最小事件 ABI，只包含 `MarketCreated`
- [ ] 新增 `indexer/src/sync/config.ts`，读取并校验 `INDEXER_START_BLOCK`、`INDEXER_CONFIRMATIONS`、`INDEXER_BATCH_SIZE`、`INDEXER_MAX_BLOCKS_PER_RUN`
- [ ] 更新 `indexer/.env.example`，增加 4 个同步环境变量示例
- [ ] 更新 `indexer/package.json`，新增 `sync` script

## Task 2: Block Range 与游标

- [ ] 新增 `indexer/src/sync/block-range.ts`，实现 safe block 计算、target range 计算和 batch 切分
- [ ] 新增 `indexer/src/sync/indexer-state.ts`，实现 factory scope 的 state 读取、初始化参数计算和成功后的游标推进
- [ ] 确保当 `fromBlock > safeToBlock` 时输出 `No new safe blocks to index.`

## Task 3: 幂等写入与 Market 最小发现

- [ ] 新增 `indexer/src/sync/event-log.ts`，封装 `IndexerEventLog` 幂等写入
- [ ] 新增 `indexer/src/sync/market-discovery.ts`，封装 `Market` 最小 upsert
- [ ] 明确所有地址字段都在写库前转为 lowercase
- [ ] 严格只写最小 `Market` 字段，不改 schema、不加 migration

## Task 4: Factory Sync 主流程

- [ ] 新增 `indexer/src/sync/factory-sync.ts`，实现 `getLogs` 扫描、batch 串行处理、DB 事务写入、成功后推进 state
- [ ] 新增 `indexer/src/sync/index.ts`，实现命令行入口与清晰日志输出
- [ ] 保证 batch 失败时不推进游标、直接报错退出
- [ ] 保证重复运行不重复插入、无唯一约束异常

## Task 5: 文档与状态更新

- [ ] 新增 `docs/indexer/pr-19c-event-sync-engine.md`，记录同步流程、幂等规则、游标规则、验证命令和边界
- [ ] 更新 `indexer/README.md`，加入 `npm run sync`、同步配置、幂等和游标说明
- [ ] 更新 `docs/XMarket_Phase1_PR_Plan_Status.md`，记录 PR-19C Stage 1 状态与边界

## Task 6: Stage 1 验证

- [ ] 运行 `cd indexer && npm install`
- [ ] 运行 `cd indexer && npm run typecheck`
- [ ] 运行 `cd indexer && npm run dev`
- [ ] 运行 `cd indexer && npm run db:generate`
- [ ] 运行 `cd indexer && npm run db:migrate`
- [ ] 运行 `cd indexer && npm run db:check`
- [ ] 运行 `cd indexer && npm run sync`
- [ ] 再次运行 `cd indexer && npm run sync`
- [ ] 再次运行 `cd indexer && npm run db:check`
- [ ] 运行 `cd contracts && forge build --sizes`
- [ ] 运行 `cd contracts && forge test --fuzz-runs 200 -vvv`
- [ ] 运行 `node ./node_modules/next/dist/bin/next build`

## Task 7: Stage 1 交付

- [ ] 执行 `git status --short`，确认没有敏感文件进入提交范围
- [ ] 输出 PR-19C Stage 1 本地开发报告
- [ ] 停止在 Stage 1，等待用户确认是否进入 Stage 2
