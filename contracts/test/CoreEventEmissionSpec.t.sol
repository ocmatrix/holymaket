pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {MockUSDT} from "../src/tokens/MockUSDT.sol";
import {CPMMEngine} from "../src/pricing/CPMMEngine.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPredictionMarket} from "../src/market/BinaryPredictionMarket.sol";

contract CoreEventEmissionSpec is Test {
    MockUSDT internal usdt;
    CPMMEngine internal engine;
    MarketFactory internal factory;

    address internal creator = address(this);
    address internal user = address(0xBEEF);
    address internal user2 = address(0xCAFE);
    address internal resolver = address(0xA11CE);
    address internal treasuryAddr = address(0x7E57);
    address internal feeRouter = address(0xFEE);
    address internal outsider = address(0xBAD);

    function setUp() public {
        usdt = new MockUSDT();
        engine = new CPMMEngine();

        factory = new MarketFactory(
            500, 1000, 1000, 1_000_000, 3000, 7000,
            resolver, feeRouter, treasuryAddr
        );
        factory.setCollateralAllowed(address(usdt), true);
        factory.setAmmEngine(address(engine));

        usdt.mint(user, 100_000_000_000);
        usdt.mint(user2, 100_000_000_000);
        usdt.mint(creator, 20_000_000);
    }

    function _validParams() internal view returns (MarketFactory.CreateMarketParams memory) {
        return MarketFactory.CreateMarketParams({
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
    }

    function _createMarket(uint16 feeBps) internal returns (BinaryPredictionMarket) {
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.feeBps = feeBps;
        p.initialCollateral = 1_000_000;
        p.initialPriceYesBps = 5000;

        usdt.approve(address(factory), p.initialCollateral);

        (, address marketAddress) = factory.createMarket(p);
        BinaryPredictionMarket m = BinaryPredictionMarket(marketAddress);
        return m;
    }

    function _preApproveBuyer(BinaryPredictionMarket m, address buyer) internal {
        vm.prank(buyer);
        usdt.approve(address(m), type(uint256).max);
    }

    function _buyYes(BinaryPredictionMarket m, address buyer, uint256 amount) internal {
        (uint256 sharesOut,,) = m.quoteBuyYes(amount);
        _preApproveBuyer(m, buyer);
        vm.prank(buyer);
        m.buyYes(amount, sharesOut);
    }

    function _buyNo(BinaryPredictionMarket m, address buyer, uint256 amount) internal {
        (uint256 sharesOut,,) = m.quoteBuyNo(amount);
        _preApproveBuyer(m, buyer);
        vm.prank(buyer);
        m.buyNo(amount, sharesOut);
    }

    // A. MarketCreated
    function test_event_MarketCreated_allParams_correct() public {
        MarketFactory.CreateMarketParams memory p = _validParams();
        uint256 expectedId = factory.nextMarketId();
        usdt.approve(address(factory), p.initialCollateral);

        vm.expectEmit(true, false, true, true);
        emit MarketFactory.MarketCreated(
            expectedId, address(0), creator,
            p.question, p.collateral, p.startTime, p.endTime, p.initialCollateral, p.initialPriceYesBps
        );
        factory.createMarket(p);
    }

    // B. PositionBought buyYes
    function test_event_PositionBought_buyYes_correct() public {
        BinaryPredictionMarket m = _createMarket(50);
        uint256 collateralIn = 50_000;
        (uint256 sharesOut, uint256 fee, uint256 nrYes, uint256 nrNo,) = engine.quoteBuyYes(collateralIn, m.R_yes(), m.R_no(), 50);
        uint256 priceAfter = (nrNo * 10000) / (nrYes + nrNo);

        _preApproveBuyer(m, user);

        vm.expectEmit(true, true, false, true);
        emit BinaryPredictionMarket.PositionBought(0, user, 1, collateralIn, sharesOut, fee, priceAfter);
        vm.expectEmit(true, false, true, true);
        emit BinaryPredictionMarket.FeeCollected(0, fee, treasuryAddr);
        vm.expectEmit(true, false, false, true);
        emit BinaryPredictionMarket.ReservesUpdated(0, nrYes, nrNo);

        vm.prank(user);
        m.buyYes(collateralIn, sharesOut);
    }

    // C. PositionBought buyNo
    function test_event_PositionBought_buyNo_correct() public {
        BinaryPredictionMarket m = _createMarket(50);
        uint256 collateralIn = 50_000;
        (uint256 sharesOut, uint256 fee, uint256 nrYes, uint256 nrNo,) = engine.quoteBuyNo(collateralIn, m.R_yes(), m.R_no(), 50);
        uint256 priceAfter = (nrYes * 10000) / (nrYes + nrNo);

        _preApproveBuyer(m, user);

        vm.expectEmit(true, true, false, true);
        emit BinaryPredictionMarket.PositionBought(0, user, 2, collateralIn, sharesOut, fee, priceAfter);
        vm.expectEmit(true, false, true, true);
        emit BinaryPredictionMarket.FeeCollected(0, fee, treasuryAddr);
        vm.expectEmit(true, false, false, true);
        emit BinaryPredictionMarket.ReservesUpdated(0, nrYes, nrNo);

        vm.prank(user);
        m.buyNo(collateralIn, sharesOut);
    }

    // D. PositionSold sellYes
    function test_event_PositionSold_sellYes_correct() public {
        BinaryPredictionMarket m = _createMarket(50);
        _buyYes(m, user, 50_000);
        uint256 sharesIn = m.yesShares(user) / 3;
        (uint256 collateralOut, uint256 fee, uint256 nrYes, uint256 nrNo,) = engine.quoteSellYes(sharesIn, m.R_yes(), m.R_no(), 50);
        uint256 priceAfter = (nrNo * 10000) / (nrYes + nrNo);

        vm.expectEmit(true, true, false, true);
        emit BinaryPredictionMarket.PositionSold(0, user, 1, sharesIn, collateralOut, fee, priceAfter);
        vm.expectEmit(true, false, true, true);
        emit BinaryPredictionMarket.FeeCollected(0, fee, treasuryAddr);
        vm.expectEmit(true, false, false, true);
        emit BinaryPredictionMarket.ReservesUpdated(0, nrYes, nrNo);

        vm.prank(user);
        m.sellYes(sharesIn, collateralOut);
    }

    // E. PositionSold sellNo
    function test_event_PositionSold_sellNo_correct() public {
        BinaryPredictionMarket m = _createMarket(50);
        _buyNo(m, user, 50_000);
        uint256 sharesIn = m.noShares(user) / 3;
        (uint256 collateralOut, uint256 fee, uint256 nrYes, uint256 nrNo,) = engine.quoteSellNo(sharesIn, m.R_yes(), m.R_no(), 50);
        uint256 priceAfter = (nrYes * 10000) / (nrYes + nrNo);

        vm.expectEmit(true, true, false, true);
        emit BinaryPredictionMarket.PositionSold(0, user, 2, sharesIn, collateralOut, fee, priceAfter);
        vm.expectEmit(true, false, true, true);
        emit BinaryPredictionMarket.FeeCollected(0, fee, treasuryAddr);
        vm.expectEmit(true, false, false, true);
        emit BinaryPredictionMarket.ReservesUpdated(0, nrYes, nrNo);

        vm.prank(user);
        m.sellNo(sharesIn, collateralOut);
    }

    // F. FeeCollected across all paths + feeBps=0
    function test_event_FeeCollected_on_buy_and_sell() public {
        BinaryPredictionMarket m = _createMarket(50);
        uint256 collateralIn = 30_000;

        (uint256 bYShares, uint256 bYFee,,,) = engine.quoteBuyYes(collateralIn, m.R_yes(), m.R_no(), 50);
        _preApproveBuyer(m, user);
        vm.expectEmit(true, false, true, true);
        emit BinaryPredictionMarket.FeeCollected(0, bYFee, treasuryAddr);
        vm.prank(user);
        m.buyYes(collateralIn, bYShares);

        (uint256 bNShares, uint256 bNFee,,,) = engine.quoteBuyNo(collateralIn, m.R_yes(), m.R_no(), 50);
        _preApproveBuyer(m, user);
        vm.expectEmit(true, false, true, true);
        emit BinaryPredictionMarket.FeeCollected(0, bNFee, treasuryAddr);
        vm.prank(user);
        m.buyNo(collateralIn, bNShares);
    }

    function test_event_FeeCollected_on_zero_feeBps() public {
        BinaryPredictionMarket mZero = _createMarket(0);
        (uint256 zShares, uint256 zFee,,,) = engine.quoteBuyYes(30_000, mZero.R_yes(), mZero.R_no(), 0);
        assertEq(zFee, 0);

        _preApproveBuyer(mZero, user2);
        vm.expectEmit(true, false, true, true);
        emit BinaryPredictionMarket.FeeCollected(0, 0, treasuryAddr);
        vm.prank(user2);
        mZero.buyYes(30_000, zShares);
        assertEq(mZero.totalFeesCollected(), 0);
    }

    // G. MarketResolved resolve
    function test_event_MarketResolved_resolve_YES() public {
        BinaryPredictionMarket m = _createMarket(50);
        vm.expectEmit(true, false, true, true);
        emit BinaryPredictionMarket.MarketResolved(0, BinaryPredictionMarket.Outcome.Yes, resolver, "ev-1");
        vm.prank(resolver);
        m.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "ev-1");
    }

    // H. MarketResolved cancel
    function test_event_MarketResolved_cancel() public {
        BinaryPredictionMarket m = _createMarket(50);
        vm.expectEmit(true, false, true, true);
        emit BinaryPredictionMarket.MarketResolved(0, BinaryPredictionMarket.Outcome.Cancelled, resolver, "ev-c");
        vm.prank(resolver);
        m.cancel("r", "ev-c");
    }

    // I. MarketResolved invalid
    function test_event_MarketResolved_markInvalid() public {
        BinaryPredictionMarket m = _createMarket(50);
        vm.expectEmit(true, false, true, true);
        emit BinaryPredictionMarket.MarketResolved(0, BinaryPredictionMarket.Outcome.Invalid, resolver, "ev-i");
        vm.prank(resolver);
        m.markInvalid("r", "ev-i");
    }

    function test_event_MarketResolved_not_emitted_on_second_resolve() public {
        BinaryPredictionMarket m = _createMarket(50);
        vm.prank(resolver);
        m.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "ev-1");

        vm.recordLogs();
        vm.prank(resolver);
        vm.expectRevert();
        m.resolveByAdmin(BinaryPredictionMarket.Outcome.No, "ev-2");
        assertEq(vm.getRecordedLogs().length, 0);
    }

    // J. RewardClaimed
    function test_event_RewardClaimed_winner_correct() public {
        BinaryPredictionMarket m = _createMarket(50);
        _buyYes(m, user, 50_000);
        vm.prank(resolver);
        m.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "ev-1");

        uint256 expectedPayout = m.yesShares(user);
        vm.expectEmit(true, true, false, true);
        emit BinaryPredictionMarket.RewardClaimed(0, user, expectedPayout);
        vm.prank(user);
        m.claim();
    }

    function test_event_RewardClaimed_loser_zeroPayout_frozen() public {
        BinaryPredictionMarket m = _createMarket(50);
        _buyYes(m, user, 50_000);
        vm.prank(resolver);
        m.resolveByAdmin(BinaryPredictionMarket.Outcome.No, "ev-1");

        vm.expectEmit(true, true, false, true);
        emit BinaryPredictionMarket.RewardClaimed(0, user, 0);
        vm.prank(user);
        m.claim();
    }

    function test_event_RewardClaimed_not_emitted_on_repeat_claim() public {
        BinaryPredictionMarket m = _createMarket(50);
        _buyYes(m, user, 50_000);
        vm.prank(resolver);
        m.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "ev-1");

        vm.prank(user);
        m.claim();

        vm.recordLogs();
        vm.prank(user);
        vm.expectRevert();
        m.claim();
        assertEq(vm.getRecordedLogs().length, 0);
    }

    // K. RefundClaimed
    function test_event_RefundClaimed_correct() public {
        BinaryPredictionMarket m = _createMarket(50);
        _buyYes(m, user, 50_000);
        vm.prank(resolver);
        m.cancel("r", "ev-c");

        uint256 y = m.yesShares(user);
        uint256 n = m.noShares(user);
        uint256 expectedRefund = (y + n) / 2;

        vm.expectEmit(true, true, false, true);
        emit BinaryPredictionMarket.RefundClaimed(0, user, y, n, expectedRefund);
        vm.prank(user);
        m.refund();
    }

    function test_event_RefundClaimed_not_emitted_on_repeat_refund() public {
        BinaryPredictionMarket m = _createMarket(50);
        _buyYes(m, user, 50_000);
        vm.prank(resolver);
        m.cancel("r", "ev-c");

        vm.prank(user);
        m.refund();

        vm.recordLogs();
        vm.prank(user);
        vm.expectRevert();
        m.refund();
        assertEq(vm.getRecordedLogs().length, 0);
    }

    // L. TreasuryRefundClaimed
    function test_event_TreasuryRefundClaimed_sweep_correct() public {
        BinaryPredictionMarket m = _createMarket(50);
        _buyYes(m, user, 50_000);
        vm.prank(resolver);
        m.cancel("r", "ev-c");

        uint64 resolvedAt = m.resolvedAt();
        uint64 window = m.refundWindow();
        vm.warp(uint256(resolvedAt) + uint256(window) + 1);

        uint256 sweepAmount = usdt.balanceOf(address(m));
        uint256 treasuryBefore = usdt.balanceOf(treasuryAddr);

        vm.expectEmit(true, false, false, true);
        emit BinaryPredictionMarket.TreasuryRefundClaimed(0, sweepAmount);
        vm.prank(treasuryAddr);
        m.refundTreasury();

        assertEq(usdt.balanceOf(treasuryAddr) - treasuryBefore, sweepAmount);
        assertEq(usdt.balanceOf(address(m)), 0);
    }

    function test_event_TreasuryRefundClaimed_not_emitted_before_window() public {
        BinaryPredictionMarket m = _createMarket(50);
        _buyYes(m, user, 50_000);
        vm.prank(resolver);
        m.cancel("r", "ev-c");

        uint64 resolvedAt = m.resolvedAt();
        uint64 window = m.refundWindow();
        vm.warp(uint256(resolvedAt) + uint256(window) - 1);

        vm.recordLogs();
        vm.prank(treasuryAddr);
        vm.expectRevert();
        m.refundTreasury();
        assertEq(vm.getRecordedLogs().length, 0);
    }

    // M. MarketPaused / MarketUnpaused
    function test_event_MarketPaused_and_MarketUnpaused() public {
        BinaryPredictionMarket m = _createMarket(50);

        vm.expectEmit(true, false, false, false);
        emit BinaryPredictionMarket.MarketPaused(0);
        vm.prank(address(factory));
        m.pause();

        vm.expectEmit(true, false, false, false);
        emit BinaryPredictionMarket.MarketUnpaused(0);
        vm.prank(address(factory));
        m.unpause();
    }

    function test_event_MarketPaused_not_emitted_when_not_active() public {
        BinaryPredictionMarket m = _createMarket(50);
        vm.prank(resolver);
        m.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "ev-1");

        vm.recordLogs();
        vm.expectRevert();
        m.pause();
        assertEq(vm.getRecordedLogs().length, 0);
    }

    // N. Revert paths do not emit events
    function test_revert_no_events_buy_zero_input() public {
        BinaryPredictionMarket m = _createMarket(50);
        _preApproveBuyer(m, user);
        vm.recordLogs();
        vm.prank(user);
        vm.expectRevert();
        m.buyYes(0, 0);
        assertEq(vm.getRecordedLogs().length, 0);
    }

    function test_revert_no_events_sell_zero_input() public {
        BinaryPredictionMarket m = _createMarket(50);
        vm.recordLogs();
        vm.prank(user);
        vm.expectRevert();
        m.sellYes(0, 0);
        assertEq(vm.getRecordedLogs().length, 0);
    }

    function test_revert_no_events_unauthorized_resolve() public {
        BinaryPredictionMarket m = _createMarket(50);
        vm.recordLogs();
        vm.prank(outsider);
        vm.expectRevert();
        m.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "ev");
        assertEq(vm.getRecordedLogs().length, 0);
    }

    // O. Full path event consistency — resolve + claim
    function test_event_consistency_full_lifecycle_resolve_claim() public {
        BinaryPredictionMarket m = _createMarket(50);
        uint256 collateralIn = 50_000;

        (uint256 bYShares, uint256 bYFee, uint256 nrY1, uint256 nrN1,) = engine.quoteBuyYes(collateralIn, m.R_yes(), m.R_no(), 50);
        uint256 p1 = (nrN1 * 10000) / (nrY1 + nrN1);

        _preApproveBuyer(m, user);
        vm.expectEmit(true, true, false, true);
        emit BinaryPredictionMarket.PositionBought(0, user, 1, collateralIn, bYShares, bYFee, p1);
        vm.expectEmit(true, false, true, true);
        emit BinaryPredictionMarket.FeeCollected(0, bYFee, treasuryAddr);
        vm.prank(user);
        m.buyYes(collateralIn, bYShares);

        (uint256 bNShares, uint256 bNFee, uint256 nrY2, uint256 nrN2,) = engine.quoteBuyNo(collateralIn, m.R_yes(), m.R_no(), 50);
        uint256 p2 = (nrY2 * 10000) / (nrY2 + nrN2);

        _preApproveBuyer(m, user);
        vm.expectEmit(true, true, false, true);
        emit BinaryPredictionMarket.PositionBought(0, user, 2, collateralIn, bNShares, bNFee, p2);
        vm.expectEmit(true, false, true, true);
        emit BinaryPredictionMarket.FeeCollected(0, bNFee, treasuryAddr);
        vm.prank(user);
        m.buyNo(collateralIn, bNShares);

        vm.expectEmit(true, false, true, true);
        emit BinaryPredictionMarket.MarketResolved(0, BinaryPredictionMarket.Outcome.Yes, resolver, "ev-final");
        vm.prank(resolver);
        m.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "ev-final");

        uint256 payout = m.yesShares(user);
        vm.expectEmit(true, true, false, true);
        emit BinaryPredictionMarket.RewardClaimed(0, user, payout);
        vm.prank(user);
        m.claim();

        assertEq(m.totalFeesCollected(), bYFee + bNFee);
        assertGt(usdt.balanceOf(treasuryAddr), 0);
    }

    // O2. Full path — cancel + refund + sweep
    function test_event_consistency_full_lifecycle_cancel_refund_sweep() public {
        BinaryPredictionMarket m = _createMarket(50);
        _buyYes(m, user, 50_000);
        _buyNo(m, user2, 30_000);

        vm.expectEmit(true, false, true, true);
        emit BinaryPredictionMarket.MarketResolved(0, BinaryPredictionMarket.Outcome.Cancelled, resolver, "ev-c2");
        vm.prank(resolver);
        m.cancel("r", "ev-c2");

        uint256 y1 = m.yesShares(user);
        uint256 n1 = m.noShares(user);
        uint256 rf1 = (y1 + n1) / 2;
        vm.expectEmit(true, true, false, true);
        emit BinaryPredictionMarket.RefundClaimed(0, user, y1, n1, rf1);
        vm.prank(user);
        m.refund();

        uint256 y2 = m.yesShares(user2);
        uint256 n2 = m.noShares(user2);
        uint256 rf2 = (y2 + n2) / 2;
        vm.expectEmit(true, true, false, true);
        emit BinaryPredictionMarket.RefundClaimed(0, user2, y2, n2, rf2);
        vm.prank(user2);
        m.refund();

        uint64 resolvedAt = m.resolvedAt();
        uint64 window = m.refundWindow();
        vm.warp(uint256(resolvedAt) + uint256(window) + 1);

        uint256 sweepAmount = usdt.balanceOf(address(m));
        vm.expectEmit(true, false, false, true);
        emit BinaryPredictionMarket.TreasuryRefundClaimed(0, sweepAmount);
        vm.prank(treasuryAddr);
        m.refundTreasury();

        assertEq(usdt.balanceOf(address(m)), 0);
    }

    // LiquidityInitialized
    function test_event_LiquidityInitialized_on_createMarket() public {
        MarketFactory.CreateMarketParams memory p = _validParams();
        usdt.approve(address(factory), p.initialCollateral);

        vm.expectEmit(false, false, false, false);
        emit BinaryPredictionMarket.LiquidityInitialized(1_000_000, 5000);
        factory.createMarket(p);
    }

    // ReservesUpdated on buy and sell
    function test_event_ReservesUpdated_on_buy_sell() public {
        BinaryPredictionMarket m = _createMarket(50);

        (,, uint256 r1Yes, uint256 r1No,) = engine.quoteBuyYes(50_000, m.R_yes(), m.R_no(), 50);
        _preApproveBuyer(m, user);
        vm.expectEmit(true, false, false, true);
        emit BinaryPredictionMarket.ReservesUpdated(0, r1Yes, r1No);
        vm.startPrank(user);
        (uint256 yShares,,) = m.quoteBuyYes(50_000);
        m.buyYes(50_000, yShares);
        vm.stopPrank();

        uint256 sharesIn = m.yesShares(user) / 4;
        (,, uint256 r2Yes, uint256 r2No,) = engine.quoteSellYes(sharesIn, m.R_yes(), m.R_no(), 50);
        vm.expectEmit(true, false, false, true);
        emit BinaryPredictionMarket.ReservesUpdated(0, r2Yes, r2No);
        vm.prank(user);
        m.sellYes(sharesIn, 0);
    }
}
