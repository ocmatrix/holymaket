# PR-17 Stage 2 Chain Read Integration

## 1. 本阶段目标

- 在现有主站前端 `src/` 内完成最小链上只读接入。
- 复用现有 Privy + Wagmi + RainbowKit + Viem 钱包栈。
- 接入 PR-16 已部署的 BSC Testnet 合约地址与 PR-15 导出的 ABI。
- 在现有页面展示最小链上状态，不发送任何链上交易。

## 2. 复用现有前端说明

- 未新建前端工程。
- 未新建 `apps/web`。
- 未修改 `admin-web/`。
- 主站前端仍基于现有 Next.js App Router、TailwindCSS、React Query 与 Zustand。

## 3. Web3 栈

- Privy：保留现有登录与钱包绑定能力。
- Wagmi：用于链配置与只读合约读取。
- RainbowKit：保留现有钱包连接 UI 与配置入口。
- Viem：复用内置链定义与标准 `erc20Abi`。
- 新增依赖：无。

## 4. ABI 来源

- `packages/abi/MarketFactory.json`
- `packages/abi/BinaryPredictionMarket.json`
- `packages/abi/CPMMEngine.json`

说明：

- 以上 ABI 均直接从 `packages/abi/` 复用。
- 未复制 ABI 内容到前端内部。
- 未修改 ABI JSON。
- MockUSDT 读取使用 `viem` 提供的标准 `erc20Abi`。

## 5. BSC Testnet 地址

- Chain ID：`97`
- RPC：`https://data-seed-prebsc-1-s1.bnbchain.org:8545`
- MarketFactory：`0x45ab369f65c0ef44c1325323f283e6acc92b8bd0`
- CPMMEngine：`0x16fae185a854a54307f6dea9c0d53e326bb4f82f`
- Standalone BinaryPredictionMarket：`0x05caa8a264b2436f1851a58f4f183350fd330a2f`
- MockUSDT：`0xb90278a476319CbDAd259e4fEAA8E7d9Da05e1EB`
- Smoke Test Market：`0x87445F25F78e3eeE91090C80BdeB2F1ae1296A07`

## 6. 页面展示位置

- `src/components/market/c10-prediction-panel.tsx`
  - 展示 XMarket BSC Testnet 状态。
  - 展示 `factory.ammEngine()`、`factory.nextMarketId()`。
  - 展示 MockUSDT 的 `name/symbol/decimals` 与用户 `balanceOf`。
- `src/app/(dashboard)/profile/profile-content.tsx`
  - 保留原有钱包卡片。
  - 最小新增 `mUSDT on BSC Testnet` 只读余额展示。

## 7. 不做写交易说明

- 不实现 `buy / sell / claim`。
- 不实现 `approve`。
- 不发送任何链上交易。
- 不新增后端 API。
- 不修改后端 stub。
- 不接入 Indexer。

## 8. 安全边界

- 所有读取均为公开只读状态。
- 未引入私钥、RPC secret 或 `.env` 提交。
- 合约地址集中在 `src/lib/contracts.ts`。
- ABI 统一由 `src/lib/contract-abis.ts` 适配导出。
- 只读 Hook 收敛在 `src/hooks/use-xmarket-chain-state.ts`，避免地址与 ABI 散落到页面组件中。

## 9. Stage 3 写交易计划

- 继续复用当前钱包栈与地址配置。
- 在现有页面中接入最小写交易路径。
- 复用 `packages/abi/`，优先从 `MarketFactory` 与 `BinaryPredictionMarket` 开始。
- 先补最小读前校验，再接入 `buy / sell / claim`。
- 写交易前需额外确认授权、网络校验、失败态与安全提示。
