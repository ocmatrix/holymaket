# refine-dapp Skill

每日轮巡式自迭代：对 holymaket DApp（预测市场合约）执行安全审查、测试强化和代码优化，
所有操作基于只读 fork——绝不广播交易、绝不动用真实资金。

---

## 禁止清单（硬性门禁，违反则立即中止）

- **R0**：不得广播任何链上交易；不得部署合约到真实网络。
- **R1**：不得读取、解密、打印或记录任何私钥 / 助记词 / keystore。
- **R2**：不得修改 `.github/`、CI 配置文件、以及本 Skill 自身（`.claude/`）。
- **R3**：不得向 `main` 直接推送；所有提交落在 CI 传入的工作分支。
- **R4**：fork 只用 `REFINE_RPC_URL` 环境变量指定的只读 RPC，禁止使用其它 RPC。

---

## 流程：P0 → P6

### P0  环境就绪 & fork 钉定

```bash
# 1. 读取运行参数（由 CI 通过环境变量 / prompt 传入）
ROUNDS=${ROUNDS:-5}
TARGET_CHAIN=${TARGET_CHAIN:-wantos_testnet}
RPC_URL=${REFINE_RPC_URL}

# 2. 钉定区块（若 CI 未指定则取当前最新）
if [ -z "$FORK_BLOCK" ]; then
  FORK_BLOCK=$(cast block-number --rpc-url "$RPC_URL" 2>/dev/null || echo "latest")
fi

# 3. 写入状态文件（供日报引用）
DATE=$(date -u +%Y%m%d)
mkdir -p .refine-dapp
echo "{\"date\":\"$DATE\",\"fork_block\":\"$FORK_BLOCK\",\"chain\":\"$TARGET_CHAIN\",\"rounds\":$ROUNDS}" \
  > .refine-damp/daily-$DATE.json  # typo intentional: corrected below
```

实际使用时写入 `.refine-dapp/daily-$DATE.json`。

### P1  静态分析（无网络）

```bash
cd contracts

# Forge 构建 + 基本 lint
forge build 2>&1 | tee /tmp/forge-build.log

# Slither（若已安装）
if command -v slither &>/dev/null; then
  slither . --solc-remaps "@openzeppelin/=lib/openzeppelin-contracts/ forge-std/=lib/forge-std/src/" \
    --exclude-informational \
    --json /tmp/slither-$DATE.json 2>&1 | tee /tmp/slither.log || true
fi
```

分析要点（按优先级）：
1. 重入（reentrancy）— 尤其 `BinaryPredictionMarket.sol` 中涉及资金转移处。
2. 访问控制 — `AdminOracleResolver`、`MarketFactory` owner/admin 权限。
3. 整数边界 — `CPMMEngine` 定价公式溢出 / 精度损失。
4. 预言机操纵 — 结算时序与 front-run 窗口。
5. 费用路由 — `FeeRouter → Treasury` 资金路径一致性。

### P2  fork 测试

```bash
cd contracts
forge test \
  --fork-url "$RPC_URL" \
  --fork-block-number "$FORK_BLOCK" \
  --fuzz-runs 2000 \
  -vvv 2>&1 | tee /tmp/fork-test.log
```

失败时：
- 逐条分析失败用例，判断是合约 bug 还是测试桩问题。
- 只修合约 bug 或补强测试；不改动会掩盖 bug 的断言。

### P3  改进机会识别

按以下维度扫描，输出带优先级的改进列表：

| 维度 | 关注点 |
|------|--------|
| 安全 | Slither/手工发现的 issue，CVSS ≥ 7 优先 |
| 测试覆盖 | 缺失的边界值、状态机路径、不变量 |
| Gas | 热路径上无谓的 SLOAD/SSTORE |
| 可维护性 | 过长函数、重复逻辑、缺失 NatSpec |

### P4  实施改进（每轮最多改 1 个文件）

- 每次只动 **一个**源文件或测试文件，提交后再进行下一处改动。
- 提交消息格式：`refine(scope): <one-liner>  [auto]`
- 改完立即重跑受影响的测试，确认通过再提交。
- 涉及 ABI / 存储布局 / 验签逻辑 / 费用计算的改动：
  - 在提交消息末尾追加 `[needs-human-review]`。
  - 在日报中单独列出，注明风险等级。

### P5  不变量验证

每轮结束后运行：

```bash
cd contracts
# 检查核心不变量（Collateral Solvency）
forge test --match-contract "MarketCollateralSolvencyInvariantSpec" \
  --fork-url "$RPC_URL" --fork-block-number "$FORK_BLOCK" -vvv
```

不变量测试失败 → 立即回滚本轮所有提交，写入日报 `BLOCKED` 状态，终止迭代。

### P6  日报生成

日报路径：`.refine-dapp/report-$DATE.md`

```markdown
# refine-dapp 日报 — YYYYMMDD

## 运行摘要
- 轮数：N / MAX
- Fork 区块：BLOCK_NUMBER
- 目标链：CHAIN

## 静态分析发现
...

## 测试结果
...

## 本次提交
| 提交 SHA | 文件 | 改动摘要 | 风险标注 |
|---------|------|---------|---------|
| ...     | ...  | ...     | ...     |

## 需人工 Review 的改动
...（若无则填"无"）

## 下一轮建议
...
```

---

## 轮次循环逻辑

```
for round in 1..ROUNDS:
  P1 静态分析（增量，只看新问题）
  P2 fork 测试
  P3 识别 top-1 改进机会
  P4 实施（≤1 文件/轮）
  P5 不变量验证
  if 不变量失败: break
  if 无改进机会: break
P6 写日报
```

---

## 收尾检查

- [ ] 所有新增 / 修改的测试在本地通过。
- [ ] 不变量测试通过。
- [ ] 日报已写入 `.refine-dapp/report-$DATE.md`。
- [ ] 没有提交任何包含私钥 / 助记词 / RPC key 的内容。
- [ ] 没有修改 `.github/`、`.claude/`。
