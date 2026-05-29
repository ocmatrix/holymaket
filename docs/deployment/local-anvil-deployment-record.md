# Local Anvil Deployment Record

## PR-16 Stage 1-Rerun: Local Deployment + Market Lifecycle Verification

### 1. 当前基线
- PR-16-FIX-1 已完成并合并
- main 最新 commit：31dd0c8682b672accedeeb4d4ae032e5a3b76f76 (fix: wire factory markets to AMM engine)
- 当前全量测试：204 passed / 0 failed / 0 skipped

### 2. Anvil 环境
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- 默认账户 (Deployer): `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- 私钥来源: Anvil 默认生成的测试私钥 (Account 0)

### 3. 部署命令
```bash
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 BROADCAST=true forge script script/Deploy.s.sol:DeployScript --rpc-url http://127.0.0.1:8545 --broadcast -vvv
```

### 4. 部署结果
- 是否 broadcast: 是
- 是否成功: 是
- 部署账户: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

### 5. 合约地址
- **MarketFactory**: `0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9`
- **CPMMEngine**: `0x5fbdb2315678afecb367f032d93f642f64180aa3`
- **BinaryPredictionMarket** (Standalone): `0x0165878a594ca255338adfa4d48449f69242eb8f`
- **MockUSDT**: `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512`
EOF; __tr_native_ec=$?; pwd -P >| '/var/folders/rg/2r1rs2t56jsftdgsyh7ntlbw0000gn/T/agent-toolhost/jobs/job-77060c7b3c674e879442d66322a86c64/cwd.txt'; exit "$__tr_native_ec"