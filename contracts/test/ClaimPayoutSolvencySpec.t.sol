// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

import {MockUSDT} from "../src/tokens/MockUSDT.sol";
import {CPMMEngine} from "../src/pricing/CPMMEngine.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPredictionMarket} from "../src/market/BinaryPredictionMarket.sol";

contract ClaimPayoutSolvencySpec is Test {
    MockUSDT internal usdt;
    CPMMEngine internal engine;
    MarketFactory internal factory;

    address internal creator = address(this);
    address internal resolver = address(0xA11CE);
    address internal treasury = address(0x7E57);
    address internal feeRouter = address(0xFEE);
    address internal yesHolderA = address(0xBEEF);
    address internal yesHolderB = address(0xBEE1);
    address internal noHolderA = address(0xCAFE);
    address internal noHolderB = address(0xCA11);
    address internal emptyUser = address(0xDEAD);

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
        usdt.mint(yesHolderA, 5_000_000);
        usdt.mint(yesHolderB, 5_000_000);
        usdt.mint(noHolderA, 5_000_000);
        usdt.mint(noHolderB, 5_000_000);
        usdt.mint(emptyUser, 5_000_000);
    }

    function _createActiveMarket() internal returns (BinaryPredictionMarket market) {
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

        usdt.approve(address(factory), p.initialCollateral);
        (, address marketAddress) = factory.createMarket(p);
        market = BinaryPredictionMarket(marketAddress);

        vm.prank(address(factory));
        market.setAmmEngine(address(engine));
    }

    function _fundMarketExtra(BinaryPredictionMarket market, uint256 amount) internal {
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

    function _pause(BinaryPredictionMarket market) internal {
        vm.prank(address(factory));
        market.pause();
    }

    function _claimAndMeasure(BinaryPredictionMarket market, address user)
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

    function test_yesWinnerClaim_freezesPayoutAndSolvency() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _fundMarketExtra(market, 1_000_000);

        uint256 yesSharesOut = _buyYes(market, yesHolderA, 90_000);
        _buyNo(market, noHolderA, 40_000);
        _resolveYes(market);

        (uint256 userReceived, uint256 marketDecrease, uint256 treasuryDelta) =
            _claimAndMeasure(market, yesHolderA);

        assertEq(userReceived, yesSharesOut);
        assertEq(marketDecrease, yesSharesOut);
        assertEq(treasuryDelta, 0);
        assertEq(market.yesShares(yesHolderA), 0);
        assertEq(market.noShares(yesHolderA), 0);
        assertTrue(market.claimedFinalPayout(yesHolderA));
    }

    function test_noWinnerClaim_freezesPayoutAndSolvency() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _fundMarketExtra(market, 1_000_000);

        _buyYes(market, yesHolderA, 40_000);
        uint256 noSharesOut = _buyNo(market, noHolderA, 90_000);
        _resolveNo(market);

        (uint256 userReceived, uint256 marketDecrease, uint256 treasuryDelta) =
            _claimAndMeasure(market, noHolderA);

        assertEq(userReceived, noSharesOut);
        assertEq(marketDecrease, noSharesOut);
        assertEq(treasuryDelta, 0);
        assertEq(market.noShares(noHolderA), 0);
        assertEq(market.yesShares(noHolderA), 0);
        assertTrue(market.claimedFinalPayout(noHolderA));
    }

    function test_loserClaim_yesWins_freezesZeroPayoutAndShareRetention() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _fundMarketExtra(market, 1_000_000);

        _buyYes(market, yesHolderA, 90_000);
        uint256 losingShares = _buyNo(market, noHolderA, 40_000);
        _resolveYes(market);

        (uint256 userReceived, uint256 marketDecrease, uint256 treasuryDelta) =
            _claimAndMeasure(market, noHolderA);

        assertEq(userReceived, 0);
        assertEq(marketDecrease, 0);
        assertEq(treasuryDelta, 0);
        assertEq(market.noShares(noHolderA), losingShares);
        assertEq(market.yesShares(noHolderA), 0);
        assertTrue(market.claimedFinalPayout(noHolderA));

        vm.prank(noHolderA);
        vm.expectRevert(bytes("already claimed"));
        market.claim();
    }

    function test_loserClaim_noWins_freezesZeroPayoutAndShareRetention() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _fundMarketExtra(market, 1_000_000);

        uint256 losingShares = _buyYes(market, yesHolderA, 40_000);
        _buyNo(market, noHolderA, 90_000);
        _resolveNo(market);

        (uint256 userReceived, uint256 marketDecrease, uint256 treasuryDelta) =
            _claimAndMeasure(market, yesHolderA);

        assertEq(userReceived, 0);
        assertEq(marketDecrease, 0);
        assertEq(treasuryDelta, 0);
        assertEq(market.yesShares(yesHolderA), losingShares);
        assertEq(market.noShares(yesHolderA), 0);
        assertTrue(market.claimedFinalPayout(yesHolderA));

        vm.prank(yesHolderA);
        vm.expectRevert(bytes("already claimed"));
        market.claim();
    }

    function test_claim_withoutShares_freezesZeroPayoutAndOneShotBehavior() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _fundMarketExtra(market, 1_000_000);
        _buyYes(market, yesHolderA, 90_000);
        _resolveYes(market);

        (uint256 userReceived, uint256 marketDecrease, uint256 treasuryDelta) =
            _claimAndMeasure(market, emptyUser);

        assertEq(userReceived, 0);
        assertEq(marketDecrease, 0);
        assertEq(treasuryDelta, 0);
        assertEq(market.yesShares(emptyUser), 0);
        assertEq(market.noShares(emptyUser), 0);
        assertTrue(market.claimedFinalPayout(emptyUser));

        vm.prank(emptyUser);
        vm.expectRevert(bytes("already claimed"));
        market.claim();
    }

    function test_repeatClaim_winnerCannotDoublePayout() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _fundMarketExtra(market, 1_000_000);

        uint256 yesSharesOut = _buyYes(market, yesHolderA, 90_000);
        _resolveYes(market);

        uint256 balanceBefore = usdt.balanceOf(yesHolderA);
        vm.prank(yesHolderA);
        market.claim();

        assertEq(usdt.balanceOf(yesHolderA) - balanceBefore, yesSharesOut);

        vm.prank(yesHolderA);
        vm.expectRevert(bytes("already claimed"));
        market.claim();
    }

    function test_multipleWinnerClaims_totalPayoutNeverExceedsPreClaimBalance_yesOrderAB() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _fundMarketExtra(market, 1_500_000);

        uint256 yesSharesA = _buyYes(market, yesHolderA, 80_000);
        uint256 yesSharesB = _buyYes(market, yesHolderB, 60_000);
        _buyNo(market, noHolderA, 30_000);
        _resolveYes(market);

        uint256 preClaimMarketBalance = usdt.balanceOf(address(market));
        uint256 totalWinningShares = yesSharesA + yesSharesB;
        assertLe(totalWinningShares, preClaimMarketBalance);

        (uint256 payoutA, uint256 marketDropA,) = _claimAndMeasure(market, yesHolderA);
        (uint256 payoutB, uint256 marketDropB,) = _claimAndMeasure(market, yesHolderB);

        uint256 totalPayout = payoutA + payoutB;
        uint256 totalMarketDecrease = marketDropA + marketDropB;

        assertEq(totalPayout, totalWinningShares);
        assertEq(totalMarketDecrease, totalPayout);
        assertLe(totalPayout, preClaimMarketBalance);
        assertEq(usdt.balanceOf(address(market)), preClaimMarketBalance - totalPayout);
    }

    function test_multipleWinnerClaims_totalPayoutNeverExceedsPreClaimBalance_yesOrderBA() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _fundMarketExtra(market, 1_500_000);

        uint256 yesSharesA = _buyYes(market, yesHolderA, 80_000);
        uint256 yesSharesB = _buyYes(market, yesHolderB, 60_000);
        _buyNo(market, noHolderA, 30_000);
        _resolveYes(market);

        uint256 preClaimMarketBalance = usdt.balanceOf(address(market));
        uint256 totalWinningShares = yesSharesA + yesSharesB;

        (uint256 payoutB, uint256 marketDropB,) = _claimAndMeasure(market, yesHolderB);
        (uint256 payoutA, uint256 marketDropA,) = _claimAndMeasure(market, yesHolderA);

        uint256 totalPayout = payoutA + payoutB;
        uint256 totalMarketDecrease = marketDropA + marketDropB;

        assertEq(totalPayout, totalWinningShares);
        assertEq(totalMarketDecrease, totalPayout);
        assertLe(totalPayout, preClaimMarketBalance);
        assertEq(usdt.balanceOf(address(market)), preClaimMarketBalance - totalPayout);
    }

    function test_claimUserReceivedMatchesMarketDecreaseAndTreasuryIsUntouched() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _fundMarketExtra(market, 1_000_000);

        uint256 yesSharesA = _buyYes(market, yesHolderA, 70_000);
        _buyNo(market, noHolderA, 45_000);
        _resolveYes(market);

        uint256 marketBalanceBefore = usdt.balanceOf(address(market));
        uint256 treasuryBalanceBefore = usdt.balanceOf(treasury);

        (uint256 userReceived, uint256 marketDecrease, uint256 treasuryDelta) =
            _claimAndMeasure(market, yesHolderA);

        assertEq(userReceived, yesSharesA);
        assertEq(userReceived, marketDecrease);
        assertEq(treasuryDelta, 0);
        assertEq(usdt.balanceOf(treasury), treasuryBalanceBefore);
        assertLe(userReceived, marketBalanceBefore);
    }

    function test_claim_revertsWhen_active() public {
        BinaryPredictionMarket market = _createActiveMarket();

        vm.prank(emptyUser);
        vm.expectRevert(bytes("not resolved"));
        market.claim();
    }

    function test_claim_revertsWhen_cancelled() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _cancel(market);

        vm.prank(emptyUser);
        vm.expectRevert(bytes("not resolved"));
        market.claim();
    }

    function test_claim_revertsWhen_invalid() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _markInvalid(market);

        vm.prank(emptyUser);
        vm.expectRevert(bytes("not resolved"));
        market.claim();
    }

    function test_claim_revertsWhen_pausedSafetySwitch() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _pause(market);

        vm.prank(emptyUser);
        vm.expectRevert(bytes("not resolved"));
        market.claim();
    }

    function test_resolvedWithNoWinningSharesHeld_freezesZeroPayoutBehavior() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _resolveYes(market);

        (uint256 userReceived, uint256 marketDecrease, uint256 treasuryDelta) =
            _claimAndMeasure(market, emptyUser);

        assertEq(userReceived, 0);
        assertEq(marketDecrease, 0);
        assertEq(treasuryDelta, 0);
        assertTrue(market.claimedFinalPayout(emptyUser));
    }

    function test_claim_revertsWhen_marketBalanceCannotCoverWinningPayout() public {
        BinaryPredictionMarket market = _createActiveMarket();
        _fundMarketExtra(market, 1_000_000);

        uint256 winningShares = _buyYes(market, yesHolderA, 90_000);
        _resolveYes(market);

        uint256 forcedBalance = winningShares - 1;
        deal(address(usdt), address(market), forcedBalance, true);

        vm.prank(yesHolderA);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientBalance.selector,
                address(market),
                forcedBalance,
                winningShares
            )
        );
        market.claim();
    }
}
