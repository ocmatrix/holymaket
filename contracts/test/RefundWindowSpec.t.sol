pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {MockUSDT} from "../src/tokens/MockUSDT.sol";
import {CPMMEngine} from "../src/pricing/CPMMEngine.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPredictionMarket} from "../src/market/BinaryPredictionMarket.sol";

contract RefundWindowSpec is Test {
    MockUSDT internal usdt;
    CPMMEngine internal engine;
    MarketFactory internal factory;
    BinaryPredictionMarket internal market;

    address internal user = address(0xBEEF);
    address internal resolver = address(0xA11CE);
    address internal treasuryAddr = address(0x7E57);
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
            treasuryAddr
        );
        factory.setCollateralAllowed(address(usdt), true);
        usdt.mint(user, 100_000_000_000);
    }

    function _create() internal returns (BinaryPredictionMarket) {
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
            feeBps: 50
        });

        (, address marketAddress) = factory.createMarket(p);
        BinaryPredictionMarket m = BinaryPredictionMarket(marketAddress);
        vm.prank(address(factory));
        m.setAmmEngine(address(engine));
        return m;
    }

    function _backAndBuy(BinaryPredictionMarket m, uint256 collateralIn) internal {
        usdt.mint(address(this), 1_000_000);
        usdt.transfer(address(m), 1_000_000);

        (uint256 sharesOut,,) = m.quoteBuyYes(collateralIn);
        vm.startPrank(user);
        usdt.approve(address(m), type(uint256).max);
        m.buyYes(collateralIn, sharesOut);
        vm.stopPrank();
    }

    //
    // ============================================================
    //  [BASELINE-PASS] user 在 refundWindow 内可以 refund
    //   当前实现未 enforce 窗口 → 因缺省而过，但符合此规范
    // ============================================================

    function test_baseline_user_can_refund_before_deadline() public {
        market = _create();
        _backAndBuy(market, 50_000);

        vm.prank(resolver);
        market.cancel("r", "ipfs://e");

        uint64 resolvedAt = market.resolvedAt();
        uint64 window = market.refundWindow();
        vm.warp(uint256(resolvedAt) + uint256(window) - 1);

        uint256 balBefore = usdt.balanceOf(user);
        vm.prank(user);
        market.refund();
        assertGt(usdt.balanceOf(user), balBefore);
    }

    //
    // ============================================================
    //  [CURRENT-BUG-FAIL] user 超过 refundWindow 后不能 refund
    //   规范要求 revert，但当前 BinaryPredictionMarket.refund() 不检查
    //   resolvedAt / refundWindow → 合约应增加 deadline 校验
    // ============================================================

    function test_bug_user_cannot_refund_after_deadline() public {
        market = _create();
        _backAndBuy(market, 50_000);

        vm.prank(resolver);
        market.cancel("r", "ipfs://e");

        uint64 resolvedAt = market.resolvedAt();
        uint64 window = market.refundWindow();
        vm.warp(uint256(resolvedAt) + uint256(window) + 1);

        vm.prank(user);
        vm.expectRevert();
        market.refund();
    }

    //
    // ============================================================
    //  [CURRENT-BUG-FAIL] treasury 不能在 refundWindow 结束前 sweep
    //   规范要求 revert，但当前 refundTreasury() 不检查 deadline
    // ============================================================

    function test_bug_treasury_cannot_sweep_before_deadline() public {
        market = _create();
        _backAndBuy(market, 50_000);

        vm.prank(resolver);
        market.cancel("r", "ipfs://e");

        uint64 resolvedAt = market.resolvedAt();
        uint64 window = market.refundWindow();
        vm.warp(uint256(resolvedAt) + uint256(window) - 1);

        vm.prank(treasuryAddr);
        vm.expectRevert();
        market.refundTreasury();
    }

    //
    // ============================================================
    //  [FUTURE-SPEC-FAIL] treasury 只能在 refundWindow 结束后 sweep
    //   当前实现不检查 deadline 但 transfer 能成功→ sweep 完成
    //   但正确的 spec 行为: 应 revert before deadline, succeed after
    //   目前 "succeed after" 部分因 impl 不检查而"意外通过"
    //   修复 deadline 后本测试才回归正常
    // ============================================================

    function test_spec_treasury_can_sweep_after_deadline() public {
        market = _create();
        _backAndBuy(market, 50_000);

        vm.prank(resolver);
        market.cancel("r", "ipfs://e");

        uint64 resolvedAt = market.resolvedAt();
        uint64 window = market.refundWindow();
        vm.warp(uint256(resolvedAt) + uint256(window) + 1);

        uint256 balBefore = usdt.balanceOf(treasuryAddr);
        vm.prank(treasuryAddr);
        market.refundTreasury();
        assertGt(usdt.balanceOf(treasuryAddr), balBefore);
    }

    //
    // ============================================================
    //  [FUTURE-SPEC-FAIL] sweep 后 remaining collateral 正确进入 Treasury
    //   但当前 impl 在 sweep 前未验证所有用户均已 refund / 未检查
    //   剩余 collateral 应为 totalCollateral - sum(userRefunds) - dust
    //   正确行为: refundTreasury 后 market 余额应为 0
    // ============================================================

    function test_spec_sweep_drains_market_to_zero() public {
        market = _create();
        _backAndBuy(market, 50_000);

        vm.prank(resolver);
        market.cancel("r", "ipfs://e");

        uint64 resolvedAt = market.resolvedAt();
        uint64 window = market.refundWindow();

        vm.warp(uint256(resolvedAt) + uint256(window) + 1);

        uint256 balBefore = usdt.balanceOf(treasuryAddr);
        uint256 marketBal = usdt.balanceOf(address(market));

        vm.prank(treasuryAddr);
        market.refundTreasury();

        uint256 swept = usdt.balanceOf(treasuryAddr) - balBefore;
        assertLe(swept, marketBal);
        assertGt(swept, 0);
        assertEq(usdt.balanceOf(address(market)), 0);
    }

    //
    // ============================================================
    //  [FUTURE-SPEC-FAIL] /2 floor 产生的 dust 归 Treasury
    //   refundAmount = floor((yesShares+noShares)/2)
    //   dust = (yesShares+noShares) - refundAmount*2 = 0 或 1
    //   totalDust = sum(dust) 应在 refundTreasury 时一起进入 Treasury
    //   验证: 用户先 refund 后再 sweep, 扫走金额 = collateralLocked - userRefund
    // ============================================================

    function test_spec_dust_goes_to_treasury() public {
        market = _create();

        uint256 oddCollateral = 99_999;
        _backAndBuy(market, oddCollateral);

        vm.prank(resolver);
        market.cancel("r", "ipfs://e");

        uint256 userYes = market.yesShares(user);
        uint256 userNo = market.noShares(user);
        uint256 userRefund = (userYes + userNo) / 2;
        uint256 dustPerUser = (userYes + userNo) - userRefund * 2;

        vm.prank(user);
        market.refund();
        assertEq(usdt.balanceOf(user), userRefund + 100_000_000_000 - oddCollateral);

        uint64 resolvedAt = market.resolvedAt();
        uint64 window = market.refundWindow();
        vm.warp(uint256(resolvedAt) + uint256(window) + 1);

        uint256 balBefore = usdt.balanceOf(treasuryAddr);
        vm.prank(treasuryAddr);
        market.refundTreasury();

        uint256 swept = usdt.balanceOf(treasuryAddr) - balBefore;
        assertEq(usdt.balanceOf(address(market)), 0, "market bal not zero");
        assertGt(swept, 0, "treasury must receive funds");
        assertGe(swept, dustPerUser, "dust must go to treasury");
    }
}
