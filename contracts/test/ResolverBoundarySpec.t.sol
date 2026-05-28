// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockUSDT} from "../src/tokens/MockUSDT.sol";
import {CPMMEngine} from "../src/pricing/CPMMEngine.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPredictionMarket} from "../src/market/BinaryPredictionMarket.sol";

contract ResolverBoundarySpec is Test {
    MockUSDT internal usdt;
    CPMMEngine internal engine;
    MarketFactory internal factory;
    BinaryPredictionMarket internal market;

    address internal creator = address(0x1111);
    address internal resolver = address(0xA11CE);
    address internal treasury = address(0x7E57);
    address internal feeRouter = address(0xFEE);
    address internal unauthorized = address(0xBAD);

    function setUp() public {
        usdt = new MockUSDT();
        engine = new CPMMEngine();

        factory = new MarketFactory(
            500, 1000, 1000, 1_000_000, 3000, 7000,
            resolver, feeRouter, treasury
        );
        factory.setCollateralAllowed(address(usdt), true);
        
        usdt.mint(creator, 1_000_000 * 10);
        
        factory.grantRole(factory.MARKET_CREATOR_ROLE(), creator);

        vm.startPrank(creator);
        usdt.approve(address(factory), type(uint256).max);
        MarketFactory.CreateMarketParams memory p = MarketFactory.CreateMarketParams({
            question: "Q?", metadataURI: "URI", collateral: address(usdt),
            startTime: uint64(block.timestamp + 10), endTime: uint64(block.timestamp + 100),
            initialCollateral: 1_000_000, initialPriceYesBps: 5000,
            minTradeAmount: 1, maxTradeAmount: 100_000, maxSlippageBps: 500, feeBps: 50
        });
        (, address marketAddr) = factory.createMarket(p);
        vm.stopPrank();
        
        market = BinaryPredictionMarket(marketAddr);
        vm.prank(address(factory));
        market.setAmmEngine(address(engine));
    }

    // 1. Resolve Permissions
    function test_resolve_revertsWhen_unauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert(bytes("not resolver"));
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "URI");
    }

    function test_resolve_revertsWhen_creator() public {
        vm.prank(creator);
        vm.expectRevert(bytes("not resolver"));
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "URI");
    }

    function test_resolve_succeedsWhen_resolver() public {
        vm.prank(resolver);
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "URI");
        assertEq(uint(market.status()), uint(BinaryPredictionMarket.MarketStatus.Resolved));
        assertEq(uint(market.outcome()), uint(BinaryPredictionMarket.Outcome.Yes));
    }

    // 2. Cancel Permissions
    function test_cancel_revertsWhen_unauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert(bytes("not resolver"));
        market.cancel("reason", "URI");
    }

    function test_cancel_succeedsWhen_resolver() public {
        vm.prank(resolver);
        market.cancel("reason", "URI");
        assertEq(uint(market.status()), uint(BinaryPredictionMarket.MarketStatus.Cancelled));
        assertEq(uint(market.outcome()), uint(BinaryPredictionMarket.Outcome.Cancelled));
    }

    // 3. MarkInvalid Permissions
    function test_markInvalid_revertsWhen_unauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert(bytes("not resolver"));
        market.markInvalid("reason", "URI");
    }

    function test_markInvalid_succeedsWhen_resolver() public {
        vm.prank(resolver);
        market.markInvalid("reason", "URI");
        assertEq(uint(market.status()), uint(BinaryPredictionMarket.MarketStatus.Invalid));
        assertEq(uint(market.outcome()), uint(BinaryPredictionMarket.Outcome.Invalid));
    }

    // 4. State Machine Transitions
    function test_resolve_revertsWhen_alreadyResolved() public {
        vm.startPrank(resolver);
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "URI");
        vm.expectRevert(bytes("not active"));
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.No, "URI2");
        vm.stopPrank();
    }

    function test_cancel_revertsWhen_alreadyResolved() public {
        vm.startPrank(resolver);
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "URI");
        vm.expectRevert(bytes("not active"));
        market.cancel("reason", "URI2");
        vm.stopPrank();
    }

    function test_markInvalid_revertsWhen_alreadyResolved() public {
        vm.startPrank(resolver);
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "URI");
        vm.expectRevert(bytes("not active"));
        market.markInvalid("reason", "URI2");
        vm.stopPrank();
    }

    function test_resolve_revertsWhen_cancelled() public {
        vm.startPrank(resolver);
        market.cancel("reason", "URI");
        vm.expectRevert(bytes("not active"));
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "URI2");
        vm.stopPrank();
    }

    function test_resolve_revertsWhen_invalid() public {
        vm.startPrank(resolver);
        market.markInvalid("reason", "URI");
        vm.expectRevert(bytes("not active"));
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "URI2");
        vm.stopPrank();
    }

    // 5. Outcome Params
    function test_resolve_revertsWhen_outcomeUnset() public {
        vm.prank(resolver);
        vm.expectRevert(bytes("invalid outcome"));
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Unset, "URI");
    }

    function test_resolve_revertsWhen_outcomeCancelled() public {
        vm.prank(resolver);
        vm.expectRevert(bytes("invalid outcome"));
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Cancelled, "URI");
    }

    function test_resolve_revertsWhen_outcomeInvalid() public {
        vm.prank(resolver);
        vm.expectRevert(bytes("invalid outcome"));
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Invalid, "URI");
    }

    // 6. Time Boundary - CURRENT STATUS (No Time Restraint)
    function test_timeBoundary_canResolveBeforeStartTime() public {
        // block.timestamp is 1, startTime is 11
        assertLt(block.timestamp, market.startTime());
        vm.prank(resolver);
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "URI");
        assertEq(uint(market.status()), uint(BinaryPredictionMarket.MarketStatus.Resolved));
    }

    function test_timeBoundary_canResolveBeforeEndTime() public {
        vm.warp(market.startTime() + 10);
        assertLt(block.timestamp, market.endTime());
        vm.prank(resolver);
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "URI");
        assertEq(uint(market.status()), uint(BinaryPredictionMarket.MarketStatus.Resolved));
    }

    function test_timeBoundary_canResolveAfterEndTime() public {
        vm.warp(market.endTime() + 10);
        assertGt(block.timestamp, market.endTime());
        vm.prank(resolver);
        market.resolveByAdmin(BinaryPredictionMarket.Outcome.Yes, "URI");
        assertEq(uint(market.status()), uint(BinaryPredictionMarket.MarketStatus.Resolved));
    }
}
