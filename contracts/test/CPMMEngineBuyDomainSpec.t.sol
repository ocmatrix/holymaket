// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockUSDT} from "../src/tokens/MockUSDT.sol";
import {CPMMEngine} from "../src/pricing/CPMMEngine.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPredictionMarket} from "../src/market/BinaryPredictionMarket.sol";

contract CPMMEngineBuyDomainSpec is Test {
    MockUSDT internal usdt;
    CPMMEngine internal engine;
    MarketFactory internal factory;

    address internal creator = address(this);
    address internal resolver = address(0xA11CE);
    address internal treasury = address(0x7E57);
    address internal feeRouter = address(0xFEE);
    address internal trader = address(0xBEEF);

    function setUp() public {
        usdt = new MockUSDT();
        engine = new CPMMEngine();

        factory = new MarketFactory(
            500,
            1000,
            10000, // tradeCapBps = 100% for testing large trades
            1_000_000,
            100,
            9900,
            resolver,
            feeRouter,
            treasury
        );
        factory.setCollateralAllowed(address(usdt), true);
        factory.setAmmEngine(address(engine));

        usdt.mint(creator, 100_000_000 * 10**6);
        usdt.mint(trader, 100_000_000 * 10**6);
    }

    function _createMarket(uint256 initialCollateral, uint16 initialPriceYesBps) internal returns (BinaryPredictionMarket market) {
        MarketFactory.CreateMarketParams memory p = MarketFactory.CreateMarketParams({
            question: "BTC>100k?",
            metadataURI: "ipfs://rule",
            collateral: address(usdt),
            startTime: uint64(block.timestamp),
            endTime: uint64(block.timestamp + 7 days),
            initialCollateral: initialCollateral,
            initialPriceYesBps: initialPriceYesBps,
            minTradeAmount: 1,
            maxTradeAmount: initialCollateral, // max allowed by tradeCapBps=10000
            maxSlippageBps: 1000, // max slippage
            feeBps: 0
        });

        usdt.approve(address(factory), p.initialCollateral);
        (, address marketAddress) = factory.createMarket(p);
        market = BinaryPredictionMarket(marketAddress);
    }

    // A & B: quoteBuyYes and quoteBuyNo base domains
    function test_quoteBuyYes_reverts_on_zero_input() public {
        vm.expectRevert("zero input");
        engine.quoteBuyYes(0, 1000, 1000, 0);
    }

    function test_quoteBuyNo_reverts_on_zero_input() public {
        vm.expectRevert("zero input");
        engine.quoteBuyNo(0, 1000, 1000, 0);
    }

    function test_quoteBuy_reverts_on_empty_pool() public {
        vm.expectRevert("empty pool");
        engine.quoteBuyYes(100, 0, 1000, 0);

        vm.expectRevert("empty pool");
        engine.quoteBuyNo(100, 1000, 0, 0);
    }

    function test_quoteBuyYes_small_and_normal_input() public {
        (uint256 sharesOut, uint256 fee, uint256 newRYes, uint256 newRNo, ) = engine.quoteBuyYes(1, 10000, 10000, 0);
        assertGe(sharesOut, 0);
        assertEq(fee, 0);
        assertEq(newRNo, 10001);
        assertLe(newRYes, 10000);

        (sharesOut, fee, newRYes, newRNo, ) = engine.quoteBuyYes(5000, 10000, 10000, 0);
        assertGt(sharesOut, 0);
        assertEq(newRNo, 15000);
    }

    function test_quoteBuyNo_small_and_normal_input() public {
        (uint256 sharesOut, uint256 fee, uint256 newRYes, uint256 newRNo, ) = engine.quoteBuyNo(1, 10000, 10000, 0);
        assertGe(sharesOut, 0);
        assertEq(fee, 0);
        assertEq(newRYes, 10001);
        assertLe(newRNo, 10000);

        (sharesOut, fee, newRYes, newRNo, ) = engine.quoteBuyNo(5000, 10000, 10000, 0);
        assertGt(sharesOut, 0);
        assertEq(newRYes, 15000);
    }

    // C. sharesOut monotonicity
    function testFuzz_sharesOut_monotonicity_buyYes(uint256 in1, uint256 in2) public {
        in1 = bound(in1, 1, 10_000_000);
        in2 = bound(in2, 1, 10_000_000);
        if (in1 > in2) {
            uint256 temp = in1;
            in1 = in2;
            in2 = temp;
        }
        
        (uint256 shares1, , , ,) = engine.quoteBuyYes(in1, 1_000_000, 1_000_000, 0);
        (uint256 shares2, , , ,) = engine.quoteBuyYes(in2, 1_000_000, 1_000_000, 0);

        assertLe(shares1, shares2);
    }

    function testFuzz_sharesOut_monotonicity_buyNo(uint256 in1, uint256 in2) public {
        in1 = bound(in1, 1, 10_000_000);
        in2 = bound(in2, 1, 10_000_000);
        if (in1 > in2) {
            uint256 temp = in1;
            in1 = in2;
            in2 = temp;
        }
        
        (uint256 shares1, , , ,) = engine.quoteBuyNo(in1, 1_000_000, 1_000_000, 0);
        (uint256 shares2, , , ,) = engine.quoteBuyNo(in2, 1_000_000, 1_000_000, 0);

        assertLe(shares1, shares2);
    }

    // D. non-negative output
    function testFuzz_buyYes_nonNegative(uint256 collateralIn, uint256 rYes, uint256 rNo) public {
        collateralIn = bound(collateralIn, 1, 1e18);
        rYes = bound(rYes, 1, 1e18);
        rNo = bound(rNo, 1, 1e18);
        
        uint256 k = rYes * rNo;
        uint256 newRNo = rNo + collateralIn;
        if (k / newRNo == 0) return;

        (uint256 sharesOut, , , ,) = engine.quoteBuyYes(collateralIn, rYes, rNo, 0);
        // sharesOut is uint256, so if it underflowed it would be huge, 
        // but let's check it's bounded reasonably (less than collateralIn * 2 + something, actually just >= collateralIn)
        assertGe(sharesOut, collateralIn); // because net + deltaYes, net is collateralIn - fee. fee=0. deltaYes >= 0
    }

    function testFuzz_buyNo_nonNegative(uint256 collateralIn, uint256 rYes, uint256 rNo) public {
        collateralIn = bound(collateralIn, 1, 1e18);
        rYes = bound(rYes, 1, 1e18);
        rNo = bound(rNo, 1, 1e18);
        
        uint256 k = rYes * rNo;
        uint256 newRYes = rYes + collateralIn;
        if (k / newRYes == 0) return;

        (uint256 sharesOut, , , ,) = engine.quoteBuyNo(collateralIn, rYes, rNo, 0);
        assertGe(sharesOut, collateralIn);
    }

    // E, G. no capacity overflow / extremely large orders
    function test_quoteBuy_extreme_large_orders_reverts_or_succeeds_without_overflow() public {
        uint256 hugeInput = type(uint128).max;
        
        vm.expectRevert("AMM depleted");
        engine.quoteBuyYes(hugeInput, 1000, 1000, 0);

        vm.expectRevert("AMM depleted");
        engine.quoteBuyNo(hugeInput, 1000, 1000, 0);
    }

    // H. symmetry
    function testFuzz_quoteBuy_symmetry(uint256 collateralIn, uint256 reserve) public {
        collateralIn = bound(collateralIn, 1, 1e12);
        reserve = bound(reserve, 1, 1e12);

        uint256 k = reserve * reserve;
        uint256 newR = reserve + collateralIn;
        if (k / newR == 0) return;

        (uint256 sharesOutYes, , uint256 newRYesYes, uint256 newRNoYes, ) = engine.quoteBuyYes(collateralIn, reserve, reserve, 0);
        (uint256 sharesOutNo, , uint256 newRYesNo, uint256 newRNoNo, ) = engine.quoteBuyNo(collateralIn, reserve, reserve, 0);

        assertEq(sharesOutYes, sharesOutNo);
        assertEq(newRYesYes, newRNoNo);
        assertEq(newRNoYes, newRYesNo);
    }

    // I. quote consistency with buy execution
    function testFuzz_quote_execution_consistency_buyYes(uint256 collateralIn) public {
        collateralIn = bound(collateralIn, 1, 1_000_000);
        BinaryPredictionMarket m = _createMarket(1_000_000, 5000);
        
        (uint256 quoteSharesOut, , ) = m.quoteBuyYes(collateralIn);

        vm.startPrank(trader);
        usdt.approve(address(m), type(uint256).max);
        m.buyYes(collateralIn, 0);
        vm.stopPrank();

        uint256 actualSharesOut = m.yesShares(trader);
        assertEq(actualSharesOut, quoteSharesOut);
    }

    function testFuzz_quote_execution_consistency_buyNo(uint256 collateralIn) public {
        collateralIn = bound(collateralIn, 1, 1_000_000);
        BinaryPredictionMarket m = _createMarket(1_000_000, 5000);
        
        (uint256 quoteSharesOut, , ) = m.quoteBuyNo(collateralIn);

        vm.startPrank(trader);
        usdt.approve(address(m), type(uint256).max);
        m.buyNo(collateralIn, 0);
        vm.stopPrank();

        uint256 actualSharesOut = m.noShares(trader);
        assertEq(actualSharesOut, quoteSharesOut);
    }

    // J. sequential buy path
    function test_sequential_buyYes_price_increases() public {
        BinaryPredictionMarket m = _createMarket(1_000_000, 5000);

        (uint256 pYes1, ) = m.getPrices();

        vm.startPrank(trader);
        usdt.approve(address(m), type(uint256).max);
        
        m.buyYes(100_000, 0);
        (uint256 pYes2, ) = m.getPrices();
        assertGt(pYes2, pYes1);

        m.buyYes(100_000, 0);
        (uint256 pYes3, ) = m.getPrices();
        assertGt(pYes3, pYes2);

        m.buyYes(100_000, 0);
        (uint256 pYes4, ) = m.getPrices();
        assertGt(pYes4, pYes3);
        
        vm.stopPrank();
    }

    function test_sequential_buyNo_price_increases() public {
        BinaryPredictionMarket m = _createMarket(1_000_000, 5000);

        (, uint256 pNo1) = m.getPrices();

        vm.startPrank(trader);
        usdt.approve(address(m), type(uint256).max);
        
        m.buyNo(100_000, 0);
        (, uint256 pNo2) = m.getPrices();
        assertGt(pNo2, pNo1);

        m.buyNo(100_000, 0);
        (, uint256 pNo3) = m.getPrices();
        assertGt(pNo3, pNo2);

        m.buyNo(100_000, 0);
        (, uint256 pNo4) = m.getPrices();
        assertGt(pNo4, pNo3);
        
        vm.stopPrank();
    }

    // K. extreme pool states
    function test_quoteBuy_extreme_pool_states() public {
        uint256 hugeR = 1_000_000_000 * 10**6;
        uint256 tinyR = 1;

        // Yes tiny, No huge
        vm.expectRevert("AMM depleted");
        engine.quoteBuyYes(100_000, tinyR, hugeR, 0);
        
        (uint256 sharesOut2, , , ,) = engine.quoteBuyNo(100_000, tinyR, hugeR, 0);
        assertGe(sharesOut2, 100_000);

        // Yes huge, No tiny
        (uint256 sharesOut3, , , ,) = engine.quoteBuyYes(100_000, hugeR, tinyR, 0);
        assertGe(sharesOut3, 100_000);
        
        vm.expectRevert("AMM depleted");
        engine.quoteBuyNo(100_000, hugeR, tinyR, 0);
    }
}
