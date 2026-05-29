pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {MockUSDT} from "../src/tokens/MockUSDT.sol";
import {CPMMEngine} from "../src/pricing/CPMMEngine.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPredictionMarket} from "../src/market/BinaryPredictionMarket.sol";

contract FeeTreasuryAccountingSpec is Test {
    MockUSDT internal usdt;
    CPMMEngine internal engine;
    MarketFactory internal factory;

    address internal creator = address(this);
    address internal userA = address(0xBEEF);
    address internal userB = address(0xCAFE);
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

        usdt.mint(userA, 100_000_000_000);
        usdt.mint(userB, 100_000_000_000);
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

        usdt.mint(creator, p.initialCollateral);
        usdt.approve(address(factory), p.initialCollateral);

        (, address marketAddress) = factory.createMarket(p);
        m = BinaryPredictionMarket(marketAddress);
    }

    function _fundMarketExtra(BinaryPredictionMarket m, uint256 amount) internal {
        usdt.mint(creator, amount);
        usdt.transfer(address(m), amount);
    }

    function test_buyYes_fee_routes_and_accounting_matches_quote() public {
        BinaryPredictionMarket market = _createMarket(50);

        uint256 collateralIn = 50_000;
        (uint256 quoteSharesOut, uint256 quoteFee,) = market.quoteBuyYes(collateralIn);

        uint256 userBefore = usdt.balanceOf(userA);
        uint256 marketBefore = usdt.balanceOf(address(market));
        uint256 treasuryBefore = usdt.balanceOf(treasury);
        uint256 feesBefore = market.totalFeesCollected();

        vm.startPrank(userA);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, quoteSharesOut);
        vm.stopPrank();

        uint256 userPaid = userBefore - usdt.balanceOf(userA);
        uint256 marketIncrease = usdt.balanceOf(address(market)) - marketBefore;
        uint256 treasuryIncrease = usdt.balanceOf(treasury) - treasuryBefore;

        assertEq(market.yesShares(userA), quoteSharesOut);
        assertEq(userPaid, collateralIn);
        assertEq(treasuryIncrease, quoteFee);
        assertEq(marketIncrease, collateralIn - quoteFee);
        assertEq(market.totalFeesCollected() - feesBefore, quoteFee);
        assertEq(usdt.balanceOf(address(market)), 1_000_000 + collateralIn - quoteFee);
    }

    function test_buyNo_fee_routes_and_accounting_matches_quote() public {
        BinaryPredictionMarket market = _createMarket(50);

        uint256 collateralIn = 50_000;
        (uint256 quoteSharesOut, uint256 quoteFee,) = market.quoteBuyNo(collateralIn);

        uint256 userBefore = usdt.balanceOf(userA);
        uint256 marketBefore = usdt.balanceOf(address(market));
        uint256 treasuryBefore = usdt.balanceOf(treasury);
        uint256 feesBefore = market.totalFeesCollected();

        vm.startPrank(userA);
        usdt.approve(address(market), type(uint256).max);
        market.buyNo(collateralIn, quoteSharesOut);
        vm.stopPrank();

        uint256 userPaid = userBefore - usdt.balanceOf(userA);
        uint256 marketIncrease = usdt.balanceOf(address(market)) - marketBefore;
        uint256 treasuryIncrease = usdt.balanceOf(treasury) - treasuryBefore;

        assertEq(market.noShares(userA), quoteSharesOut);
        assertEq(userPaid, collateralIn);
        assertEq(treasuryIncrease, quoteFee);
        assertEq(marketIncrease, collateralIn - quoteFee);
        assertEq(market.totalFeesCollected() - feesBefore, quoteFee);
        assertEq(usdt.balanceOf(address(market)), 1_000_000 + collateralIn - quoteFee);
    }

    function test_sellYes_fee_routes_and_accounting_matches_quote() public {
        BinaryPredictionMarket market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        uint256 collateralIn = 80_000;
        (uint256 buySharesOut, uint256 buyFee,) = market.quoteBuyYes(collateralIn);

        vm.startPrank(userA);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, buySharesOut);
        vm.stopPrank();

        uint256 sharesIn = buySharesOut / 3;
        (uint256 quoteCollateralOut, uint256 quoteSellFee,) = market.quoteSellYes(sharesIn);

        uint256 userBefore = usdt.balanceOf(userA);
        uint256 marketBefore = usdt.balanceOf(address(market));
        uint256 treasuryBefore = usdt.balanceOf(treasury);
        uint256 feesBefore = market.totalFeesCollected();

        vm.prank(userA);
        market.sellYes(sharesIn, quoteCollateralOut);

        uint256 userReceived = usdt.balanceOf(userA) - userBefore;
        uint256 marketDecrease = marketBefore - usdt.balanceOf(address(market));
        uint256 treasuryIncrease = usdt.balanceOf(treasury) - treasuryBefore;

        assertEq(userReceived, quoteCollateralOut);
        assertEq(treasuryIncrease, quoteSellFee);
        assertEq(marketDecrease, quoteCollateralOut + quoteSellFee);
        assertEq(market.totalFeesCollected() - feesBefore, quoteSellFee);
        assertEq(market.totalFeesCollected(), buyFee + quoteSellFee);
        assertEq(market.yesShares(userA), buySharesOut - sharesIn);
    }

    function test_sellNo_fee_routes_and_accounting_matches_quote() public {
        BinaryPredictionMarket market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        uint256 collateralIn = 80_000;
        (uint256 buySharesOut, uint256 buyFee,) = market.quoteBuyNo(collateralIn);

        vm.startPrank(userA);
        usdt.approve(address(market), type(uint256).max);
        market.buyNo(collateralIn, buySharesOut);
        vm.stopPrank();

        uint256 sharesIn = buySharesOut / 3;
        (uint256 quoteCollateralOut, uint256 quoteSellFee,) = market.quoteSellNo(sharesIn);

        uint256 userBefore = usdt.balanceOf(userA);
        uint256 marketBefore = usdt.balanceOf(address(market));
        uint256 treasuryBefore = usdt.balanceOf(treasury);
        uint256 feesBefore = market.totalFeesCollected();

        vm.prank(userA);
        market.sellNo(sharesIn, quoteCollateralOut);

        uint256 userReceived = usdt.balanceOf(userA) - userBefore;
        uint256 marketDecrease = marketBefore - usdt.balanceOf(address(market));
        uint256 treasuryIncrease = usdt.balanceOf(treasury) - treasuryBefore;

        assertEq(userReceived, quoteCollateralOut);
        assertEq(treasuryIncrease, quoteSellFee);
        assertEq(marketDecrease, quoteCollateralOut + quoteSellFee);
        assertEq(market.totalFeesCollected() - feesBefore, quoteSellFee);
        assertEq(market.totalFeesCollected(), buyFee + quoteSellFee);
        assertEq(market.noShares(userA), buySharesOut - sharesIn);
    }

    function test_feeBps_zero_disables_fee_and_totalFeesCollected() public {
        BinaryPredictionMarket market = _createMarket(0);

        uint256 treasuryBefore = usdt.balanceOf(treasury);

        uint256 collateralIn = 50_000;
        (uint256 qYesOut, uint256 qYesFee,) = market.quoteBuyYes(collateralIn);
        (uint256 qNoOut, uint256 qNoFee,) = market.quoteBuyNo(collateralIn);

        assertEq(qYesFee, 0);
        assertEq(qNoFee, 0);

        vm.startPrank(userA);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, qYesOut);
        market.buyNo(collateralIn, qNoOut);
        vm.stopPrank();

        uint256 yesShares = market.yesShares(userA);
        uint256 noShares = market.noShares(userA);

        (uint256 qSellYesOut, uint256 qSellYesFee,) = market.quoteSellYes(yesShares / 3);
        (uint256 qSellNoOut, uint256 qSellNoFee,) = market.quoteSellNo(noShares / 3);

        assertEq(qSellYesFee, 0);
        assertEq(qSellNoFee, 0);

        vm.prank(userA);
        market.sellYes(yesShares / 3, qSellYesOut);
        vm.prank(userA);
        market.sellNo(noShares / 3, qSellNoOut);

        assertEq(market.totalFeesCollected(), 0);
        assertEq(usdt.balanceOf(treasury), treasuryBefore);
    }

    function test_feeBps_max_allows_trading_without_panic_and_nonzero_sharesOut() public {
        uint16 maxFeeBps = factory.systemMaxFeeBps();
        BinaryPredictionMarket market = _createMarket(maxFeeBps);

        uint256 collateralIn = 100_000;
        (uint256 sharesOut, uint256 fee,) = market.quoteBuyYes(collateralIn);

        assertGt(sharesOut, 0);

        vm.startPrank(userA);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, sharesOut);
        vm.stopPrank();

        assertGt(fee, 0);
        assertEq(market.totalFeesCollected(), fee);

        uint256 sharesIn = sharesOut / 4;
        (uint256 qOut,,) = market.quoteSellYes(sharesIn);

        vm.prank(userA);
        market.sellYes(sharesIn, qOut);
    }

    function test_feeBps_greater_than_max_reverts_by_current_rules() public {
        uint16 maxFeeBps = factory.systemMaxFeeBps();

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
            feeBps: uint16(maxFeeBps + 1)
        });

        usdt.mint(creator, p.initialCollateral);
        usdt.approve(address(factory), p.initialCollateral);

        vm.expectRevert(abi.encodeWithSelector(MarketFactory.InvalidFeeBps.selector, p.feeBps, maxFeeBps));
        factory.createMarket(p);
    }

    function test_sequence_invariants_fee_sum_equals_totalFees_and_treasury_delta() public {
        BinaryPredictionMarket market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        uint256 feesSum;
        uint256 treasuryBefore = usdt.balanceOf(treasury);

        {
            uint256 collateralIn = 60_000;
            (uint256 sharesOut, uint256 fee,) = market.quoteBuyYes(collateralIn);
            uint256 userBefore = usdt.balanceOf(userA);
            uint256 marketBefore = usdt.balanceOf(address(market));
            uint256 treasuryBeforeStep = usdt.balanceOf(treasury);

            vm.startPrank(userA);
            usdt.approve(address(market), type(uint256).max);
            market.buyYes(collateralIn, sharesOut);
            vm.stopPrank();

            uint256 userPaid = userBefore - usdt.balanceOf(userA);
            uint256 marketIncrease = usdt.balanceOf(address(market)) - marketBefore;
            uint256 treasuryIncrease = usdt.balanceOf(treasury) - treasuryBeforeStep;

            assertEq(userPaid, marketIncrease + treasuryIncrease);
            assertEq(treasuryIncrease, fee);
            feesSum += fee;
        }

        {
            uint256 collateralIn = 40_000;
            (uint256 sharesOut, uint256 fee,) = market.quoteBuyNo(collateralIn);
            uint256 userBefore = usdt.balanceOf(userB);
            uint256 marketBefore = usdt.balanceOf(address(market));
            uint256 treasuryBeforeStep = usdt.balanceOf(treasury);

            vm.startPrank(userB);
            usdt.approve(address(market), type(uint256).max);
            market.buyNo(collateralIn, sharesOut);
            vm.stopPrank();

            uint256 userPaid = userBefore - usdt.balanceOf(userB);
            uint256 marketIncrease = usdt.balanceOf(address(market)) - marketBefore;
            uint256 treasuryIncrease = usdt.balanceOf(treasury) - treasuryBeforeStep;

            assertEq(userPaid, marketIncrease + treasuryIncrease);
            assertEq(treasuryIncrease, fee);
            feesSum += fee;
        }

        {
            uint256 sharesIn = market.yesShares(userA) / 3;
            (uint256 collateralOut, uint256 fee,) = market.quoteSellYes(sharesIn);
            uint256 userBefore = usdt.balanceOf(userA);
            uint256 marketBefore = usdt.balanceOf(address(market));
            uint256 treasuryBeforeStep = usdt.balanceOf(treasury);

            vm.prank(userA);
            market.sellYes(sharesIn, collateralOut);

            uint256 userReceived = usdt.balanceOf(userA) - userBefore;
            uint256 marketDecrease = marketBefore - usdt.balanceOf(address(market));
            uint256 treasuryIncrease = usdt.balanceOf(treasury) - treasuryBeforeStep;

            assertEq(marketDecrease, userReceived + treasuryIncrease);
            assertEq(treasuryIncrease, fee);
            feesSum += fee;
        }

        {
            uint256 sharesIn = market.noShares(userB) / 3;
            (uint256 collateralOut, uint256 fee,) = market.quoteSellNo(sharesIn);
            uint256 userBefore = usdt.balanceOf(userB);
            uint256 marketBefore = usdt.balanceOf(address(market));
            uint256 treasuryBeforeStep = usdt.balanceOf(treasury);

            vm.prank(userB);
            market.sellNo(sharesIn, collateralOut);

            uint256 userReceived = usdt.balanceOf(userB) - userBefore;
            uint256 marketDecrease = marketBefore - usdt.balanceOf(address(market));
            uint256 treasuryIncrease = usdt.balanceOf(treasury) - treasuryBeforeStep;

            assertEq(marketDecrease, userReceived + treasuryIncrease);
            assertEq(treasuryIncrease, fee);
            feesSum += fee;
        }

        assertEq(market.totalFeesCollected(), feesSum);
        assertEq(usdt.balanceOf(treasury) - treasuryBefore, feesSum);
    }

    function test_claim_does_not_affect_treasury_or_totalFeesCollected_after_fee_trading() public {
        BinaryPredictionMarket market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        uint256 collateralInYes = 90_000;
        uint256 collateralInNo = 40_000;
        (uint256 yesSharesOut,,) = market.quoteBuyYes(collateralInYes);
        (uint256 noSharesOut,,) = market.quoteBuyNo(collateralInNo);

        vm.startPrank(userA);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralInYes, yesSharesOut);
        vm.stopPrank();

        vm.startPrank(userB);
        usdt.approve(address(market), type(uint256).max);
        market.buyNo(collateralInNo, noSharesOut);
        vm.stopPrank();

        uint256 feesBefore = market.totalFeesCollected();
        uint256 treasuryBefore = usdt.balanceOf(treasury);
        uint256 userBefore = usdt.balanceOf(userA);
        uint256 marketBefore = usdt.balanceOf(address(market));

        vm.prank(resolver);
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "ipfs://yes");

        vm.prank(userA);
        market.claim();

        uint256 userReceived = usdt.balanceOf(userA) - userBefore;
        uint256 marketDecrease = marketBefore - usdt.balanceOf(address(market));
        uint256 treasuryDelta = usdt.balanceOf(treasury) - treasuryBefore;

        assertEq(userReceived, marketDecrease);
        assertEq(treasuryDelta, 0);
        assertEq(market.totalFeesCollected(), feesBefore);
    }

    function test_refund_dust_sweep_increases_treasury_but_totalFeesCollected_tracks_only_trading_fee() public {
        BinaryPredictionMarket market = _createMarket(50);
        _fundMarketExtra(market, 1_000_000);

        uint256 collateralIn = 99_999;
        (uint256 sharesOut, uint256 tradingFee,) = market.quoteBuyYes(collateralIn);

        vm.startPrank(userA);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, sharesOut);
        vm.stopPrank();

        assertEq(market.totalFeesCollected(), tradingFee);

        uint256 feesBeforeRefund = market.totalFeesCollected();
        uint256 treasuryBeforeCancel = usdt.balanceOf(treasury);

        vm.prank(resolver);
        market.cancel("r", "ipfs://e");

        uint256 userYes = market.yesShares(userA);
        uint256 userNo = market.noShares(userA);
        uint256 userRefund = (userYes + userNo) / 2;

        vm.prank(userA);
        market.refund();

        assertEq(market.totalFeesCollected(), feesBeforeRefund);
        assertEq(usdt.balanceOf(treasury), treasuryBeforeCancel);

        uint64 resolvedAt = market.resolvedAt();
        uint64 window = market.refundWindow();
        vm.warp(uint256(resolvedAt) + uint256(window) + 1);

        uint256 marketBalBeforeSweep = usdt.balanceOf(address(market));
        uint256 treasuryBeforeSweep = usdt.balanceOf(treasury);

        vm.prank(treasury);
        market.refundTreasury();

        uint256 sweepDelta = usdt.balanceOf(treasury) - treasuryBeforeSweep;
        assertEq(sweepDelta, marketBalBeforeSweep);
        assertEq(usdt.balanceOf(address(market)), 0);

        assertEq(market.totalFeesCollected(), feesBeforeRefund);
        assertEq(market.totalFeesCollected(), tradingFee);

        assertGt(userRefund, 0);
        assertGt(sweepDelta, 0);
    }
}
