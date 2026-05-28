// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {MockUSDT} from "../src/tokens/MockUSDT.sol";
import {CPMMEngine} from "../src/pricing/CPMMEngine.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPredictionMarket} from "../src/market/BinaryPredictionMarket.sol";

contract MarketCollateralSolvencyInvariantSpec is Test {
    MockUSDT internal usdt;
    CPMMEngine internal engine;
    MarketFactory internal factory;

    address internal creator = address(this);
    address internal resolver = address(0xA11CE);
    address internal treasury = address(0x7E57);
    address internal feeRouter = address(0xFEE);
    address internal userA = address(0xBEEF);
    address internal userB = address(0xCAFE);
    address internal userC = address(0xCA11);
    address internal userD = address(0xD00D);

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

        usdt.mint(creator, 50_000_000);
        usdt.mint(userA, 50_000_000);
        usdt.mint(userB, 50_000_000);
        usdt.mint(userC, 50_000_000);
        usdt.mint(userD, 50_000_000);
    }

    function _createMarket(uint16 feeBps) internal returns (BinaryPredictionMarket market) {
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
        market = BinaryPredictionMarket(marketAddress);

        vm.prank(address(factory));
        market.setAmmEngine(address(engine));
    }

    function _fundMarketExtra(BinaryPredictionMarket market, uint256 amount) internal {
        usdt.transfer(address(market), amount);
    }

    function _buyYes(BinaryPredictionMarket market, address trader, uint256 collateralIn)
        internal
        returns (uint256 sharesOut, uint256 fee)
    {
        (sharesOut, fee,) = market.quoteBuyYes(collateralIn);
        vm.startPrank(trader);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, sharesOut);
        vm.stopPrank();
    }

    function _buyNo(BinaryPredictionMarket market, address trader, uint256 collateralIn)
        internal
        returns (uint256 sharesOut, uint256 fee)
    {
        (sharesOut, fee,) = market.quoteBuyNo(collateralIn);
        vm.startPrank(trader);
        usdt.approve(address(market), type(uint256).max);
        market.buyNo(collateralIn, sharesOut);
        vm.stopPrank();
    }

    function _sellYes(BinaryPredictionMarket market, address trader, uint256 sharesIn)
        internal
        returns (uint256 collateralOut, uint256 fee)
    {
        (collateralOut, fee,) = market.quoteSellYes(sharesIn);
        vm.prank(trader);
        market.sellYes(sharesIn, collateralOut);
    }

    function _sellNo(BinaryPredictionMarket market, address trader, uint256 sharesIn)
        internal
        returns (uint256 collateralOut, uint256 fee)
    {
        (collateralOut, fee,) = market.quoteSellNo(sharesIn);
        vm.prank(trader);
        market.sellNo(sharesIn, collateralOut);
    }

    function _resolveYes(BinaryPredictionMarket market) internal {
        vm.prank(resolver);
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "ipfs://yes");
    }

    function _resolveNo(BinaryPredictionMarket market) internal {
        vm.prank(resolver);
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.No, "ipfs://no");
    }

    function _cancel(BinaryPredictionMarket market) internal {
        vm.prank(resolver);
        market.cancel("cancelled", "ipfs://cancel");
    }

    function _markInvalid(BinaryPredictionMarket market) internal {
        vm.prank(resolver);
        market.markInvalid("invalid", "ipfs://invalid");
    }

    function _warpAfterRefundWindow(BinaryPredictionMarket market) internal {
        vm.warp(uint256(market.resolvedAt()) + uint256(market.refundWindow()) + 1);
    }

    function _claimMeasure(BinaryPredictionMarket market, address user)
        internal
        returns (uint256 userReceived, uint256 marketDecrease, uint256 treasuryDelta)
    {
        uint256 userBefore = usdt.balanceOf(user);
        uint256 marketBefore = usdt.balanceOf(address(market));
        uint256 treasuryBefore = usdt.balanceOf(treasury);

        vm.prank(user);
        market.claim();

        userReceived = usdt.balanceOf(user) - userBefore;
        marketDecrease = marketBefore - usdt.balanceOf(address(market));
        treasuryDelta = usdt.balanceOf(treasury) - treasuryBefore;
    }

    function _refundMeasure(BinaryPredictionMarket market, address user)
        internal
        returns (uint256 userReceived, uint256 marketDecrease, uint256 treasuryDelta)
    {
        uint256 userBefore = usdt.balanceOf(user);
        uint256 marketBefore = usdt.balanceOf(address(market));
        uint256 treasuryBefore = usdt.balanceOf(treasury);

        vm.prank(user);
        market.refund();

        userReceived = usdt.balanceOf(user) - userBefore;
        marketDecrease = marketBefore - usdt.balanceOf(address(market));
        treasuryDelta = usdt.balanceOf(treasury) - treasuryBefore;
    }

    function test_buy_multiUser_conserves_cashflow_and_fee_accounting() public {
        BinaryPredictionMarket market = _createMarket(50);

        address[4] memory traders = [userA, userB, userC, userD];
        uint256[4] memory inputs = [uint256(40_000), 55_000, 25_000, 35_000];
        bool[4] memory isYes = [true, false, true, false];

        uint256 treasuryStart = usdt.balanceOf(treasury);
        uint256 feesStart = market.totalFeesCollected();

        for (uint256 i = 0; i < traders.length; i++) {
            uint256 userBefore = usdt.balanceOf(traders[i]);
            uint256 marketBefore = usdt.balanceOf(address(market));
            uint256 treasuryBefore = usdt.balanceOf(treasury);
            uint256 feesBefore = market.totalFeesCollected();
            uint256 lockedBefore = market.collateralLocked();

            if (isYes[i]) {
                (uint256 quoteSharesOut, uint256 quoteFee,) = market.quoteBuyYes(inputs[i]);
                vm.startPrank(traders[i]);
                usdt.approve(address(market), type(uint256).max);
                market.buyYes(inputs[i], quoteSharesOut);
                vm.stopPrank();

                assertEq(market.yesShares(traders[i]), quoteSharesOut);
                assertEq(userBefore - usdt.balanceOf(traders[i]), inputs[i]);
                assertEq(usdt.balanceOf(address(market)) - marketBefore, inputs[i] - quoteFee);
                assertEq(usdt.balanceOf(treasury) - treasuryBefore, quoteFee);
                assertEq(market.totalFeesCollected() - feesBefore, quoteFee);
                assertEq(market.collateralLocked() - lockedBefore, inputs[i] - quoteFee);
            } else {
                (uint256 quoteSharesOut, uint256 quoteFee,) = market.quoteBuyNo(inputs[i]);
                vm.startPrank(traders[i]);
                usdt.approve(address(market), type(uint256).max);
                market.buyNo(inputs[i], quoteSharesOut);
                vm.stopPrank();

                assertEq(market.noShares(traders[i]), quoteSharesOut);
                assertEq(userBefore - usdt.balanceOf(traders[i]), inputs[i]);
                assertEq(usdt.balanceOf(address(market)) - marketBefore, inputs[i] - quoteFee);
                assertEq(usdt.balanceOf(treasury) - treasuryBefore, quoteFee);
                assertEq(market.totalFeesCollected() - feesBefore, quoteFee);
                assertEq(market.collateralLocked() - lockedBefore, inputs[i] - quoteFee);
            }
        }

        assertEq(usdt.balanceOf(treasury) - treasuryStart, market.totalFeesCollected() - feesStart);
    }

    function test_sell_multiUser_conserves_cashflow_and_fee_accounting() public {
        BinaryPredictionMarket market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        (uint256 yesSharesOut,) = _buyYes(market, userA, 80_000);
        (uint256 noSharesOut,) = _buyNo(market, userB, 70_000);

        uint256 treasuryStart = usdt.balanceOf(treasury);
        uint256 feesStart = market.totalFeesCollected();

        {
            uint256 sharesIn = yesSharesOut / 3;
            uint256 userBefore = usdt.balanceOf(userA);
            uint256 marketBefore = usdt.balanceOf(address(market));
            uint256 treasuryBefore = usdt.balanceOf(treasury);
            uint256 feesBefore = market.totalFeesCollected();
            uint256 lockedBefore = market.collateralLocked();
            (uint256 quoteCollateralOut, uint256 quoteFee,) = market.quoteSellYes(sharesIn);

            vm.prank(userA);
            market.sellYes(sharesIn, quoteCollateralOut);

            assertEq(usdt.balanceOf(userA) - userBefore, quoteCollateralOut);
            assertEq(marketBefore - usdt.balanceOf(address(market)), quoteCollateralOut + quoteFee);
            assertEq(usdt.balanceOf(treasury) - treasuryBefore, quoteFee);
            assertEq(market.totalFeesCollected() - feesBefore, quoteFee);
            assertEq(market.yesShares(userA), yesSharesOut - sharesIn);
            assertEq(lockedBefore - market.collateralLocked(), sharesIn);
        }

        {
            uint256 sharesIn = noSharesOut / 4;
            uint256 userBefore = usdt.balanceOf(userB);
            uint256 marketBefore = usdt.balanceOf(address(market));
            uint256 treasuryBefore = usdt.balanceOf(treasury);
            uint256 feesBefore = market.totalFeesCollected();
            uint256 lockedBefore = market.collateralLocked();
            (uint256 quoteCollateralOut, uint256 quoteFee,) = market.quoteSellNo(sharesIn);

            vm.prank(userB);
            market.sellNo(sharesIn, quoteCollateralOut);

            assertEq(usdt.balanceOf(userB) - userBefore, quoteCollateralOut);
            assertEq(marketBefore - usdt.balanceOf(address(market)), quoteCollateralOut + quoteFee);
            assertEq(usdt.balanceOf(treasury) - treasuryBefore, quoteFee);
            assertEq(market.totalFeesCollected() - feesBefore, quoteFee);
            assertEq(market.noShares(userB), noSharesOut - sharesIn);
            assertEq(lockedBefore - market.collateralLocked(), sharesIn);
        }

        assertEq(usdt.balanceOf(treasury) - treasuryStart, market.totalFeesCollected() - feesStart);
    }

    function test_mixed_buy_sell_paths_preserve_market_and_treasury_cashflows() public {
        BinaryPredictionMarket market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        uint256 marketStart = usdt.balanceOf(address(market));
        uint256 treasuryStart = usdt.balanceOf(treasury);
        uint256 feesStart = market.totalFeesCollected();
        int256 expectedMarketDelta;

        {
            (uint256 sharesOut, uint256 fee,) = market.quoteBuyYes(60_000);
            vm.startPrank(userA);
            usdt.approve(address(market), type(uint256).max);
            market.buyYes(60_000, sharesOut);
            vm.stopPrank();
            expectedMarketDelta += int256(60_000 - fee);
        }
        {
            (uint256 sharesOut, uint256 fee,) = market.quoteBuyNo(50_000);
            vm.startPrank(userB);
            usdt.approve(address(market), type(uint256).max);
            market.buyNo(50_000, sharesOut);
            vm.stopPrank();
            expectedMarketDelta += int256(50_000 - fee);
        }
        {
            uint256 sharesIn = market.yesShares(userA) / 3;
            (uint256 out, uint256 fee,) = market.quoteSellYes(sharesIn);
            vm.prank(userA);
            market.sellYes(sharesIn, out);
            expectedMarketDelta -= int256(out + fee);
        }
        {
            (uint256 sharesOut, uint256 fee,) = market.quoteBuyYes(30_000);
            vm.startPrank(userC);
            usdt.approve(address(market), type(uint256).max);
            market.buyYes(30_000, sharesOut);
            vm.stopPrank();
            expectedMarketDelta += int256(30_000 - fee);
        }
        {
            uint256 sharesIn = market.noShares(userB) / 4;
            (uint256 out, uint256 fee,) = market.quoteSellNo(sharesIn);
            vm.prank(userB);
            market.sellNo(sharesIn, out);
            expectedMarketDelta -= int256(out + fee);
        }
        {
            (uint256 sharesOut, uint256 fee,) = market.quoteBuyNo(20_000);
            vm.startPrank(userD);
            usdt.approve(address(market), type(uint256).max);
            market.buyNo(20_000, sharesOut);
            vm.stopPrank();
            expectedMarketDelta += int256(20_000 - fee);
        }

        assertEq(
            int256(usdt.balanceOf(address(market))) - int256(marketStart),
            expectedMarketDelta
        );
        assertEq(usdt.balanceOf(treasury) - treasuryStart, market.totalFeesCollected() - feesStart);
    }

    function test_resolve_yes_claim_order_does_not_exceed_preClaim_balance_or_touch_treasury() public {
        BinaryPredictionMarket marketAB = _createMarket(50);
        _fundMarketExtra(marketAB, 1_000_000);
        _buyYes(marketAB, userA, 90_000);
        _buyYes(marketAB, userB, 70_000);
        _buyNo(marketAB, userC, 40_000);
        _sellNo(marketAB, userC, marketAB.noShares(userC) / 2);
        _resolveYes(marketAB);

        uint256 preClaimBalanceAB = usdt.balanceOf(address(marketAB));
        uint256 feesBeforeAB = marketAB.totalFeesCollected();
        uint256 treasuryBeforeAB = usdt.balanceOf(treasury);

        (uint256 aReceived,, uint256 aTreasury) = _claimMeasure(marketAB, userA);
        (uint256 bReceived,, uint256 bTreasury) = _claimMeasure(marketAB, userB);
        (uint256 cReceived,, uint256 cTreasury) = _claimMeasure(marketAB, userC);

        assertEq(aTreasury, 0);
        assertEq(bTreasury, 0);
        assertEq(cTreasury, 0);
        assertEq(cReceived, 0);
        assertLe(aReceived + bReceived, preClaimBalanceAB);
        assertEq(usdt.balanceOf(treasury), treasuryBeforeAB);
        assertEq(marketAB.totalFeesCollected(), feesBeforeAB);

        BinaryPredictionMarket marketBA = _createMarket(50);
        _fundMarketExtra(marketBA, 1_000_000);
        _buyYes(marketBA, userA, 90_000);
        _buyYes(marketBA, userB, 70_000);
        _buyNo(marketBA, userC, 40_000);
        _sellNo(marketBA, userC, marketBA.noShares(userC) / 2);
        _resolveYes(marketBA);

        (uint256 bReceivedFirst,,) = _claimMeasure(marketBA, userB);
        (uint256 aReceivedSecond,,) = _claimMeasure(marketBA, userA);
        assertEq(aReceived + bReceived, bReceivedFirst + aReceivedSecond);
    }

    function test_resolve_no_claim_order_does_not_exceed_preClaim_balance_or_touch_treasury() public {
        BinaryPredictionMarket marketAB = _createMarket(50);
        _fundMarketExtra(marketAB, 1_000_000);
        _buyNo(marketAB, userA, 90_000);
        _buyNo(marketAB, userB, 70_000);
        _buyYes(marketAB, userC, 40_000);
        _sellYes(marketAB, userC, marketAB.yesShares(userC) / 2);
        _resolveNo(marketAB);

        uint256 preClaimBalanceAB = usdt.balanceOf(address(marketAB));
        uint256 feesBeforeAB = marketAB.totalFeesCollected();
        uint256 treasuryBeforeAB = usdt.balanceOf(treasury);

        (uint256 aReceived,, uint256 aTreasury) = _claimMeasure(marketAB, userA);
        (uint256 bReceived,, uint256 bTreasury) = _claimMeasure(marketAB, userB);
        (uint256 cReceived,, uint256 cTreasury) = _claimMeasure(marketAB, userC);

        assertEq(aTreasury, 0);
        assertEq(bTreasury, 0);
        assertEq(cTreasury, 0);
        assertEq(cReceived, 0);
        assertLe(aReceived + bReceived, preClaimBalanceAB);
        assertEq(usdt.balanceOf(treasury), treasuryBeforeAB);
        assertEq(marketAB.totalFeesCollected(), feesBeforeAB);

        BinaryPredictionMarket marketBA = _createMarket(50);
        _fundMarketExtra(marketBA, 1_000_000);
        _buyNo(marketBA, userA, 90_000);
        _buyNo(marketBA, userB, 70_000);
        _buyYes(marketBA, userC, 40_000);
        _sellYes(marketBA, userC, marketBA.yesShares(userC) / 2);
        _resolveNo(marketBA);

        (uint256 bReceivedFirst,,) = _claimMeasure(marketBA, userB);
        (uint256 aReceivedSecond,,) = _claimMeasure(marketBA, userA);
        assertEq(aReceived + bReceived, bReceivedFirst + aReceivedSecond);
    }

    function test_cancel_refund_total_never_exceeds_cancel_balance_and_cannot_repeat() public {
        BinaryPredictionMarket market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        _buyYes(market, userA, 70_000);
        _buyNo(market, userB, 60_000);
        _buyYes(market, userC, 50_000);
        _sellYes(market, userC, market.yesShares(userC) / 3);

        _cancel(market);

        uint256 balanceBeforeRefunds = usdt.balanceOf(address(market));
        uint256 feesBefore = market.totalFeesCollected();
        uint256 treasuryBefore = usdt.balanceOf(treasury);

        (uint256 aRefund, uint256 aMarketDecrease, uint256 aTreasuryDelta) = _refundMeasure(market, userA);
        (uint256 bRefund, uint256 bMarketDecrease, uint256 bTreasuryDelta) = _refundMeasure(market, userB);
        (uint256 cRefund, uint256 cMarketDecrease, uint256 cTreasuryDelta) = _refundMeasure(market, userC);

        assertEq(aRefund, aMarketDecrease);
        assertEq(bRefund, bMarketDecrease);
        assertEq(cRefund, cMarketDecrease);
        assertEq(aTreasuryDelta, 0);
        assertEq(bTreasuryDelta, 0);
        assertEq(cTreasuryDelta, 0);
        assertLe(aRefund + bRefund + cRefund, balanceBeforeRefunds);
        assertEq(market.totalFeesCollected(), feesBefore);
        assertEq(usdt.balanceOf(treasury), treasuryBefore);

        vm.prank(userA);
        vm.expectRevert(bytes("already claimed"));
        market.refund();
    }

    function test_invalid_refund_total_never_exceeds_invalid_balance_and_cannot_repeat() public {
        BinaryPredictionMarket market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        _buyNo(market, userA, 70_000);
        _buyYes(market, userB, 60_000);
        _buyNo(market, userC, 50_000);
        _sellNo(market, userC, market.noShares(userC) / 3);

        _markInvalid(market);

        uint256 balanceBeforeRefunds = usdt.balanceOf(address(market));
        uint256 feesBefore = market.totalFeesCollected();
        uint256 treasuryBefore = usdt.balanceOf(treasury);

        (uint256 aRefund, uint256 aMarketDecrease, uint256 aTreasuryDelta) = _refundMeasure(market, userA);
        (uint256 bRefund, uint256 bMarketDecrease, uint256 bTreasuryDelta) = _refundMeasure(market, userB);
        (uint256 cRefund, uint256 cMarketDecrease, uint256 cTreasuryDelta) = _refundMeasure(market, userC);

        assertEq(aRefund, aMarketDecrease);
        assertEq(bRefund, bMarketDecrease);
        assertEq(cRefund, cMarketDecrease);
        assertEq(aTreasuryDelta, 0);
        assertEq(bTreasuryDelta, 0);
        assertEq(cTreasuryDelta, 0);
        assertLe(aRefund + bRefund + cRefund, balanceBeforeRefunds);
        assertEq(market.totalFeesCollected(), feesBefore);
        assertEq(usdt.balanceOf(treasury), treasuryBefore);

        vm.prank(userA);
        vm.expectRevert(bytes("already claimed"));
        market.refund();
    }

    function test_refundTreasury_sweeps_remaining_balance_without_changing_totalFees() public {
        BinaryPredictionMarket market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        _buyYes(market, userA, 90_000);
        _buyNo(market, userB, 60_000);
        _cancel(market);

        _refundMeasure(market, userA);

        uint256 feesBeforeSweep = market.totalFeesCollected();
        uint256 marketBalanceBeforeSweep = usdt.balanceOf(address(market));
        uint256 treasuryBeforeSweep = usdt.balanceOf(treasury);

        _warpAfterRefundWindow(market);

        vm.prank(treasury);
        market.refundTreasury();

        assertEq(usdt.balanceOf(address(market)), 0);
        assertEq(usdt.balanceOf(treasury) - treasuryBeforeSweep, marketBalanceBeforeSweep);
        assertEq(market.totalFeesCollected(), feesBeforeSweep);
    }

    function test_terminal_state_cross_rules_and_treasury_invariant_hold() public {
        BinaryPredictionMarket resolvedMarket = _createMarket(50);
        _fundMarketExtra(resolvedMarket, 1_000_000);
        _buyYes(resolvedMarket, userA, 60_000);
        _resolveYes(resolvedMarket);

        uint256 feesBeforeClaim = resolvedMarket.totalFeesCollected();
        uint256 treasuryBeforeClaim = usdt.balanceOf(treasury);

        vm.prank(userA);
        vm.expectRevert(bytes("not refundable"));
        resolvedMarket.refund();

        vm.prank(userA);
        resolvedMarket.claim();

        assertEq(usdt.balanceOf(treasury), treasuryBeforeClaim);
        assertEq(resolvedMarket.totalFeesCollected(), feesBeforeClaim);

        BinaryPredictionMarket cancelledMarket = _createMarket(50);
        _fundMarketExtra(cancelledMarket, 1_000_000);
        _buyYes(cancelledMarket, userB, 60_000);
        _cancel(cancelledMarket);

        vm.prank(userB);
        vm.expectRevert(bytes("not resolved"));
        cancelledMarket.claim();

        vm.prank(treasury);
        vm.expectRevert(bytes("refund window active"));
        cancelledMarket.refundTreasury();
    }

    function test_treasury_delta_equals_trading_fees_plus_sweep_delta() public {
        BinaryPredictionMarket market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        uint256 treasuryStart = usdt.balanceOf(treasury);
        uint256 feesStart = market.totalFeesCollected();

        _buyYes(market, userA, 60_000);
        _buyNo(market, userB, 40_000);
        _sellYes(market, userA, market.yesShares(userA) / 3);
        _cancel(market);
        _refundMeasure(market, userA);

        uint256 tradingFeesDelta = market.totalFeesCollected() - feesStart;
        uint256 treasuryBeforeSweep = usdt.balanceOf(treasury);

        _warpAfterRefundWindow(market);

        uint256 marketBalanceBeforeSweep = usdt.balanceOf(address(market));
        vm.prank(treasury);
        market.refundTreasury();

        uint256 sweepDelta = usdt.balanceOf(treasury) - treasuryBeforeSweep;
        assertEq(tradingFeesDelta, treasuryBeforeSweep - treasuryStart);
        assertEq(sweepDelta, marketBalanceBeforeSweep);
        assertEq(usdt.balanceOf(treasury) - treasuryStart, tradingFeesDelta + sweepDelta);
    }

    function test_multiUser_refund_order_does_not_change_total_outflow_or_sweep() public {
        BinaryPredictionMarket marketAB = _createMarket(50);
        _fundMarketExtra(marketAB, 1_000_000);
        _buyYes(marketAB, userA, 70_000);
        _buyNo(marketAB, userB, 60_000);
        _cancel(marketAB);

        (uint256 aRefundAB,,) = _refundMeasure(marketAB, userA);
        (uint256 bRefundAB,,) = _refundMeasure(marketAB, userB);
        _warpAfterRefundWindow(marketAB);
        uint256 treasuryBeforeSweepAB = usdt.balanceOf(treasury);
        vm.prank(treasury);
        marketAB.refundTreasury();
        uint256 sweepAB = usdt.balanceOf(treasury) - treasuryBeforeSweepAB;

        BinaryPredictionMarket marketBA = _createMarket(50);
        _fundMarketExtra(marketBA, 1_000_000);
        _buyYes(marketBA, userA, 70_000);
        _buyNo(marketBA, userB, 60_000);
        _cancel(marketBA);

        (uint256 bRefundBA,,) = _refundMeasure(marketBA, userB);
        (uint256 aRefundBA,,) = _refundMeasure(marketBA, userA);
        _warpAfterRefundWindow(marketBA);
        uint256 treasuryBeforeSweepBA = usdt.balanceOf(treasury);
        vm.prank(treasury);
        marketBA.refundTreasury();
        uint256 sweepBA = usdt.balanceOf(treasury) - treasuryBeforeSweepBA;

        assertEq(aRefundAB + bRefundAB, aRefundBA + bRefundBA);
        assertEq(sweepAB, sweepBA);
    }

    function testFuzz_resolved_path_local_invariants(
        uint256 aBuyIn,
        uint256 bBuyIn,
        uint256 cBuyIn,
        bool outcomeYes,
        bool reverseOrder
    ) public {
        BinaryPredictionMarket market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        aBuyIn = bound(aBuyIn, 1, 100_000);
        bBuyIn = bound(bBuyIn, 1, 100_000);
        cBuyIn = bound(cBuyIn, 1, 100_000);

        _buyYes(market, userA, aBuyIn);
        _buyNo(market, userB, bBuyIn);
        _buyYes(market, userC, cBuyIn);

        uint256 feesBeforeResolve = market.totalFeesCollected();
        uint256 treasuryBeforeResolve = usdt.balanceOf(treasury);

        if (outcomeYes) {
            _resolveYes(market);
        } else {
            _resolveNo(market);
        }

        uint256 preClaimBalance = usdt.balanceOf(address(market));
        uint256 payout1;
        uint256 payout2;

        if (outcomeYes) {
            if (reverseOrder) {
                (payout1,,) = _claimMeasure(market, userC);
                (payout2,,) = _claimMeasure(market, userA);
            } else {
                (payout1,,) = _claimMeasure(market, userA);
                (payout2,,) = _claimMeasure(market, userC);
            }
            (uint256 loserPayout,,) = _claimMeasure(market, userB);
            assertEq(loserPayout, 0);
        } else {
            (payout1,,) = _claimMeasure(market, userB);
            (uint256 loserA,,) = _claimMeasure(market, userA);
            (uint256 loserC,,) = _claimMeasure(market, userC);
            assertEq(loserA, 0);
            assertEq(loserC, 0);
        }

        assertLe(payout1 + payout2, preClaimBalance);
        assertEq(market.totalFeesCollected(), feesBeforeResolve);
        assertEq(usdt.balanceOf(treasury), treasuryBeforeResolve);
    }

    function testFuzz_cancelled_path_local_invariants(
        uint256 aBuyIn,
        uint256 bBuyIn,
        uint256 cBuyIn,
        bool reverseOrder
    ) public {
        BinaryPredictionMarket market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        aBuyIn = bound(aBuyIn, 1, 100_000);
        bBuyIn = bound(bBuyIn, 1, 100_000);
        cBuyIn = bound(cBuyIn, 1, 100_000);

        _buyYes(market, userA, aBuyIn);
        _buyNo(market, userB, bBuyIn);
        _buyYes(market, userC, cBuyIn);

        _cancel(market);

        uint256 feesBeforeRefunds = market.totalFeesCollected();
        uint256 treasuryBeforeRefunds = usdt.balanceOf(treasury);
        uint256 balanceBeforeRefunds = usdt.balanceOf(address(market));
        uint256 refund1;
        uint256 refund2;
        uint256 refund3;

        if (reverseOrder) {
            (refund1,,) = _refundMeasure(market, userC);
            (refund2,,) = _refundMeasure(market, userB);
            (refund3,,) = _refundMeasure(market, userA);
        } else {
            (refund1,,) = _refundMeasure(market, userA);
            (refund2,,) = _refundMeasure(market, userB);
            (refund3,,) = _refundMeasure(market, userC);
        }

        assertLe(refund1 + refund2 + refund3, balanceBeforeRefunds);
        assertEq(market.totalFeesCollected(), feesBeforeRefunds);
        assertEq(usdt.balanceOf(treasury), treasuryBeforeRefunds);

        _warpAfterRefundWindow(market);
        uint256 marketBalanceBeforeSweep = usdt.balanceOf(address(market));
        uint256 treasuryBeforeSweep = usdt.balanceOf(treasury);

        vm.prank(treasury);
        market.refundTreasury();

        assertEq(usdt.balanceOf(address(market)), 0);
        assertEq(usdt.balanceOf(treasury) - treasuryBeforeSweep, marketBalanceBeforeSweep);
    }
}
