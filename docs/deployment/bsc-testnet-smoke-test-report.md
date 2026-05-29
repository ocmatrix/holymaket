# BSC Testnet Smoke Test Report

## PR-16 Stage 2-C: Market Lifecycle Smoke Test

### 1. Network
- Network: BSC Testnet
- Chain ID: `97`
- RPC: `https://data-seed-prebsc-1-s1.bnbchain.org:8545`

### 2. Deployer
- Deployer: `0x910956C25fD205a03D6314A3d787194c00022802`

### 3. Contracts
- MarketFactory: `0x45ab369f65c0ef44c1325323f283e6acc92b8bd0`
- CPMMEngine: `0x16fae185a854a54307f6dea9c0d53e326bb4f82f`
- MockUSDT: `0xb90278a476319CbDAd259e4fEAA8E7d9Da05e1EB`

### 4. MockUSDT preparation
- name: Mock USDT
- symbol: mUSDT
- decimals: 6
- mint tx: `0x7a163605282b91fa1c26b1433dabd8743ffafa815927b2400869d2efb82d13ae`
- minted amount: 1,000,000 mUSDT

### 5. Smoke test market
- market address: `0x87445F25F78e3eeE91090C80BdeB2F1ae1296A07`
- marketId: `0`
- createMarket tx: `0x60e4dedc07459b62cec1d3e39e93870929632872e333d75a7b98a44db3d59687`
- market.ammEngine(): `0x16faE185a854a54307F6dEa9c0d53E326bB4f82F`
- outcome: YES
- status: Resolved

### 6. Lifecycle tx hashes
- approve factory: `0xddf0fef3e843d68657bf8c845df476ed2ac23d2c16f345086bcbf308cb11fe83`
- approve market: `0xc181e7a3304fed8798e65d4bbb31c49e0a57bb41c17be0d373234dd0afdc4023`
- buyYes: `0x8bdc1be6729f8d028698fab535a1b4bac6d79135131725a62e9817854d91f2c1`
- buyNo: `0x3aab2a25430c2deaf51610140270f2d09d71cc98fae2504e7e928a122802e878`
- sellYes: `0x27e2b237bdf34821448bb3a3ddfead47a2e0c33edd171eb41f39d4de526547ef`
- sellNo: `0x8ac824ef5e855a97a79eb03d46babdcd8af7607e22f0541daa041a5a8d26082b`
- resolveByAdmin YES: `0xd1c3b83c2b83cc98eab0becd12756a03af54c38b89cad3a82b04e1b3463fd2b5`
- claim: `0xa71f5ab2bf1a908715b8c98a218c52f9d723cfab6892b0756afcd7e3c59e7f15`

### 7. Safety notes
- No private key printed
- `.env` not submitted
- `contracts/cache/` not submitted
- `contracts/broadcast/` not submitted unless explicitly reviewed and approved
- No mainnet deployment
- No real USDT used
- Only BSC Testnet mUSDT used
