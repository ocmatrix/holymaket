pragma solidity ^0.8.28;

import {Test, stdError} from "forge-std/Test.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {CPMMEngine} from "../src/pricing/CPMMEngine.sol";
import {MockUSDT} from "../src/tokens/MockUSDT.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPredictionMarket} from "../src/market/BinaryPredictionMarket.sol";

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

    function testFuzz_monotonicity_quoteSellYes_collateralOut(uint256 s1, uint256 s2) public {
        s1 = bound(s1, 1000, 50000);
        s2 = bound(s2, 1000, 50000);
        if (s1 > s2) (s1, s2) = (s2, s1);

        (uint256 out1,, , ,) = engine.quoteSellYes(s1, 500000, 500000, 50);
        (uint256 out2,, , ,) = engine.quoteSellYes(s2, 500000, 500000, 50);
        assertLe(out1, out2);
    }

    function testFuzz_monotonicity_quoteSellNo_collateralOut(uint256 s1, uint256 s2) public {
        s1 = bound(s1, 1000, 50000);
        s2 = bound(s2, 1000, 50000);
        if (s1 > s2) (s1, s2) = (s2, s1);

        (uint256 out1,, , ,) = engine.quoteSellNo(s1, 500000, 500000, 50);
        (uint256 out2,, , ,) = engine.quoteSellNo(s2, 500000, 500000, 50);
        assertLe(out1, out2);
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

    function testFuzz_closedForm_sellYes(uint256 rYesSeed, uint256 rNoSeed, uint256 sSeed, uint16 feeBpsSeed) public {
        uint256 rNo = bound(rNoSeed, 1000, 1e18);
        uint256 rYesMin = Math.max(1000, Math.ceilDiv(rNo, 5));
        uint256 rYesMax = Math.min(1e18, rNo * 5);
        uint256 rYes = bound(rYesSeed, rYesMin, rYesMax);

        uint256 sMax = rYes / 10;
        if (sMax == 0) sMax = 1;
        uint256 s = bound(sSeed, 1, sMax);

        uint16 feeBps = uint16(bound(uint256(feeBpsSeed), 0, 500));
        _assertSellYesFuzzSpec(s, rYes, rNo, feeBps);
    }

    function testFuzz_closedForm_sellNo(uint256 rYesSeed, uint256 rNoSeed, uint256 sSeed, uint16 feeBpsSeed) public {
        uint256 rYes = bound(rYesSeed, 1000, 1e18);
        uint256 rNoMin = Math.max(1000, Math.ceilDiv(rYes, 5));
        uint256 rNoMax = Math.min(1e18, rYes * 5);
        uint256 rNo = bound(rNoSeed, rNoMin, rNoMax);

        uint256 sMax = rNo / 10;
        if (sMax == 0) sMax = 1;
        uint256 s = bound(sSeed, 1, sMax);

        uint16 feeBps = uint16(bound(uint256(feeBpsSeed), 0, 500));
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

contract CPMMSellExecutionDomainSpec is Test {
    MockUSDT internal usdt;
    CPMMEngine internal engine;
    MarketFactory internal factory;
    BinaryPredictionMarket internal market;

    address internal creator = address(this);
    address internal user = address(0xBEEF);
    address internal resolver = address(0xA11CE);
    address internal treasury = address(0x7E57);
    address internal feeRouter = address(0xFEE);

    function setUp() public {
        usdt = new MockUSDT();
        engine = new CPMMEngine();

        factory = new MarketFactory(
            500,
            1000,
            1000,
            1_000_000,
            3000,
            7000,
            resolver,
            feeRouter,
            treasury
        );
        factory.setCollateralAllowed(address(usdt), true);
        factory.setAmmEngine(address(engine));

        usdt.mint(creator, 100_000_000_000);
        usdt.mint(user, 100_000_000_000);
    }

    function _createMarket(uint16 feeBps) internal returns (BinaryPredictionMarket m) {
        MarketFactory.CreateMarketParams memory p = MarketFactory.CreateMarketParams({
            question: "BTC>100k?",
            metadataURI: "ipfs://rule",
            collateral: address(usdt),
            startTime: uint64(block.timestamp),
            endTime: uint64(block.timestamp + 7 days),
            initialCollateral: 1_000_000,
            initialPriceYesBps: 5000,
            minTradeAmount: 1,
            maxTradeAmount: 100_000,
            maxSlippageBps: 500,
            feeBps: feeBps
        });

        usdt.approve(address(factory), p.initialCollateral);
        (, address marketAddress) = factory.createMarket(p);
        m = BinaryPredictionMarket(marketAddress);
    }

    function _fundMarketExtra(BinaryPredictionMarket m, uint256 amount) internal {
        usdt.mint(creator, amount);
        usdt.transfer(address(m), amount);
    }

    function test_quoteSell_reverts_on_zero_input_current_behavior() public {
        market = _createMarket(50);

        vm.expectRevert("zero input");
        market.quoteSellYes(0);

        vm.expectRevert("zero input");
        market.quoteSellNo(0);
    }

    function test_sell_reverts_on_zero_sharesIn_current_behavior() public {
        market = _createMarket(50);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        vm.expectRevert("trade size");
        market.sellYes(0, 0);
        vm.expectRevert("trade size");
        market.sellNo(0, 0);
        vm.stopPrank();
    }

    function test_sellYes_exec_matches_quote_and_fee_accounting() public {
        market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        uint256 collateralIn = 80_000;
        (uint256 buySharesOut,,) = market.quoteBuyYes(collateralIn);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, buySharesOut);
        vm.stopPrank();

        uint256 sharesIn = buySharesOut / 3;
        (uint256 quoteCollateralOut, uint256 quoteFee,) = market.quoteSellYes(sharesIn);

        uint256 userBefore = usdt.balanceOf(user);
        uint256 marketBefore = usdt.balanceOf(address(market));
        uint256 treasuryBefore = usdt.balanceOf(treasury);
        uint256 feesBefore = market.totalFeesCollected();

        vm.prank(user);
        market.sellYes(sharesIn, quoteCollateralOut);

        uint256 userReceived = usdt.balanceOf(user) - userBefore;
        uint256 marketDecrease = marketBefore - usdt.balanceOf(address(market));
        uint256 treasuryIncrease = usdt.balanceOf(treasury) - treasuryBefore;

        assertEq(userReceived, quoteCollateralOut);
        assertEq(treasuryIncrease, quoteFee);
        assertEq(marketDecrease, quoteCollateralOut + quoteFee);
        assertEq(market.totalFeesCollected() - feesBefore, quoteFee);
    }

    function test_sellNo_exec_matches_quote_and_fee_accounting() public {
        market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        uint256 collateralIn = 80_000;
        (uint256 buySharesOut,,) = market.quoteBuyNo(collateralIn);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyNo(collateralIn, buySharesOut);
        vm.stopPrank();

        uint256 sharesIn = buySharesOut / 3;
        (uint256 quoteCollateralOut, uint256 quoteFee,) = market.quoteSellNo(sharesIn);

        uint256 userBefore = usdt.balanceOf(user);
        uint256 marketBefore = usdt.balanceOf(address(market));
        uint256 treasuryBefore = usdt.balanceOf(treasury);
        uint256 feesBefore = market.totalFeesCollected();

        vm.prank(user);
        market.sellNo(sharesIn, quoteCollateralOut);

        uint256 userReceived = usdt.balanceOf(user) - userBefore;
        uint256 marketDecrease = marketBefore - usdt.balanceOf(address(market));
        uint256 treasuryIncrease = usdt.balanceOf(treasury) - treasuryBefore;

        assertEq(userReceived, quoteCollateralOut);
        assertEq(treasuryIncrease, quoteFee);
        assertEq(marketDecrease, quoteCollateralOut + quoteFee);
        assertEq(market.totalFeesCollected() - feesBefore, quoteFee);
    }

    function test_sell_reverts_when_sharesIn_exceeds_user_balance_current_behavior() public {
        market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        uint256 collateralIn = 10_000;
        (uint256 buySharesOut,,) = market.quoteBuyYes(collateralIn);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, buySharesOut);
        vm.expectRevert("insufficient shares");
        market.sellYes(buySharesOut + 1, 0);
        vm.stopPrank();
    }

    function test_sell_reverts_when_sharesIn_exceeds_engine_reserve_current_behavior() public {
        market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        uint256 collateralIn = 100_000;
        (uint256 buySharesOut,,) = market.quoteBuyYes(collateralIn);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, buySharesOut);
        vm.stopPrank();

        uint256 rYes = market.R_yes();
        uint256 userYes = market.yesShares(user);

        if (rYes + 1 > userYes) return;
        if (rYes + 1 > market.maxTradeAmount()) return;

        vm.prank(user);
        vm.expectRevert("shares exceeds reserve");
        market.sellYes(rYes + 1, 0);
    }

    function test_sequential_sellYes_updates_balances_and_fee_accumulates() public {
        market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        uint256 collateralIn = 90_000;
        (uint256 buySharesOut,,) = market.quoteBuyYes(collateralIn);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, buySharesOut);
        vm.stopPrank();

        uint256 feesBefore = market.totalFeesCollected();

        for (uint256 i = 0; i < 3; i++) {
            uint256 remaining = market.yesShares(user);
            if (remaining <= 1) break;
            uint256 sharesIn = remaining / 4;
            if (sharesIn == 0) sharesIn = 1;
            (uint256 quoteCollateralOut, uint256 quoteFee,) = market.quoteSellYes(sharesIn);

            uint256 userBefore = usdt.balanceOf(user);
            uint256 marketBefore = usdt.balanceOf(address(market));
            uint256 treasuryBefore = usdt.balanceOf(treasury);
            uint256 feesStepBefore = market.totalFeesCollected();

            vm.prank(user);
            market.sellYes(sharesIn, quoteCollateralOut);

            uint256 userReceived = usdt.balanceOf(user) - userBefore;
            uint256 marketDecrease = marketBefore - usdt.balanceOf(address(market));
            uint256 treasuryIncrease = usdt.balanceOf(treasury) - treasuryBefore;

            assertEq(userReceived, quoteCollateralOut);
            assertEq(treasuryIncrease, quoteFee);
            assertEq(marketDecrease, quoteCollateralOut + quoteFee);
            assertEq(market.totalFeesCollected() - feesStepBefore, quoteFee);
        }

        assertGe(market.totalFeesCollected(), feesBefore);
    }

    function test_sequential_sellNo_updates_balances_and_fee_accumulates() public {
        market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        uint256 collateralIn = 90_000;
        (uint256 buySharesOut,,) = market.quoteBuyNo(collateralIn);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyNo(collateralIn, buySharesOut);
        vm.stopPrank();

        uint256 feesBefore = market.totalFeesCollected();

        for (uint256 i = 0; i < 3; i++) {
            uint256 remaining = market.noShares(user);
            if (remaining <= 1) break;
            uint256 sharesIn = remaining / 4;
            if (sharesIn == 0) sharesIn = 1;
            (uint256 quoteCollateralOut, uint256 quoteFee,) = market.quoteSellNo(sharesIn);

            uint256 userBefore = usdt.balanceOf(user);
            uint256 marketBefore = usdt.balanceOf(address(market));
            uint256 treasuryBefore = usdt.balanceOf(treasury);
            uint256 feesStepBefore = market.totalFeesCollected();

            vm.prank(user);
            market.sellNo(sharesIn, quoteCollateralOut);

            uint256 userReceived = usdt.balanceOf(user) - userBefore;
            uint256 marketDecrease = marketBefore - usdt.balanceOf(address(market));
            uint256 treasuryIncrease = usdt.balanceOf(treasury) - treasuryBefore;

            assertEq(userReceived, quoteCollateralOut);
            assertEq(treasuryIncrease, quoteFee);
            assertEq(marketDecrease, quoteCollateralOut + quoteFee);
            assertEq(market.totalFeesCollected() - feesStepBefore, quoteFee);
        }

        assertGe(market.totalFeesCollected(), feesBefore);
    }

    function test_sell_feeBps_zero_has_zero_fee_and_no_totalFeesCollected_growth() public {
        market = _createMarket(0);
        _fundMarketExtra(market, 1_000_000);

        uint256 collateralIn = 80_000;
        (uint256 buySharesOut,,) = market.quoteBuyYes(collateralIn);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, buySharesOut);
        vm.stopPrank();

        uint256 sharesIn = buySharesOut / 3;
        (uint256 quoteCollateralOut, uint256 quoteFee,) = market.quoteSellYes(sharesIn);
        assertEq(quoteFee, 0);

        uint256 treasuryBefore = usdt.balanceOf(treasury);
        uint256 feesBefore = market.totalFeesCollected();
        uint256 marketBefore = usdt.balanceOf(address(market));
        uint256 userBefore = usdt.balanceOf(user);

        vm.prank(user);
        market.sellYes(sharesIn, quoteCollateralOut);

        uint256 userReceived = usdt.balanceOf(user) - userBefore;
        uint256 marketDecrease = marketBefore - usdt.balanceOf(address(market));
        uint256 treasuryIncrease = usdt.balanceOf(treasury) - treasuryBefore;

        assertEq(userReceived, quoteCollateralOut);
        assertEq(treasuryIncrease, 0);
        assertEq(marketDecrease, quoteCollateralOut);
        assertEq(market.totalFeesCollected(), feesBefore);
    }

    function test_sell_feeBps_max_routes_fee_and_updates_totalFeesCollected() public {
        uint16 maxFeeBps = factory.systemMaxFeeBps();
        market = _createMarket(maxFeeBps);
        _fundMarketExtra(market, 1_000_000);

        uint256 collateralIn = 80_000;
        (uint256 buySharesOut,,) = market.quoteBuyYes(collateralIn);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, buySharesOut);
        vm.stopPrank();

        uint256 sharesIn = buySharesOut / 3;
        (uint256 quoteCollateralOut, uint256 quoteFee,) = market.quoteSellYes(sharesIn);

        uint256 treasuryBefore = usdt.balanceOf(treasury);
        uint256 feesBefore = market.totalFeesCollected();

        vm.prank(user);
        market.sellYes(sharesIn, quoteCollateralOut);

        assertEq(usdt.balanceOf(treasury) - treasuryBefore, quoteFee);
        assertEq(market.totalFeesCollected() - feesBefore, quoteFee);
    }

    function testFuzz_sellYes_quote_matches_execution_and_accounting(uint256 buyIn, uint256 sharesIn) public {
        market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        buyIn = bound(buyIn, 1, 100_000);
        (uint256 buySharesOut,,) = market.quoteBuyYes(buyIn);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(buyIn, buySharesOut);
        vm.stopPrank();

        uint256 userYes = market.yesShares(user);
        uint256 rYes = market.R_yes();
        uint256 maxSharesIn = userYes < rYes ? userYes : rYes;
        if (maxSharesIn == 0) return;

        sharesIn = bound(sharesIn, 1, maxSharesIn);
        if (sharesIn > market.maxTradeAmount()) {
            sharesIn = market.maxTradeAmount();
        }
        if (sharesIn == 0) return;

        (uint256 quoteCollateralOut, uint256 quoteFee,) = market.quoteSellYes(sharesIn);

        uint256 userBefore = usdt.balanceOf(user);
        uint256 marketBefore = usdt.balanceOf(address(market));
        uint256 treasuryBefore = usdt.balanceOf(treasury);
        uint256 feesBefore = market.totalFeesCollected();

        vm.prank(user);
        market.sellYes(sharesIn, quoteCollateralOut);

        uint256 userReceived = usdt.balanceOf(user) - userBefore;
        uint256 marketDecrease = marketBefore - usdt.balanceOf(address(market));
        uint256 treasuryIncrease = usdt.balanceOf(treasury) - treasuryBefore;

        assertEq(userReceived, quoteCollateralOut);
        assertEq(treasuryIncrease, quoteFee);
        assertEq(marketDecrease, quoteCollateralOut + quoteFee);
        assertEq(market.totalFeesCollected() - feesBefore, quoteFee);
    }

    function testFuzz_sellNo_quote_matches_execution_and_accounting(uint256 buyIn, uint256 sharesIn) public {
        market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        buyIn = bound(buyIn, 1, 100_000);
        (uint256 buySharesOut,,) = market.quoteBuyNo(buyIn);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyNo(buyIn, buySharesOut);
        vm.stopPrank();

        uint256 userNo = market.noShares(user);
        uint256 rNo = market.R_no();
        uint256 maxSharesIn = userNo < rNo ? userNo : rNo;
        if (maxSharesIn == 0) return;

        sharesIn = bound(sharesIn, 1, maxSharesIn);
        if (sharesIn > market.maxTradeAmount()) {
            sharesIn = market.maxTradeAmount();
        }
        if (sharesIn == 0) return;

        (uint256 quoteCollateralOut, uint256 quoteFee,) = market.quoteSellNo(sharesIn);

        uint256 userBefore = usdt.balanceOf(user);
        uint256 marketBefore = usdt.balanceOf(address(market));
        uint256 treasuryBefore = usdt.balanceOf(treasury);
        uint256 feesBefore = market.totalFeesCollected();

        vm.prank(user);
        market.sellNo(sharesIn, quoteCollateralOut);

        uint256 userReceived = usdt.balanceOf(user) - userBefore;
        uint256 marketDecrease = marketBefore - usdt.balanceOf(address(market));
        uint256 treasuryIncrease = usdt.balanceOf(treasury) - treasuryBefore;

        assertEq(userReceived, quoteCollateralOut);
        assertEq(treasuryIncrease, quoteFee);
        assertEq(marketDecrease, quoteCollateralOut + quoteFee);
        assertEq(market.totalFeesCollected() - feesBefore, quoteFee);
    }
}
