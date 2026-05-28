pragma solidity ^0.8.28;

import {Test, stdError} from "forge-std/Test.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {CPMMEngine} from "../src/pricing/CPMMEngine.sol";

contract CPMMEngineSellDomainSpec is Test {
    CPMMEngine internal engine;
    bytes4 internal constant PANIC_SELECTOR = 0x4e487b71;

    event TestLabel(string label);

    function setUp() public {
        engine = new CPMMEngine();
    }

    //
    // ============================================================
    //  SECTION A — quoteSellYes / quoteSellNo 输入域规范
    // ============================================================
    //
    // 合法输入：
    //   - rYes > 0, rNo > 0（池子非空）
    //   - sharesIn > 0
    //   - sharesIn ≤ rYes（卖 YES 时）或 sharesIn ≤ rNo（卖 NO 时）
    //     （严格来说应为 sharesIn < rYes+rNo 以确保 a>0 避免 sqrt 边界，但 s≤rYes 是更强的业务约束）
    //   - sharesIn 必须足够小使得 sold-side 不会被吸干（newRSold > 0）
    //
    // 应当 revert 的输入：
    //   - rYes==0 || rNo==0
    //   - sharesIn==0
    //   - sharesIn 导致新储备为零（AMM depleted）
    //   - sharesIn 导致中间 sqrt 参数溢出
    //
    // 非规范行为(不得出现):
    //   - division by zero panic
    //   - arithmetic underflow/overflow panic
    //   - y>0 但 reserve delta=0
    //   - 返回的 newRYes/newRNo 与手工闭式解不一致

    //
    // ============================================================
    //  SECTION B — zero input revert tests（baseline, 当前应全过）
    // ============================================================

    function test_domain_zeroRevert_sellYes_sharesInZero() public {
        vm.expectRevert("zero input");
        engine.quoteSellYes(0, 1000, 1000, 50);
    }

    function test_domain_zeroRevert_sellNo_sharesInZero() public {
        vm.expectRevert("zero input");
        engine.quoteSellNo(0, 1000, 1000, 50);
    }

    function test_domain_zeroRevert_sellYes_emptyPool_yesZero() public {
        vm.expectRevert("empty pool");
        engine.quoteSellYes(100, 0, 1000, 50);
    }

    function test_domain_zeroRevert_sellYes_emptyPool_noZero() public {
        vm.expectRevert("empty pool");
        engine.quoteSellYes(100, 1000, 0, 50);
    }

    function test_domain_zeroRevert_sellNo_emptyPool_yesZero() public {
        vm.expectRevert("empty pool");
        engine.quoteSellNo(100, 0, 1000, 50);
    }

    function test_domain_zeroRevert_sellNo_emptyPool_noZero() public {
        vm.expectRevert("empty pool");
        engine.quoteSellNo(100, 1000, 0, 50);
    }

    //
    // ============================================================
    //  SECTION C — sell 极值靠近 depletion（baseline）
    //   sellYes s=999 out of rYes=1000: 新 R_yes 增加, R_no 减少但 >0
    //   应返回有效结果，不 panic
    // ============================================================

    function test_domain_sellYes_nearDepletion_noPanic() public {
        (uint256 cOut, , uint256 newRYes, uint256 newRNo,) =
            engine.quoteSellYes(999, 1000, 1000, 50);
        assertGt(newRYes, 1000);
        assertGt(newRNo, 0);
        assertGt(cOut, 0);
    }

    function test_domain_sellNo_nearDepletion_noPanic() public {
        (uint256 cOut, , uint256 newRYes, uint256 newRNo,) =
            engine.quoteSellNo(999, 1000, 1000, 50);
        assertGt(newRNo, 1000);
        assertGt(newRYes, 0);
        assertGt(cOut, 0);
    }

    function test_domain_sellYes_trueDepletion_reverts() public {
        vm.expectRevert("shares exceeds reserve");
        engine.quoteSellYes(9999, 1000, 1000, 50);
    }

    function test_domain_sellNo_trueDepletion_reverts() public {
        vm.expectRevert("shares exceeds reserve");
        engine.quoteSellNo(9999, 1000, 1000, 50);
    }

    //
    // ============================================================
    //  SECTION D — 极小 shareIn rounding（baseline, 当前应全过）
    // ============================================================

    function test_boundary_sellYes_minShare_nonzero() public {
        vm.expectRevert("insufficient depth");
        engine.quoteSellYes(1, 500000, 500000, 0);
    }

    function test_boundary_sellNo_minShare_nonzero() public {
        vm.expectRevert("insufficient depth");
        engine.quoteSellNo(1, 500000, 500000, 0);
    }

    //
    // ============================================================
    //  SECTION E — quoteSellYes / quoteSellNo 对称性（balanced pool）
    //   在 R_yes==R_no 时 sellYes 和 sellNo 的结果应完全对称
    //   [baseline, 当前应全过]
    // ============================================================

    function test_symmetry_sellYes_sellNo_equalReserves() public {
        (uint256 cOutY, uint256 fY, uint256 rYY, uint256 rYN,) =
            engine.quoteSellYes(1000, 500000, 500000, 50);
        (uint256 cOutN, uint256 fN, uint256 rNY, uint256 rNN,) =
            engine.quoteSellNo(1000, 500000, 500000, 50);

        assertEq(cOutY, cOutN);
        assertEq(fY, fN);
        assertEq(rYY, rNN);
        assertEq(rYN, rNY);
    }

    //
    // ============================================================
    //  SECTION F — k 不变量（baseline, 当前应全过）
    // ============================================================

    function test_k_invariant_sellYes_not_decreased() public {
        (,, uint256 newRYes, uint256 newRNo,) =
            engine.quoteSellYes(1000, 500000, 500000, 50);
        assertGe(newRYes * newRNo, 500000 * 500000);
    }

    function test_k_invariant_sellNo_not_decreased() public {
        (,, uint256 newRYes, uint256 newRNo,) =
            engine.quoteSellNo(1000, 500000, 500000, 50);
        assertGe(newRYes * newRNo, 500000 * 500000);
    }

    //
    // ============================================================
    //  SECTION G — 正常池子 fuzz: 闭式解一致性
    //   [baseline, 在合理输入域内当前应全过]
    // ============================================================

    function testFuzz_closedForm_sellYes(uint256 rYes, uint256 rNo, uint256 s, uint16 feeBps) public {
        vm.assume(rYes >= 1000 && rNo >= 1000);
        vm.assume(rYes <= 1e18 && rNo <= 1e18);
        vm.assume(rYes + rNo < type(uint256).max / 1e18);
        vm.assume(rYes * 10000 / rNo <= 50000 && rNo * 10000 / rYes <= 50000);
        vm.assume(s >= 1 && s <= rYes / 10);
        vm.assume(feeBps <= 500);
        _assertSellYesFuzzSpec(s, rYes, rNo, feeBps);
    }

    function testFuzz_closedForm_sellNo(uint256 rYes, uint256 rNo, uint256 s, uint16 feeBps) public {
        vm.assume(rYes >= 1000 && rNo >= 1000);
        vm.assume(rYes <= 1e18 && rNo <= 1e18);
        vm.assume(rYes + rNo < type(uint256).max / 1e18);
        vm.assume(rYes * 10000 / rNo <= 50000 && rNo * 10000 / rYes <= 50000);
        vm.assume(s >= 1 && s <= rNo / 10);
        vm.assume(feeBps <= 500);
        _assertSellNoFuzzSpec(s, rYes, rNo, feeBps);
    }

    //
    // ============================================================
    //  SECTION H — 极值 fuzz: 平衡池不 panic (baseline)
    //   [BASELINE-PASS] rYes/rNo 均在 1e15~1e24, s <= pool/10 时不 panic
    // ============================================================

    function testFuzz_extreme_balanced_no_panic_sellYes(
        uint256 rYes, uint256 rNo, uint256 s, uint16 feeBps
    ) public {
        rYes = bound(rYes, 1e15, 1e24);
        rNo = bound(rNo, 1e15, 1e24);
        s = bound(s, 1, rYes / 10);
        feeBps = uint16(bound(feeBps, 0, 500));

        _assertNoPanicOnQuoteSellYes(s, rYes, rNo, feeBps);
    }

    function testFuzz_extreme_balanced_no_panic_sellNo(
        uint256 rYes, uint256 rNo, uint256 s, uint16 feeBps
    ) public {
        rYes = bound(rYes, 1e15, 1e24);
        rNo = bound(rNo, 1e15, 1e24);
        s = bound(s, 1, rNo / 10);
        feeBps = uint16(bound(feeBps, 0, 500));

        _assertNoPanicOnQuoteSellNo(s, rYes, rNo, feeBps);
    }

    //
    // ============================================================
    //  SECTION H2 — 极端不对称池子保护
    //   修复后应显式 revert，而不是 panic
    // ============================================================

    function test_extreme_asymmetric_sellYes_explicitRevert() public {
        vm.expectRevert("insufficient depth");
        engine.quoteSellYes(2517, 1e18, 21600, 50);
    }

    function test_extreme_asymmetric_sellNo_explicitRevert() public {
        vm.expectRevert("insufficient depth");
        engine.quoteSellNo(1, 1e16, 9e23, 0);
    }

    //
    // ============================================================
    //  SECTION J — 极端不对称池子: Deep-Shallow
    //   已知当前实现会 panic(div-by-zero) 或 produce inconsistent results
    //   [current-bug: 预计部分输入会 fail]
    // ============================================================

    function test_bug_deepNo_shallowYes_sellYes() public {
        (uint256 cOut, uint256 fee, uint256 newRYes, uint256 newRNo,) =
            engine.quoteSellYes(253, 1336, 2957397981, 2);
        uint256 k = 1336 * 2957397981;
        assertGe(newRYes * newRNo, k, "k must not decrease");
        assertGt(newRNo, 0, "newRNo must not be zero");
        assertGt(cOut, 0, "collateralOut must be >0");
    }

    function test_bug_deepYes_shallowNo_sellNo() public {
        (uint256 cOut, uint256 fee, uint256 newRYes, uint256 newRNo,) =
            engine.quoteSellNo(253, 2957397981, 1336, 2);
        uint256 k = 2957397981 * 1336;
        assertGe(newRYes * newRNo, k, "k must not decrease");
        assertGt(newRYes, 0, "newRYes must not be zero");
        assertGt(cOut, 0, "collateralOut must be >0");
    }

    //
    // ============================================================
    //  SECTION K — rounding dust: /2 floor 的 dust 归属
    //   CPMMEngine 自身没有 treasury，但卖出的 "y" 如果因 rounding
    //   导致 deltaReserve < y，差值即为 dust
    //   [future-spec: 当前 Engine 不显式返回 dust，需在修复后验证]
    // ============================================================

    function test_rounding_oddNumber_sellYes_consistent() public {
        (uint256 cOut, uint256 fee,,,) =
            engine.quoteSellYes(3, 100, 100, 0);
        assertLe(fee, 3);
        assertGt(cOut, 0);
    }

    function test_rounding_oddNumber_sellNo_consistent() public {
        (uint256 cOut, uint256 fee,,,) =
            engine.quoteSellNo(3, 100, 100, 0);
        assertLe(fee, 3);
        assertGt(cOut, 0);
    }

    function _assertNoPanicOnQuoteSellYes(uint256 s, uint256 rYes, uint256 rNo, uint16 feeBps) internal {
        (bool ok, bytes memory data) =
            address(engine).call(abi.encodeCall(engine.quoteSellYes, (s, rYes, rNo, feeBps)));
        if (!ok) {
            _assertNotPanic(data);
        }
    }

    function _assertNoPanicOnQuoteSellNo(uint256 s, uint256 rYes, uint256 rNo, uint16 feeBps) internal {
        (bool ok, bytes memory data) =
            address(engine).call(abi.encodeCall(engine.quoteSellNo, (s, rYes, rNo, feeBps)));
        if (!ok) {
            _assertNotPanic(data);
        }
    }

    function _assertSellYesFuzzSpec(uint256 s, uint256 rYes, uint256 rNo, uint16 feeBps) internal view {
        (bool ok, bytes memory data) =
            address(engine).staticcall(abi.encodeCall(engine.quoteSellYes, (s, rYes, rNo, feeBps)));

        uint256 x0 = _closedFormXYes(s, rYes, rNo);
        if (!ok) {
            _assertNotPanic(data);
            assertFalse(_hasValidSellYesCandidate(x0, s, rYes, rNo, feeBps), "valid candidate must not revert");
            return;
        }

        _assertSellYesReturnedQuote(data, x0, s, rYes, rNo, feeBps);
    }

    function _assertSellNoFuzzSpec(uint256 s, uint256 rYes, uint256 rNo, uint16 feeBps) internal view {
        (bool ok, bytes memory data) =
            address(engine).staticcall(abi.encodeCall(engine.quoteSellNo, (s, rYes, rNo, feeBps)));

        uint256 x0 = _closedFormXNo(s, rYes, rNo);
        if (!ok) {
            _assertNotPanic(data);
            assertFalse(_hasValidSellNoCandidate(x0, s, rYes, rNo, feeBps), "valid candidate must not revert");
            return;
        }

        _assertSellNoReturnedQuote(data, x0, s, rYes, rNo, feeBps);
    }

    function _assertSellYesReturnedQuote(
        bytes memory data,
        uint256 x0,
        uint256 s,
        uint256 rYes,
        uint256 rNo,
        uint16 feeBps
    ) internal pure {
        (uint256 cOut, uint256 fee, uint256 newRYes, uint256 newRNo,) =
            abi.decode(data, (uint256, uint256, uint256, uint256, uint256));
        uint256 xChosen = newRYes - rYes;
        uint256 deltaNo = rNo - newRNo;
        uint256 idealY = s - xChosen;

        assertTrue(_isNeighborhoodCandidate(xChosen, x0), "chosen x outside neighborhood");
        assertEq(newRNo, Math.ceilDiv(rYes * rNo, newRYes), "newRNo must satisfy ceil-k");
        assertGe(newRYes * newRNo, rYes * rNo, "k must not decrease");
        assertGt(deltaNo, 0, "reserve delta must be positive");
        assertEq(cOut + fee, deltaNo, "collateralOut + fee must equal reserve delta");
        assertEq(fee, deltaNo * feeBps / 10000, "fee must match reserve delta");
        assertLe(_absDiff(deltaNo, idealY), 5, "rounding error too large");
    }

    function _assertSellNoReturnedQuote(
        bytes memory data,
        uint256 x0,
        uint256 s,
        uint256 rYes,
        uint256 rNo,
        uint16 feeBps
    ) internal pure {
        (uint256 cOut, uint256 fee, uint256 newRYes, uint256 newRNo,) =
            abi.decode(data, (uint256, uint256, uint256, uint256, uint256));
        uint256 xChosen = newRNo - rNo;
        uint256 deltaYes = rYes - newRYes;
        uint256 idealY = s - xChosen;

        assertTrue(_isNeighborhoodCandidate(xChosen, x0), "chosen x outside neighborhood");
        assertEq(newRYes, Math.ceilDiv(rYes * rNo, newRNo), "newRYes must satisfy ceil-k");
        assertGe(newRYes * newRNo, rYes * rNo, "k must not decrease");
        assertGt(deltaYes, 0, "reserve delta must be positive");
        assertEq(cOut + fee, deltaYes, "collateralOut + fee must equal reserve delta");
        assertEq(fee, deltaYes * feeBps / 10000, "fee must match reserve delta");
        assertLe(_absDiff(deltaYes, idealY), 5, "rounding error too large");
    }

    function _hasValidSellYesCandidate(uint256 x0, uint256 s, uint256 rYes, uint256 rNo, uint16 feeBps)
        internal
        pure
        returns (bool)
    {
        for (uint256 i = 0; i < 3; i++) {
            if (x0 == 0 && i == 0) continue;
            uint256 x = i == 0 ? x0 - 1 : i == 1 ? x0 : x0 + 1;
            if (x > s) continue;
            uint256 newRYes = rYes + x;
            uint256 newRNo = Math.ceilDiv(rYes * rNo, newRYes);
            if (newRNo == 0 || newRNo >= rNo) continue;
            uint256 deltaNo = rNo - newRNo;
            uint256 payout = deltaNo - (deltaNo * feeBps / 10000);
            if (deltaNo == 0 || payout == 0) continue;
            if (newRYes * newRNo < rYes * rNo) continue;
            return true;
        }
        return false;
    }

    function _hasValidSellNoCandidate(uint256 x0, uint256 s, uint256 rYes, uint256 rNo, uint16 feeBps)
        internal
        pure
        returns (bool)
    {
        for (uint256 i = 0; i < 3; i++) {
            if (x0 == 0 && i == 0) continue;
            uint256 x = i == 0 ? x0 - 1 : i == 1 ? x0 : x0 + 1;
            if (x > s) continue;
            uint256 newRNo = rNo + x;
            uint256 newRYes = Math.ceilDiv(rYes * rNo, newRNo);
            if (newRYes == 0 || newRYes >= rYes) continue;
            uint256 deltaYes = rYes - newRYes;
            uint256 payout = deltaYes - (deltaYes * feeBps / 10000);
            if (deltaYes == 0 || payout == 0) continue;
            if (newRYes * newRNo < rYes * rNo) continue;
            return true;
        }
        return false;
    }

    function _closedFormXYes(uint256 s, uint256 rYes, uint256 rNo) internal pure returns (uint256) {
        uint256 aMinusS = rYes + rNo - s;
        uint256 discriminant = aMinusS * aMinusS + 4 * s * rYes;
        return (Math.sqrt(discriminant) - aMinusS) / 2;
    }

    function _closedFormXNo(uint256 s, uint256 rYes, uint256 rNo) internal pure returns (uint256) {
        uint256 aMinusS = rYes + rNo - s;
        uint256 discriminant = aMinusS * aMinusS + 4 * s * rNo;
        return (Math.sqrt(discriminant) - aMinusS) / 2;
    }

    function _isNeighborhoodCandidate(uint256 chosenX, uint256 x0) internal pure returns (bool) {
        return chosenX == x0 || chosenX == x0 + 1 || (x0 > 0 && chosenX == x0 - 1);
    }

    function _absDiff(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a - b : b - a;
    }

    function _assertNotPanic(bytes memory revertData) internal pure {
        if (revertData.length < 4) {
            return;
        }

        bytes4 selector;
        assembly {
            selector := mload(add(revertData, 32))
        }
        assertTrue(selector != PANIC_SELECTOR, "panic revert");
    }
}
