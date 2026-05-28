// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {MockUSDT} from "../src/tokens/MockUSDT.sol";
import {CPMMEngine} from "../src/pricing/CPMMEngine.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPredictionMarket} from "../src/market/BinaryPredictionMarket.sol";

contract MarketLifecycleStateMachineSpec is Test {
    MockUSDT internal usdt;
    CPMMEngine internal engine;
    MarketFactory internal factory;

    address internal creator = address(this);
    address internal resolver = address(0xA11CE);
    address internal treasury = address(0x7E57);
    address internal feeRouter = address(0xFEE);
    address internal yesTrader = address(0xBEEF);
    address internal noTrader = address(0xCAFE);
    address internal refundUser = address(0xDEAD);
    address internal outsider = address(0xBAD);

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

        usdt.mint(creator, 20_000_000);
        usdt.mint(yesTrader, 5_000_000);
        usdt.mint(noTrader, 5_000_000);
        usdt.mint(refundUser, 5_000_000);
    }

    function _createPendingMarket() internal returns (BinaryPredictionMarket) {
        return _createMarket(uint64(block.timestamp + 1 days), uint64(block.timestamp + 8 days));
    }

    function _createActiveMarket() internal returns (BinaryPredictionMarket) {
        return _createMarket(uint64(block.timestamp), uint64(block.timestamp + 7 days));
    }

    function _createMarket(uint64 startTime, uint64 endTime) internal returns (BinaryPredictionMarket market) {
        MarketFactory.CreateMarketParams memory p = MarketFactory.CreateMarketParams({
            question: "BTC>100k?",
            metadataURI: "ipfs://rule",
            collateral: address(usdt),
            startTime: startTime,
            endTime: endTime,
            initialCollateral: 1_000_000,
            initialPriceYesBps: 5000,
            minTradeAmount: 1,
            maxTradeAmount: 100_000,
            maxSlippageBps: 500,
            feeBps: 50
        });

        usdt.approve(address(factory), p.initialCollateral);

        (, address marketAddress) = factory.createMarket(p);
        market = BinaryPredictionMarket(marketAddress);
        vm.prank(address(factory));
        market.setAmmEngine(address(engine));
    }

    function _backMarket(BinaryPredictionMarket market, uint256 amount) internal {
        usdt.transfer(address(market), amount);
    }

    function _buyYes(BinaryPredictionMarket market, address trader, uint256 collateralIn) internal returns (uint256 sharesOut) {
        (sharesOut,,) = market.quoteBuyYes(collateralIn);
        vm.startPrank(trader);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, sharesOut);
        vm.stopPrank();
    }

    function _buyNo(BinaryPredictionMarket market, address trader, uint256 collateralIn) internal returns (uint256 sharesOut) {
        (sharesOut,,) = market.quoteBuyNo(collateralIn);
        vm.startPrank(trader);
        usdt.approve(address(market), type(uint256).max);
        market.buyNo(collateralIn, sharesOut);
        vm.stopPrank();
    }

    function _buyInitialPositions(BinaryPredictionMarket market) internal returns (uint256 yesSharesOut, uint256 noSharesOut) {
        yesSharesOut = _buyYes(market, yesTrader, 80_000);
        noSharesOut = _buyNo(market, noTrader, 70_000);
    }

    function _resolveYes(BinaryPredictionMarket market) internal {
        vm.prank(resolver);
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "ipfs://yes");
    }

    function _cancelMarket(BinaryPredictionMarket market) internal {
        vm.prank(resolver);
        market.cancel("cancelled", "ipfs://cancel");
    }

    function _markInvalidMarket(BinaryPredictionMarket market) internal {
        vm.prank(resolver);
        market.markInvalid("invalid", "ipfs://invalid");
    }

    function _warpAfterEndTime(BinaryPredictionMarket market) internal {
        vm.warp(uint256(market.endTime()) + 1);
    }

    function _warpAfterRefundWindow(BinaryPredictionMarket market) internal {
        vm.warp(uint256(market.resolvedAt()) + uint256(market.refundWindow()) + 1);
    }

    function _expectIllegalTrading(BinaryPredictionMarket market, bytes memory revertData) internal {
        vm.startPrank(yesTrader);
        vm.expectRevert(revertData);
        market.buyYes(10_000, 0);
        vm.expectRevert(revertData);
        market.buyNo(10_000, 0);
        vm.expectRevert(revertData);
        market.sellYes(10_000, 0);
        vm.expectRevert(revertData);
        market.sellNo(10_000, 0);
        vm.stopPrank();
    }

    function _expectTerminalStateLocked(BinaryPredictionMarket market) internal {
        vm.startPrank(resolver);
        vm.expectRevert(bytes("not active"));
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "ipfs://again");
        vm.expectRevert(bytes("not active"));
        market.cancel("again", "ipfs://again");
        vm.expectRevert(bytes("not active"));
        market.markInvalid("again", "ipfs://again");
        vm.stopPrank();
    }

    function test_pending_freezesPreStartTrading() public {
        BinaryPredictionMarket market = _createPendingMarket();

        assertEq(uint256(market.status()), uint256(BinaryPredictionMarket.MarketStatus.Active));
        assertLt(block.timestamp, market.startTime());

        _expectIllegalTrading(market, bytes("not started"));
    }

    function test_pending_claimRefundAndRefundTreasuryRevert() public {
        BinaryPredictionMarket market = _createPendingMarket();

        vm.prank(yesTrader);
        vm.expectRevert(bytes("not resolved"));
        market.claim();

        vm.prank(refundUser);
        vm.expectRevert(bytes("not refundable"));
        market.refund();

        vm.prank(treasury);
        vm.expectRevert(bytes("not refundable"));
        market.refundTreasury();
    }

    function test_pending_resolverCanResolveByCurrentRules() public {
        BinaryPredictionMarket market = _createPendingMarket();

        _resolveYes(market);

        assertEq(uint256(market.status()), uint256(BinaryPredictionMarket.MarketStatus.Resolved));
        assertEq(uint256(market.outcome()), uint256(BinaryPredictionMarket.Outcome.Yes));
    }

    function test_pending_resolverCanCancelByCurrentRules() public {
        BinaryPredictionMarket market = _createPendingMarket();

        _cancelMarket(market);

        assertEq(uint256(market.status()), uint256(BinaryPredictionMarket.MarketStatus.Cancelled));
        assertEq(uint256(market.outcome()), uint256(BinaryPredictionMarket.Outcome.Cancelled));
    }

    function test_pending_resolverCanMarkInvalidByCurrentRules() public {
        BinaryPredictionMarket market = _createPendingMarket();

        _markInvalidMarket(market);

        assertEq(uint256(market.status()), uint256(BinaryPredictionMarket.MarketStatus.Invalid));
        assertEq(uint256(market.outcome()), uint256(BinaryPredictionMarket.Outcome.Invalid));
    }

    function test_active_buyYesBuyNoSellYesSellNoSucceed() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _backMarket(market, 1_000_000);

        uint256 yesSharesOut = _buyYes(market, yesTrader, 80_000);
        uint256 noSharesOut = _buyNo(market, noTrader, 70_000);

        uint256 sellYesShares = yesSharesOut / 4;
        (uint256 minCollateralOutYes,,) = market.quoteSellYes(sellYesShares);
        uint256 yesBalanceBefore = usdt.balanceOf(yesTrader);

        vm.prank(yesTrader);
        market.sellYes(sellYesShares, minCollateralOutYes);

        assertEq(market.yesShares(yesTrader), yesSharesOut - sellYesShares);
        assertGt(usdt.balanceOf(yesTrader), yesBalanceBefore);

        uint256 sellNoShares = noSharesOut / 4;
        (uint256 minCollateralOutNo,,) = market.quoteSellNo(sellNoShares);
        uint256 noBalanceBefore = usdt.balanceOf(noTrader);

        vm.prank(noTrader);
        market.sellNo(sellNoShares, minCollateralOutNo);

        assertEq(market.noShares(noTrader), noSharesOut - sellNoShares);
        assertGt(usdt.balanceOf(noTrader), noBalanceBefore);
    }

    function test_active_resolverCanResolveCancelAndMarkInvalid() public {
        BinaryPredictionMarket resolvedMarket = _createActiveMarket();
        _resolveYes(resolvedMarket);
        assertEq(uint256(resolvedMarket.status()), uint256(BinaryPredictionMarket.MarketStatus.Resolved));

        BinaryPredictionMarket cancelledMarket = _createActiveMarket();
        _cancelMarket(cancelledMarket);
        assertEq(uint256(cancelledMarket.status()), uint256(BinaryPredictionMarket.MarketStatus.Cancelled));

        BinaryPredictionMarket invalidMarket = _createActiveMarket();
        _markInvalidMarket(invalidMarket);
        assertEq(uint256(invalidMarket.status()), uint256(BinaryPredictionMarket.MarketStatus.Invalid));
    }

    function test_active_unauthorizedCannotResolveCancelOrMarkInvalid() public {
        BinaryPredictionMarket market = _createActiveMarket();

        vm.startPrank(outsider);
        vm.expectRevert(bytes("not resolver"));
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "ipfs://bad");
        vm.expectRevert(bytes("not resolver"));
        market.cancel("bad", "ipfs://bad");
        vm.expectRevert(bytes("not resolver"));
        market.markInvalid("bad", "ipfs://bad");
        vm.stopPrank();
    }

    function test_resolved_blocksTradingRefundAndFurtherTransitions() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _backMarket(market, 1_000_000);
        _buyInitialPositions(market);
        _resolveYes(market);

        _expectIllegalTrading(market, bytes("not active"));

        vm.prank(refundUser);
        vm.expectRevert(bytes("not refundable"));
        market.refund();

        vm.prank(treasury);
        vm.expectRevert(bytes("not refundable"));
        market.refundTreasury();

        _expectTerminalStateLocked(market);
    }

    function test_resolved_winnerCanClaim() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _backMarket(market, 1_000_000);
        uint256 winningShares = _buyYes(market, yesTrader, 90_000);
        _buyNo(market, noTrader, 40_000);
        _resolveYes(market);

        uint256 balanceBefore = usdt.balanceOf(yesTrader);

        vm.prank(yesTrader);
        market.claim();

        assertEq(market.yesShares(yesTrader), 0);
        assertTrue(market.claimedFinalPayout(yesTrader));
        assertEq(usdt.balanceOf(yesTrader) - balanceBefore, winningShares);
    }

    function test_resolved_loserClaimFreezesZeroPayoutCurrentBehavior() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _backMarket(market, 1_000_000);
        _buyYes(market, yesTrader, 90_000);
        uint256 losingShares = _buyNo(market, noTrader, 40_000);
        _resolveYes(market);

        uint256 balanceBefore = usdt.balanceOf(noTrader);

        vm.prank(noTrader);
        market.claim();

        assertEq(usdt.balanceOf(noTrader), balanceBefore);
        assertEq(market.noShares(noTrader), losingShares);
        assertTrue(market.claimedFinalPayout(noTrader));
    }

    function test_cancelled_blocksTradingClaimAndFurtherTransitions() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _backMarket(market, 1_000_000);
        _buyYes(market, refundUser, 75_000);
        _cancelMarket(market);

        _expectIllegalTrading(market, bytes("not active"));

        vm.prank(refundUser);
        vm.expectRevert(bytes("not resolved"));
        market.claim();

        vm.prank(treasury);
        vm.expectRevert(bytes("refund window active"));
        market.refundTreasury();

        _expectTerminalStateLocked(market);
    }

    function test_cancelled_userCanRefund() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _backMarket(market, 1_000_000);
        uint256 yesSharesOut = _buyYes(market, refundUser, 75_000);
        _cancelMarket(market);

        uint256 balanceBefore = usdt.balanceOf(refundUser);

        vm.prank(refundUser);
        market.refund();

        assertEq(usdt.balanceOf(refundUser) - balanceBefore, yesSharesOut / 2);
        assertEq(market.yesShares(refundUser), 0);
        assertEq(market.noShares(refundUser), 0);
        assertTrue(market.claimedFinalPayout(refundUser));
    }

    function test_cancelled_treasuryCanSweepAfterRefundWindow() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _backMarket(market, 1_000_000);
        _buyYes(market, refundUser, 75_000);
        _cancelMarket(market);
        _warpAfterRefundWindow(market);

        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.prank(treasury);
        market.refundTreasury();

        assertGt(usdt.balanceOf(treasury) - treasuryBalanceBefore, 0);
        assertEq(usdt.balanceOf(address(market)), 0);
    }

    function test_invalid_blocksTradingClaimAndFurtherTransitions() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _backMarket(market, 1_000_000);
        _buyNo(market, refundUser, 75_000);
        _markInvalidMarket(market);

        _expectIllegalTrading(market, bytes("not active"));

        vm.prank(refundUser);
        vm.expectRevert(bytes("not resolved"));
        market.claim();

        vm.prank(treasury);
        vm.expectRevert(bytes("refund window active"));
        market.refundTreasury();

        _expectTerminalStateLocked(market);
    }

    function test_invalid_userCanRefund() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _backMarket(market, 1_000_000);
        uint256 noSharesOut = _buyNo(market, refundUser, 75_000);
        _markInvalidMarket(market);

        uint256 balanceBefore = usdt.balanceOf(refundUser);

        vm.prank(refundUser);
        market.refund();

        assertEq(usdt.balanceOf(refundUser) - balanceBefore, noSharesOut / 2);
        assertEq(market.yesShares(refundUser), 0);
        assertEq(market.noShares(refundUser), 0);
        assertTrue(market.claimedFinalPayout(refundUser));
    }

    function test_invalid_treasuryCanSweepAfterRefundWindow() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _backMarket(market, 1_000_000);
        _buyNo(market, refundUser, 75_000);
        _markInvalidMarket(market);
        _warpAfterRefundWindow(market);

        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        vm.prank(treasury);
        market.refundTreasury();

        assertGt(usdt.balanceOf(treasury) - treasuryBalanceBefore, 0);
        assertEq(usdt.balanceOf(address(market)), 0);
    }

    function test_paused_isSafetySwitchNotLifecycleState() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _backMarket(market, 1_000_000);
        _buyInitialPositions(market);

        vm.prank(address(factory));
        market.pause();

        assertEq(uint256(market.status()), uint256(BinaryPredictionMarket.MarketStatus.Paused));

        vm.startPrank(yesTrader);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        market.buyYes(10_000, 0);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        market.sellYes(10_000, 0);
        vm.stopPrank();

        vm.prank(address(factory));
        market.unpause();

        (uint256 sharesOut,,) = market.quoteBuyYes(10_000);
        vm.prank(yesTrader);
        market.buyYes(10_000, sharesOut);
        assertGt(market.yesShares(yesTrader), 0);
    }
}
