// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {MockUSDT} from "../src/tokens/MockUSDT.sol";
import {CPMMEngine} from "../src/pricing/CPMMEngine.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {IMarketFactory} from "../src/interfaces/IMarketFactory.sol";
import {IBinaryPredictionMarket} from "../src/interfaces/IBinaryPredictionMarket.sol";
import {ICPMMEngine} from "../src/interfaces/ICPMMEngine.sol";

contract Phase1InterfaceSurfaceSpec is Test {
    MockUSDT internal usdt;
    CPMMEngine internal engineImpl;
    IMarketFactory internal factory;
    ICPMMEngine internal engine;

    address internal creator = address(this);
    address internal resolver = address(0xA11CE);
    address internal treasury = address(0x7E57);
    address internal feeRouter = address(0xFEE);
    address internal userYes = address(0xBEEF);
    address internal userNo = address(0xCAFE);

    function setUp() public {
        usdt = new MockUSDT();
        engineImpl = new CPMMEngine();
        engine = ICPMMEngine(address(engineImpl));

        factory = IMarketFactory(address(new MarketFactory(
            500,
            1000,
            1000,
            1_000_000,
            3000,
            7000,
            resolver,
            feeRouter,
            treasury
        )));

        factory.setCollateralAllowed(address(usdt), true);
        factory.setAmmEngine(address(engine));

        usdt.mint(creator, 50_000_000);
        usdt.mint(userYes, 50_000_000);
        usdt.mint(userNo, 50_000_000);
    }

    function _validParams() internal view returns (IMarketFactory.CreateMarketParams memory) {
        return IMarketFactory.CreateMarketParams({
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

    function _createMarket() internal returns (uint256 marketId, IBinaryPredictionMarket market) {
        IMarketFactory.CreateMarketParams memory p = _validParams();
        usdt.approve(address(factory), p.initialCollateral);
        address marketAddress;
        (marketId, marketAddress) = factory.createMarket(p);
        market = IBinaryPredictionMarket(marketAddress);
    }

    function _fundMarketExtra(IBinaryPredictionMarket market, uint256 amount) internal {
        assertTrue(usdt.transfer(address(market), amount));
    }

    function _approveMarket(address user, IBinaryPredictionMarket market) internal {
        vm.prank(user);
        usdt.approve(address(market), type(uint256).max);
    }

    function test_factory_interface_createMarket_and_lookup() public {
        assertTrue(factory.hasRole(factory.DEFAULT_ADMIN_ROLE(), address(this)));
        assertTrue(factory.hasRole(factory.MARKET_CREATOR_ROLE(), address(this)));
        assertEq(factory.getRoleAdmin(factory.MARKET_CREATOR_ROLE()), factory.DEFAULT_ADMIN_ROLE());
        assertEq(factory.systemMaxFeeBps(), 500);
        assertEq(factory.systemMaxSlippageBps(), 1000);
        assertEq(factory.tradeCapBps(), 1000);
        assertEq(factory.minInitialCollateral(), 1_000_000);
        assertEq(factory.minInitialPriceYesBps(), 3000);
        assertEq(factory.maxInitialPriceYesBps(), 7000);
        assertEq(factory.resolver(), resolver);
        assertEq(factory.feeRouter(), feeRouter);
        assertEq(factory.treasury(), treasury);
        assertTrue(factory.collateralAllowed(address(usdt)));

        (uint256 marketId, IBinaryPredictionMarket market) = _createMarket();

        assertEq(factory.getMarket(marketId), address(market));
        assertEq(factory.markets(marketId), address(market));
        assertEq(factory.nextMarketId(), marketId + 1);
    }

    function test_engine_interface_quote_surface() public {
        (, IBinaryPredictionMarket market) = _createMarket();

        (uint256 pYes, uint256 pNo) = engine.getSpotPrice(market.R_yes(), market.R_no());
        assertEq(pYes + pNo, 10_000);

        (uint256 buySharesOut, uint256 buyFee,,,) = engine.quoteBuyYes(50_000, market.R_yes(), market.R_no(), market.feeBps());
        assertGt(buySharesOut, 0);
        assertGt(buyFee, 0);
    }

    function test_market_interface_reads_and_quotes() public {
        (uint256 marketId, IBinaryPredictionMarket market) = _createMarket();

        assertEq(market.marketId(), marketId);
        assertEq(market.question(), "BTC>100k?");
        assertEq(market.metadataURI(), "ipfs://rule");
        assertEq(address(market.collateral()), address(usdt));
        assertEq(market.startTime(), uint64(block.timestamp));
        assertEq(market.endTime(), uint64(block.timestamp + 7 days));
        assertEq(market.feeBps(), 50);
        assertEq(market.maxSlippageBps(), 500);
        assertEq(market.minTradeAmount(), 1);
        assertEq(market.maxTradeAmount(), 100_000);
        assertEq(uint256(market.status()), uint256(IBinaryPredictionMarket.MarketStatus.Active));
        assertEq(uint256(market.outcome()), uint256(IBinaryPredictionMarket.Outcome.Unset));
        assertEq(market.totalFeesCollected(), 0);
        assertEq(market.collateralLocked(), 1_000_000);
        assertEq(market.pairSupply(), 1_000_000);
        assertEq(market.totalYesSupply(), 1_000_000);
        assertEq(market.totalNoSupply(), 1_000_000);
        assertEq(market.resolver(), resolver);
        assertEq(market.feeRouter(), feeRouter);
        assertEq(market.treasury(), treasury);
        assertEq(address(market.ammEngine()), address(engine));
        assertFalse(market.paused());

        (uint256 priceYes, uint256 priceNo) = market.getPrices();
        assertEq(priceYes + priceNo, 10_000);

        (uint256 positionYes, uint256 positionNo, bool claimed) = market.getUserPosition(userYes);
        assertEq(positionYes, 0);
        assertEq(positionNo, 0);
        assertFalse(claimed);

        (uint256 quoteBuyYesOut, uint256 quoteBuyYesFee, uint256 quoteBuyYesImpact) = market.quoteBuyYes(50_000);
        (uint256 quoteBuyNoOut, uint256 quoteBuyNoFee, uint256 quoteBuyNoImpact) = market.quoteBuyNo(50_000);

        assertGt(quoteBuyYesOut, 0);
        assertGt(quoteBuyNoOut, 0);
        assertGt(quoteBuyYesFee, 0);
        assertGt(quoteBuyNoFee, 0);
        assertGt(quoteBuyYesImpact, 0);
        assertGt(quoteBuyNoImpact, 0);
    }

    function test_market_interface_buy_and_sell_paths() public {
        (, IBinaryPredictionMarket market) = _createMarket();
        _fundMarketExtra(market, 1_000_000);

        _approveMarket(userYes, market);
        _approveMarket(userNo, market);

        (uint256 buyYesShares,,) = market.quoteBuyYes(80_000);
        vm.prank(userYes);
        market.buyYes(80_000, buyYesShares);
        assertEq(market.yesShares(userYes), buyYesShares);

        (uint256 buyNoShares,,) = market.quoteBuyNo(70_000);
        vm.prank(userNo);
        market.buyNo(70_000, buyNoShares);
        assertEq(market.noShares(userNo), buyNoShares);

        uint256 sellYesShares = buyYesShares / 4;
        (uint256 sellYesOut,,) = market.quoteSellYes(sellYesShares);
        vm.prank(userYes);
        market.sellYes(sellYesShares, sellYesOut);
        assertEq(market.yesShares(userYes), buyYesShares - sellYesShares);

        uint256 sellNoShares = buyNoShares / 4;
        (uint256 sellNoOut,,) = market.quoteSellNo(sellNoShares);
        vm.prank(userNo);
        market.sellNo(sellNoShares, sellNoOut);
        assertEq(market.noShares(userNo), buyNoShares - sellNoShares);
    }

    function test_market_interface_resolve_and_claim_path() public {
        (, IBinaryPredictionMarket market) = _createMarket();
        _fundMarketExtra(market, 1_000_000);
        _approveMarket(userYes, market);

        (uint256 buyYesShares,,) = market.quoteBuyYes(90_000);
        vm.prank(userYes);
        market.buyYes(90_000, buyYesShares);

        vm.prank(resolver);
        market.resolveByAdmin(IBinaryPredictionMarket.Outcome.Yes, "ipfs://yes");

        uint256 balanceBefore = usdt.balanceOf(userYes);
        vm.prank(userYes);
        market.claim();

        assertEq(usdt.balanceOf(userYes) - balanceBefore, buyYesShares);
        assertEq(market.yesShares(userYes), 0);
        assertTrue(market.claimedFinalPayout(userYes));
    }

    function test_market_interface_cancel_refund_and_treasury_sweep_path() public {
        (, IBinaryPredictionMarket market) = _createMarket();
        _fundMarketExtra(market, 1_000_000);
        _approveMarket(userYes, market);

        (uint256 buyYesShares,,) = market.quoteBuyYes(75_000);
        vm.prank(userYes);
        market.buyYes(75_000, buyYesShares);

        vm.prank(resolver);
        market.cancel("cancelled", "ipfs://cancel");

        uint256 userBalanceBefore = usdt.balanceOf(userYes);
        vm.prank(userYes);
        market.refund();

        assertEq(usdt.balanceOf(userYes) - userBalanceBefore, buyYesShares / 2);
        assertTrue(market.claimedFinalPayout(userYes));

        vm.warp(uint256(market.resolvedAt()) + uint256(market.refundWindow()) + 1);
        uint256 sweepable = usdt.balanceOf(address(market));

        vm.prank(treasury);
        market.refundTreasury();

        assertEq(usdt.balanceOf(address(market)), 0);
        assertGt(sweepable, 0);
    }
}
