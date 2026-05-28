// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockUSDT} from "../src/tokens/MockUSDT.sol";
import {CPMMEngine} from "../src/pricing/CPMMEngine.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPredictionMarket} from "../src/market/BinaryPredictionMarket.sol";

contract NonERC20 {}

contract MarketFactoryParamSpec is Test {
    MockUSDT internal usdt;
    CPMMEngine internal engine;
    MarketFactory internal factory;

    address internal creator = address(this);
    address internal resolver = address(0xA11CE);
    address internal treasury = address(0x7E57);
    address internal feeRouter = address(0xFEE);

    uint256 internal constant MIN_INITIAL_COLLATERAL = 1_000_000;
    uint16 internal constant MIN_PRICE_BPS = 3000;
    uint16 internal constant MAX_PRICE_BPS = 7000;
    uint16 internal constant MAX_FEE_BPS = 500;
    uint16 internal constant MAX_SLIPPAGE_BPS = 1000;
    uint16 internal constant TRADE_CAP_BPS = 1000;

    function setUp() public {
        usdt = new MockUSDT();
        engine = new CPMMEngine();

        factory = new MarketFactory(
            MAX_FEE_BPS,
            MAX_SLIPPAGE_BPS,
            TRADE_CAP_BPS,
            MIN_INITIAL_COLLATERAL,
            MIN_PRICE_BPS,
            MAX_PRICE_BPS,
            resolver,
            feeRouter,
            treasury
        );
        factory.setCollateralAllowed(address(usdt), true);
        
        usdt.mint(creator, MIN_INITIAL_COLLATERAL * 10);
        usdt.approve(address(factory), type(uint256).max);
    }

    function _validParams() internal view returns (MarketFactory.CreateMarketParams memory) {
        return MarketFactory.CreateMarketParams({
            question: "Valid Question",
            metadataURI: "ipfs://valid",
            collateral: address(usdt),
            startTime: uint64(block.timestamp + 1),
            endTime: uint64(block.timestamp + 7 days),
            initialCollateral: MIN_INITIAL_COLLATERAL,
            initialPriceYesBps: 5000,
            minTradeAmount: 1,
            maxTradeAmount: 100_000,
            maxSlippageBps: 500,
            feeBps: 50
        });
    }

    // 1. Collateral param
    function test_revertsWhen_collateralIsZeroAddress() public {
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.collateral = address(0);
        vm.expectRevert(MarketFactory.ZeroCollateralAddress.selector);
        factory.createMarket(p);
    }

    function test_revertsWhen_collateralNotWhitelisted() public {
        MockUSDT unapprovedToken = new MockUSDT();
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.collateral = address(unapprovedToken);
        vm.expectRevert(abi.encodeWithSelector(MarketFactory.CollateralNotWhitelisted.selector, address(unapprovedToken)));
        factory.createMarket(p);
    }

    function test_revertsWhen_collateralIsEOA() public {
        address eoa = address(0xBEEF);
        factory.setCollateralAllowed(eoa, true);
        
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.collateral = eoa;
        
        vm.expectRevert(); // Call to non-contract / SafeERC20 revert
        factory.createMarket(p);
    }

    function test_revertsWhen_collateralIsNonERC20Contract() public {
        NonERC20 nonErc20 = new NonERC20();
        factory.setCollateralAllowed(address(nonErc20), true);
        
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.collateral = address(nonErc20);
        
        vm.expectRevert(); // SafeERC20 revert due to missing transferFrom
        factory.createMarket(p);
    }

    // 2. InitialCollateral param
    function test_revertsWhen_initialCollateralIsZero() public {
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.initialCollateral = 0;
        vm.expectRevert(MarketFactory.ZeroInitialCollateral.selector);
        factory.createMarket(p);
    }

    function test_revertsWhen_initialCollateralLessThanMin() public {
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.initialCollateral = MIN_INITIAL_COLLATERAL - 1;
        vm.expectRevert(abi.encodeWithSelector(MarketFactory.InsufficientLiquidity.selector, p.initialCollateral, MIN_INITIAL_COLLATERAL));
        factory.createMarket(p);
    }

    // 3. InitialPriceYesBps param
    function test_revertsWhen_initialPriceYesBpsIsZero() public {
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.initialPriceYesBps = 0;
        vm.expectRevert(abi.encodeWithSelector(MarketFactory.InvalidPriceBps.selector, 0, MIN_PRICE_BPS, MAX_PRICE_BPS));
        factory.createMarket(p);
    }

    function test_revertsWhen_initialPriceYesBpsIs10000() public {
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.initialPriceYesBps = 10000;
        vm.expectRevert(abi.encodeWithSelector(MarketFactory.InvalidPriceBps.selector, 10000, MIN_PRICE_BPS, MAX_PRICE_BPS));
        factory.createMarket(p);
    }

    function test_revertsWhen_initialPriceYesBpsGreaterThan10000() public {
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.initialPriceYesBps = 10001;
        vm.expectRevert(abi.encodeWithSelector(MarketFactory.InvalidPriceBps.selector, 10001, MIN_PRICE_BPS, MAX_PRICE_BPS));
        factory.createMarket(p);
    }

    // 4. Fee and Slippage params
    function test_revertsWhen_feeBpsGreaterThanMax() public {
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.feeBps = MAX_FEE_BPS + 1;
        vm.expectRevert(abi.encodeWithSelector(MarketFactory.InvalidFeeBps.selector, p.feeBps, MAX_FEE_BPS));
        factory.createMarket(p);
    }

    function test_revertsWhen_maxSlippageBpsGreaterThanMax() public {
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.maxSlippageBps = MAX_SLIPPAGE_BPS + 1;
        vm.expectRevert(bytes("slippage exceeds max"));
        factory.createMarket(p);
    }

    function test_revertsWhen_maxTradeAmountExceedsCap() public {
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.maxTradeAmount = (p.initialCollateral * TRADE_CAP_BPS / 10000) + 1;
        vm.expectRevert(abi.encodeWithSelector(MarketFactory.TradeLimitExceeded.selector, p.maxTradeAmount, p.initialCollateral));
        factory.createMarket(p);
    }

    // 5. Time params
    function test_revertsWhen_startTimeGreaterThanOrEqualEndTime() public {
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.startTime = p.endTime;
        vm.expectRevert(bytes("invalid time range"));
        factory.createMarket(p);
        
        p.startTime = p.endTime + 1;
        vm.expectRevert(bytes("invalid time range"));
        factory.createMarket(p);
    }

    function test_revertsWhen_startTimeIsZero() public {
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.startTime = 0;
        vm.expectRevert(bytes("startTime zero"));
        factory.createMarket(p);
    }

    // 6. Text params
    function test_revertsWhen_questionIsEmpty() public {
        MarketFactory.CreateMarketParams memory p = _validParams();
        p.question = "";
        vm.expectRevert(bytes("empty question"));
        factory.createMarket(p);
    }

    // 7. Registry & Event checks
    function test_createMarket_incrementsMarketIdAndWritesRegistry() public {
        MarketFactory.CreateMarketParams memory p = _validParams();
        uint256 expectedId = factory.nextMarketId();
        
        vm.expectEmit(true, false, true, true);
        emit MarketFactory.MarketCreated(
            expectedId, address(0), creator,
            p.question, p.collateral, p.startTime, p.endTime, p.initialCollateral, p.initialPriceYesBps
        );
        
        (uint256 marketId, address marketAddr) = factory.createMarket(p);
        
        assertEq(marketId, expectedId);
        assertEq(factory.nextMarketId(), expectedId + 1);
        assertEq(factory.markets(marketId), marketAddr);
        assertEq(factory.getMarket(marketId), marketAddr);
    }
}
