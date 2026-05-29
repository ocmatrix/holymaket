# BSC Testnet Deployment Record

## PR-16 Stage 2-B: Broadcast Deployment

### 1. Network
- Network: BSC Testnet
- Chain ID: `97`
- RPC: `https://data-seed-prebsc-1-s1.bnbchain.org:8545`

### 2. Deployer
- Deployer: `0x910956C25fD205a03D6314A3d787194c00022802`

### 3. Deployed contracts
- MarketFactory: `0x45ab369f65c0ef44c1325323f283e6acc92b8bd0`
- CPMMEngine: `0x16fae185a854a54307f6dea9c0d53e326bb4f82f`
- Standalone BinaryPredictionMarket: `0x05caa8a264b2436f1851a58f4f183350fd330a2f`
- MockUSDT: `0xb90278a476319CbDAd259e4fEAA8E7d9Da05e1EB`

### 4. Deployment tx hashes
- CPMMEngine: `0x210c61adff431bb21fddfd29a448368fd4b9364368d1aff89adfd7517d1b7f24`
- MarketFactory: `0xc94c128647e8f5d26c975674bef32f5995e9fc2c948416345ccb1237b64c1942`
- Standalone BinaryPredictionMarket: `0xa67b78ab5efb6944fc90ccc14057828f1d2087d9810422bb3ad3a5f9baa4a54f`

### 5. Notes
- 不 verify（未执行合约验证）
- 不部署主网
- 不使用真实 USDT，仅使用 BSC Testnet MockUSDT（mUSDT）
- 不提交 `.env`、不提交 `contracts/cache/`、不提交 `contracts/broadcast/`
