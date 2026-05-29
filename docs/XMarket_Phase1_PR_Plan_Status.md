# XMarket Phase 1 PR规划 / PR状态

## 执行指针

- PR-10：已完成
- PR-CI-1：已完成
- PR-15：已完成（ABI / SDK Export Preparation）
- 下一推荐执行：PR-11 或 PR-12

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

## PR-15 最终验收记录

- PR 编号：PR-15
- PR 名称：ABI / SDK Export Preparation
- GitHub PR：https://github.com/ocmatrix/holymaket/pull/17
- merge 状态：MERGED
- main 最新 commit：3c804c935eff052ad8cf9ef54070c22fafd777a2
- 基线 commit：`95ee1ce9e263411b945366ce6215770da3476916`
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
- ABI 导出：
  - 来源仅限 `contracts/out/` Foundry 编译产物
  - 从 artifact JSON 提取 `abi` 字段后写入 `packages/abi/*.json`
  - 不手写 ABI：否
- SDK 准备边界：
  - 未实际生成 TypeScript 类型
  - 未新增 npm package / npm workspace
  - 未安装 TypeChain / `ethers.js` / `viem` / `abitype`
- 开源模块记录（仅文档预留）：
  - 记录文档：`docs/sdk/open-source-modules.md`
- 合约代码修改：否
- 业务逻辑修改：否
- ABI / event 修改：否
- 新增依赖：否
- CI：
  - GitHub Actions：通过
  - workflow run：https://github.com/ocmatrix/holymaket/actions/runs/26618070846
- main 上回归测试：
  - `cd contracts && ~/.foundry/bin/forge test --fuzz-runs 200 -vvv`
  - 200 passed / 0 failed / 0 skipped

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
- 状态：已完成并合并到 main

## PR-16 Stage 1 本地开发记录

- PR 编号：PR-16
- PR 名称：Local Deployment + Market Lifecycle Verification
- 基线 commit：d1f8a6a2faf035d1531d51f34aaa9bbde0800f92
- 当前工作分支：`chore/pr-16-local-deployment-verification`
- 本阶段目标：
  - 本地 Anvil 离线部署验证
  - Market Lifecycle Verification
- 新增文件：
  - `docs/deployment/local-anvil-deployment-record.md`
  - `docs/deployment/pr-16-local-deployment-verification.md`
- 修改文件：
  - `docs/XMarket_Phase1_PR_Plan_Status.md`
- 部署环境：
  - Local Anvil (`http://127.0.0.1:8545`)
- 生命周期验证：
  - Factory Create Market: 成功
  - AMM Wiring Verification: 失败 (复现 PR-11 记录的 known limitation)
  - 交易及结算: 在 Factory 创建的市场中 revert，但在 Standalone 市场中全部通过 (Buy/Sell/Resolve/Claim)
- 风险与限制：
  - `MarketFactory` 合约体积超出限制（需调整 `optimizer_runs=200` 才能部署）。
  - Factory 无法给新市场配置 `ammEngine`。
- 本地验证结果：
  - `forge build`: 通过
  - `forge test --fuzz-runs 200 -vvv`: 200 passed / 0 failed / 0 skipped
- 合约代码修改：否
- 业务逻辑修改：否
- ABI / event 修改：否
- 新增依赖：否
- 是否部署真实测试网：否
- 是否提交真实私钥/RPC：否
- 状态：Stage 1 完成，等待进入 Stage 2
EOF; __tr_native_ec=$?; pwd -P >| '/var/folders/rg/2r1rs2t56jsftdgsyh7ntlbw0000gn/T/agent-toolhost/jobs/job-ff0437ca72c94600a91928d2c4eb68ff/cwd.txt'; exit "$__tr_native_ec"