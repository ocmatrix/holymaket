# XMarket Phase 1 PR规划 / PR状态

## 执行指针

- PR-10：已完成
- PR-CI-1：已完成
- PR-15：Stage 1 本地开发已完成，待验收
- 下一推荐执行：PR-15 Stage 1 验收

## PR-10 最终验收记录

- PR 编号：PR-10
- PR 名称：Interface / ABI surface freeze
- PR 链接：https://github.com/ocmatrix/holymaket/pull/10
- merge 状态：MERGED
- main 最新 commit：4e5ba852c10e54e0adb6b05cbf5a806763b0e89f
- 新增文件：
  - contracts/src/interfaces/IBinaryPredictionMarket.sol
  - contracts/src/interfaces/IMarketFactory.sol
  - contracts/test/Phase1InterfaceSurfaceSpec.t.sol
  - docs/abi/phase1-abi-surface.md
- 修改合约：否
- 修改业务逻辑：否
- 新增依赖：否
- 全量测试结果：
  - forge test --fuzz-runs 200 -vvv
  - 200 passed / 0 failed / 0 skipped
- 工作区状态：clean

## PR-CI-1 最终验收记录

- PR 编号：PR-CI-1
- PR 名称：GitHub Actions + Foundry CI
- PR 链接：https://github.com/ocmatrix/holymaket/pull/11
- merge 状态：MERGED
- main 最新 commit：e22b42d7dd2bca88b139057b2e5dd75b155f6a8c
- 新增文件：
  - .github/workflows/foundry.yml
- 修改合约代码：否
- 修改业务逻辑：否
- 新增非 CI 依赖：否
- CI workflow 触发条件：
  - push 到 main
  - pull_request 目标为 main
- CI workflow 执行命令：
  - cd contracts
  - forge build
  - forge test --fuzz-runs 200 -vvv
- GitHub Actions：通过
- 工作流运行记录：https://github.com/ocmatrix/holymaket/actions/runs/26612267866
- main 上全量测试结果：
  - 200 tests passed / 0 failed / 0 skipped
- 工作区状态：clean

## PR-15 Stage 1 本地开发记录

- PR 编号：PR-15
- PR 名称：ABI / SDK Export Preparation
- 基线 commit：`95ee1ce9e263411b945366ce6215770da3476916`
- 当前工作分支：`chore/pr-15-abi-sdk-export-prep`
- 本 PR 目标：
  - 从 Foundry 编译产物导出核心合约 ABI
  - 建立 `packages/abi/` 输出目录
  - 建立 `docs/sdk/` 规划文档
  - 建立 `packages/sdk/README.md`
  - 记录 TypeChain / `ethers.js` / `viem` / `abitype` 的后续接入方案
- 新增文件：
  - `packages/abi/BinaryPredictionMarket.json`
  - `packages/abi/MarketFactory.json`
  - `packages/abi/CPMMEngine.json`
  - `packages/abi/README.md`
  - `packages/sdk/README.md`
  - `docs/sdk/abi-export.md`
  - `docs/sdk/open-source-modules.md`
- 修改文件：
  - `docs/XMarket_Phase1_PR_Plan_Status.md`
- ABI 导出规则：
  - 来源仅限 `contracts/out/` Foundry 编译产物
  - 从 artifact JSON 提取 `abi` 字段后写入 `packages/abi/*.json`
  - 不手写 ABI
- 导出合约：
  - `BinaryPredictionMarket`
  - `MarketFactory`
  - `CPMMEngine`
- SDK 准备边界：
  - 未实际生成 TypeScript 类型
  - 未新增 npm package
  - 未新增 npm workspace
  - 仅文档预留未来生成路径
- 开源模块记录：
  - TypeChain：文档记录，未实际引入，未写入 `package.json`，未写入 lockfile
  - `ethers.js`：文档记录，未实际引入，未写入 `package.json`，未写入 lockfile
  - `viem`：文档记录，未实际引入，未写入 `package.json`，未写入 lockfile
  - `abitype`：文档记录，未实际引入，未写入 `package.json`，未写入 lockfile
- 本地验证：
  - `cd contracts && ~/.foundry/bin/forge build`
  - `cd contracts && ~/.foundry/bin/forge test --fuzz-runs 200 -vvv`
  - 结果：200 passed / 0 failed / 0 skipped
- 合约代码修改：否
- 业务逻辑修改：否
- ABI / event 修改：否
- 新增依赖：否
- 状态：等待用户验收后再进入 Stage 2
