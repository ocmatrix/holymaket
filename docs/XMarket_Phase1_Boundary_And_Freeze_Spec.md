# XMarket Phase 1 边界规则与冻结说明文档

## 1. 冻结声明

当前冻结对象为：

```text
XMarket Phase 1 Math & Refund Lifecycle Green Build
```

当前冻结状态为：

```text
40 tests | 40 passed | 0 failed
```

## 2. 已冻结模块

已冻结模块清单如下：

- CPMMEngine quoteSellYes
- CPMMEngine quoteSellNo
- sell 输入域规则
- candidate selection
- k invariant
- rounding rule
- Cancelled refund
- Invalid refund
- refundWindow
- Treasury sweep
- dust 归属规则

## 3. sell 输入域规则

sell 输入域的冻结要求如下。

合法输入必须满足：

- shareIn > 0
- rYes > 0
- rNo > 0
- closed-form 有有效解
- newRYes > 0
- newRNo > 0
- reserve delta > 0
- fee 后 payout > 0
- k_after >= k_before
- 不出现 division by zero
- 不出现 arithmetic panic

非法输入必须显式 revert，不能 panic。

## 4. quoteSellYes / quoteSellNo 候选选择规则

冻结的候选选择流程如下：

- 先计算 closed-form 基准候选 x0
- 检查 x0 - 1
- 检查 x0
- 检查 x0 + 1
- 过滤非法候选
- 优先选择 rounding error 最小的候选
- 再比较 payout
- 无有效候选时显式 revert insufficient depth

其中“过滤非法候选”至少包含：

- new reserve 为 0 的候选；
- reserve delta 为 0 的候选；
- fee 后 payout 为 0 的候选；
- 会导致 k_after < k_before 的候选；
- 会触发除零或溢出的候选。

## 5. k invariant 规则

冻结定义：

```text
k_after = newRYes * newRNo
k_before = oldRYes * oldRNo
```

冻结规则：

```text
k_after >= k_before
```

实现策略说明：

- 通过 ceilDiv 计算对手盘新储备，抵消整数除法向下取整造成的 k 下穿；
- 通过候选过滤拒绝任何会导致 k_after < k_before 的候选。

## 6. rounding 规则

冻结说明：

- sell 路径允许整数离散误差；
- 当前测试确认 rounding error <= 5；
- 不允许通过 panic、负数、除零、k 下穿来掩盖 rounding；
- 不允许出现 y > 0 但 reserve delta = 0。

这里的 rounding error 指：

- closed-form 理论解给出的理想释放量与整数域内真实 reserve delta 的差值上界；
- 在保持 k_after >= k_before 且 fee 后 payout > 0 的约束下，该差值经测试基准确认不超过 5。

## 7. refund 规则

Cancelled / Invalid 后，退款规则为：

```text
refund = floor((yesShares + noShares) / 2)
```

用户只能在：

```text
block.timestamp <= resolvedAt + refundWindow
```

之前 refund。超过窗口后必须 revert。

## 8. Treasury sweep 规则

Treasury 只能在：

```text
block.timestamp > resolvedAt + refundWindow
```

之后 sweep。

sweep 内容：

- 未领取 collateral；
- /2 floor dust；
- 合约实际剩余 collateral。

禁止：

- refundWindow 内提前 sweep；
- sweep 超过合约实际余额；
- 影响已完成用户 refund。

## 9. 禁止变更边界

冻结阶段禁止事项如下：

- 不允许重新引入 panic revert；
- 不允许为了通过测试降低测试严格性；
- 不允许扩大业务功能；
- 不允许引入第三方转让；
- 不允许新增 orderbook；
- 不允许新增 LP 系统；
- 不允许接前端；
- 不允许部署测试网；
- 不允许写 Indexer；
- 不允许在未审计前进入主网。

## 10. 测试冻结基准

冻结测试基准为：

```text
forge test --fuzz-runs 200 -vvv
40 tests | 40 passed | 0 failed
```

后续任何改动都必须保持：

```text
40/40 passed
0 failed
0 skipped
0 known failing
0 panic revert
```

