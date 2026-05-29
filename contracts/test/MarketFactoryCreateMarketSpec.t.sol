// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {MockUSDT} from "../src/tokens/MockUSDT.sol";
import {CPMMEngine} from "../src/pricing/CPMMEngine.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPredictionMarket} from "../src/market/BinaryPredictionMarket.sol";

contract MarketFactoryCreateMarketSpec is Test {
    MockUSDT internal usdt;
    CPMMEngine internal engine;
    MarketFactory internal factory;

    address internal creator = address(this);
    address internal user = address(0xBEEF);
    address internal resolver = address(0xA11CE);
    address internal treasury = address(0x7E57);
    address internal feeRouter = address(0xFEE);

    uint256 internal constant INITIAL_COLLATERAL = 1_000_000;

    function setUp() public {
        usdt = new MockUSDT();
        engine = new CPMMEngine();

        factory = new MarketFactory(
            500,
            1000,
            1000,
            INITIAL_COLLATERAL,
            3000,
            7000,
            resolver,
            feeRouter,
            treasury
        );
        factory.setCollateralAllowed(address(usdt), true);
        factory.setAmmEngine(address(engine));

        usdt.mint(user, 100_000_000_000);
    }

    function test_createMarket_transfersInitialCollateral_andMaintainsSolvency() public {
        BinaryPredictionMarket market = _createMarket(INITIAL_COLLATERAL, 5000);

        assertEq(usdt.balanceOf(address(market)), INITIAL_COLLATERAL);
        assertEq(market.collateralLocked(), INITIAL_COLLATERAL);
        assertGe(usdt.balanceOf(address(market)), market.collateralLocked());
    }

    function test_createMarket_initializesSupplyAndReserves() public {
        BinaryPredictionMarket market = _createMarket(INITIAL_COLLATERAL, 5000);

        assertEq(market.pairSupply(), INITIAL_COLLATERAL);
        assertEq(market.totalYesSupply(), INITIAL_COLLATERAL);
        assertEq(market.totalNoSupply(), INITIAL_COLLATERAL);

        assertEq(market.R_yes() + market.treasuryYes() + market.totalUserYesShares(), market.totalYesSupply());
        assertEq(market.R_no() + market.treasuryNo() + market.totalUserNoShares(), market.totalNoSupply());
    }

    function test_createMarket_revertsAtomically_whenTransferFromFails() public {
        usdt.mint(creator, INITIAL_COLLATERAL);

        vm.expectRevert();
        factory.createMarket(_marketParams(address(usdt), INITIAL_COLLATERAL, 5000));

        assertEq(factory.nextMarketId(), 0);
        assertEq(factory.markets(0), address(0));
    }

    function test_createMarket_reverts_whenInitialCollateralIsZero() public {
        vm.expectRevert(MarketFactory.ZeroInitialCollateral.selector);
        factory.createMarket(_marketParams(address(usdt), 0, 5000));
    }

    function test_createMarket_reverts_whenCollateralIsZeroAddress() public {
        vm.expectRevert(MarketFactory.ZeroCollateralAddress.selector);
        factory.createMarket(_marketParams(address(0), INITIAL_COLLATERAL, 5000));
    }

    function test_createMarket_preservesBuyYesQuoteExecuteConsistency() public {
        BinaryPredictionMarket market = _createMarket(INITIAL_COLLATERAL, 5000);

        uint256 collateralIn = 50_000;
        (uint256 quoteSharesOut, uint256 quoteFee,) = market.quoteBuyYes(collateralIn);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, quoteSharesOut);
        vm.stopPrank();

        assertEq(market.yesShares(user), quoteSharesOut);
        assertEq(market.totalUserYesShares(), quoteSharesOut);
        assertEq(market.totalFeesCollected(), quoteFee);
        assertEq(usdt.balanceOf(treasury), quoteFee);
        assertEq(usdt.balanceOf(address(market)), INITIAL_COLLATERAL + collateralIn - quoteFee);
    }

    function test_createMarket_preservesBuyNoQuoteExecuteConsistency() public {
        BinaryPredictionMarket market = _createMarket(INITIAL_COLLATERAL, 5000);

        uint256 collateralIn = 50_000;
        (uint256 quoteSharesOut, uint256 quoteFee,) = market.quoteBuyNo(collateralIn);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyNo(collateralIn, quoteSharesOut);
        vm.stopPrank();

        assertEq(market.noShares(user), quoteSharesOut);
        assertEq(market.totalUserNoShares(), quoteSharesOut);
        assertEq(market.totalFeesCollected(), quoteFee);
        assertEq(usdt.balanceOf(treasury), quoteFee);
        assertEq(usdt.balanceOf(address(market)), INITIAL_COLLATERAL + collateralIn - quoteFee);
    }

    function test_createMarket_autoWiresAmmEngine() public {
        BinaryPredictionMarket market = _createMarket(INITIAL_COLLATERAL, 5000);

        assertEq(address(market.ammEngine()), address(engine));
    }

    function test_createMarket_autoSetsMarketId() public {
        (, address marketAddress) = _createMarketRaw(INITIAL_COLLATERAL, 5000);
        BinaryPredictionMarket market = BinaryPredictionMarket(marketAddress);

        assertEq(market.marketId(), 0);

        (, address secondMarketAddress) = _createMarketRaw(INITIAL_COLLATERAL, 5000);
        BinaryPredictionMarket secondMarket = BinaryPredictionMarket(secondMarketAddress);

        assertEq(secondMarket.marketId(), 1);
    }

    function test_createMarket_reverts_whenAmmEngineNotSet() public {
        MarketFactory unconfiguredFactory = new MarketFactory(
            500,
            1000,
            1000,
            INITIAL_COLLATERAL,
            3000,
            7000,
            resolver,
            feeRouter,
            treasury
        );
        unconfiguredFactory.setCollateralAllowed(address(usdt), true);
        usdt.mint(creator, INITIAL_COLLATERAL);
        usdt.approve(address(unconfiguredFactory), INITIAL_COLLATERAL);

        vm.expectRevert("engine not set");
        unconfiguredFactory.createMarket(_marketParams(address(usdt), INITIAL_COLLATERAL, 5000));
    }

    function test_createMarket_allowsTradingWithoutManualWiring() public {
        BinaryPredictionMarket market = _createMarket(INITIAL_COLLATERAL, 5000);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(10_000, 1);
        market.buyNo(10_000, 1);
        market.sellYes(1_000, 1);
        market.sellNo(1_000, 1);
        vm.stopPrank();

        assertGt(market.totalFeesCollected(), 0);
        assertGt(market.yesShares(user), 0);
        assertGt(market.noShares(user), 0);
    }

    function _createMarket(uint256 initialCollateral, uint16 initialPriceYesBps)
        internal
        returns (BinaryPredictionMarket)
    {
        (, address marketAddress) = _createMarketRaw(initialCollateral, initialPriceYesBps);
        return BinaryPredictionMarket(marketAddress);
    }

    function _createMarketRaw(uint256 initialCollateral, uint16 initialPriceYesBps)
        internal
        returns (uint256 marketId, address marketAddress)
    {
        usdt.mint(creator, initialCollateral);
        usdt.approve(address(factory), initialCollateral);

        return factory.createMarket(_marketParams(address(usdt), initialCollateral, initialPriceYesBps));
    }

    function _marketParams(address collateral, uint256 initialCollateral, uint16 initialPriceYesBps)
        internal
        view
        returns (MarketFactory.CreateMarketParams memory)
    {
        return MarketFactory.CreateMarketParams({
            question: "BTC>100k?",
            metadataURI: "ipfs://rule",
            collateral: collateral,
            startTime: uint64(block.timestamp),
            endTime: uint64(block.timestamp + 7 days),
            initialCollateral: initialCollateral,
            initialPriceYesBps: initialPriceYesBps,
            minTradeAmount: 1,
            maxTradeAmount: 100_000,
            maxSlippageBps: 500,
            feeBps: 50
        });
    }
}
