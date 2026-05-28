pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {stdError} from "forge-std/StdError.sol";

import {MockUSDT} from "../src/tokens/MockUSDT.sol";
import {CPMMEngine} from "../src/pricing/CPMMEngine.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPredictionMarket} from "../src/market/BinaryPredictionMarket.sol";

contract Phase1SpecTests is Test {
    MockUSDT internal usdt;
    CPMMEngine internal engine;
    MarketFactory internal factory;
    BinaryPredictionMarket internal market;

    address internal creator = address(this);
    address internal user = address(0xBEEF);
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

        usdt.mint(user, 100_000_000_000);
    }

    function _createMarket(uint256 initialCollateral, uint16 initialPriceYesBps) internal returns (BinaryPredictionMarket) {
        MarketFactory.CreateMarketParams memory p = MarketFactory.CreateMarketParams({
            question: "BTC>100k?",
            metadataURI: "ipfs://rule",
            collateral: address(usdt),
            startTime: uint64(block.timestamp),
            endTime: uint64(block.timestamp + 7 days),
            initialCollateral: initialCollateral,
            initialPriceYesBps: initialPriceYesBps,
            minTradeAmount: 1,
            maxTradeAmount: 100_000,
            maxSlippageBps: 500,
            feeBps: 50
        });

        usdt.mint(creator, initialCollateral);
        usdt.approve(address(factory), initialCollateral);

        (, address marketAddress) = factory.createMarket(p);
        BinaryPredictionMarket m = BinaryPredictionMarket(marketAddress);

        vm.prank(address(factory));
        m.setAmmEngine(address(engine));
        return m;
    }

    function _assertI1I5(BinaryPredictionMarket m) internal view {
        assertEq(m.collateralLocked(), m.pairSupply());
        assertEq(m.totalYesSupply(), m.pairSupply());
        assertEq(m.totalNoSupply(), m.pairSupply());

        assertEq(m.R_yes() + m.treasuryYes() + m.totalUserYesShares(), m.totalYesSupply());
        assertEq(m.R_no() + m.treasuryNo() + m.totalUserNoShares(), m.totalNoSupply());
    }

    function _assertI6Solvency(BinaryPredictionMarket m) internal view {
        assertGe(usdt.balanceOf(address(m)), m.collateralLocked());
    }

    function test_createMarket_initialCollateralTransferred_andBacked() public {
        market = _createMarket(1_000_000, 5000);
        assertEq(usdt.balanceOf(address(market)), 1_000_000);
        assertEq(market.collateralLocked(), 1_000_000);
        assertEq(usdt.balanceOf(address(market)), market.collateralLocked());
    }

    function test_invariants_I6_hold_after_createMarket() public {
        market = _createMarket(1_000_000, 5000);
        assertGe(usdt.balanceOf(address(market)), market.collateralLocked());
    }

    function test_buyYes_quote_execute_consistency() public {
        market = _createMarket(1_000_000, 5000);

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
        assertEq(usdt.balanceOf(address(market)), 1_000_000 + collateralIn - quoteFee);
    }

    function test_buyNo_quote_execute_consistency() public {
        market = _createMarket(1_000_000, 5000);

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
        assertEq(usdt.balanceOf(address(market)), 1_000_000 + collateralIn - quoteFee);
    }

    function test_sellYes_reverts_underflow_current_bug() public {
        market = _createMarket(1_000_000, 5000);

        usdt.mint(creator, 1_000_000);
        usdt.transfer(address(market), 1_000_000);

        uint256 collateralIn = 80_000;
        (uint256 buySharesOut, uint256 buyFee,) = market.quoteBuyYes(collateralIn);
        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, buySharesOut);
        vm.stopPrank();

        uint256 rYesBefore = market.R_yes();
        uint256 rNoBefore = market.R_no();
        uint256 pairSupplyBefore = market.pairSupply();
        uint256 collateralLockedBefore = market.collateralLocked();

        uint256 sharesIn = buySharesOut / 3;
        (uint256 quoteCollateralOut, uint256 quoteSellFee,) = market.quoteSellYes(sharesIn);

        vm.prank(user);
        vm.expectRevert(stdError.arithmeticError);
        market.sellYes(sharesIn, quoteCollateralOut);

        uint256 a = rYesBefore + rNoBefore - sharesIn;
        uint256 discriminant = a * a + 4 * sharesIn * rYesBefore;
        uint256 x = (sqrt(discriminant) - a) / 2;
        uint256 y = sharesIn - x;

        assertTrue(sharesIn > y);
        assertEq(usdt.balanceOf(treasury), buyFee);
        assertEq(quoteSellFee > 0, true);
    }

    function test_cancel_refund_half_shares_floor() public {
        market = _createMarket(1_000_000, 5000);

        usdt.mint(creator, 1_000_000);
        usdt.transfer(address(market), 1_000_000);

        uint256 collateralIn = 99_999;
        (uint256 buySharesOut,,) = market.quoteBuyYes(collateralIn);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, buySharesOut);
        vm.stopPrank();

        vm.prank(resolver);
        market.cancel("r", "ipfs://e");

        uint256 yesBal = market.yesShares(user);
        uint256 noBal = market.noShares(user);
        uint256 expectedRefund = (yesBal + noBal) / 2;

        uint256 userBalBefore = usdt.balanceOf(user);
        vm.prank(user);
        market.refund();
        uint256 userBalAfter = usdt.balanceOf(user);

        assertEq(userBalAfter - userBalBefore, expectedRefund);
        assertEq(market.yesShares(user), 0);
        assertEq(market.noShares(user), 0);
        assertTrue(market.claimedFinalPayout(user));
    }

    function test_invalid_refund_half_shares_floor() public {
        market = _createMarket(1_000_000, 5000);

        usdt.mint(creator, 1_000_000);
        usdt.transfer(address(market), 1_000_000);

        uint256 collateralIn = 99_999;
        (uint256 buySharesOut,,) = market.quoteBuyYes(collateralIn);

        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, buySharesOut);
        vm.stopPrank();

        vm.prank(resolver);
        market.markInvalid("r", "ipfs://e");

        uint256 yesBal = market.yesShares(user);
        uint256 noBal = market.noShares(user);
        uint256 expectedRefund = (yesBal + noBal) / 2;

        uint256 userBalBefore = usdt.balanceOf(user);
        vm.prank(user);
        market.refund();
        uint256 userBalAfter = usdt.balanceOf(user);

        assertEq(userBalAfter - userBalBefore, expectedRefund);
        assertEq(market.yesShares(user), 0);
        assertEq(market.noShares(user), 0);
        assertTrue(market.claimedFinalPayout(user));
    }

    function test_sellYes_reverts_before_invariant_checks_current_bug() public {
        market = _createMarket(1_000_000, 5000);

        usdt.mint(creator, 1_000_000);
        usdt.transfer(address(market), 1_000_000);

        uint256 collateralIn = 70_000;
        (uint256 buySharesOut,,) = market.quoteBuyYes(collateralIn);
        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, buySharesOut);
        vm.stopPrank();

        uint256 sharesIn = buySharesOut / 4;
        (uint256 quoteCollateralOut,,) = market.quoteSellYes(sharesIn);
        vm.prank(user);
        vm.expectRevert(stdError.arithmeticError);
        market.sellYes(sharesIn, quoteCollateralOut);
    }

    function test_invariants_I1_I5_hold_after_manual_backing_and_buy() public {
        market = _createMarket(1_000_000, 5000);

        usdt.mint(creator, 1_000_000);
        usdt.transfer(address(market), 1_000_000);

        uint256 collateralIn = 50_000;
        (uint256 quoteSharesOut,,) = market.quoteBuyYes(collateralIn);
        vm.startPrank(user);
        usdt.approve(address(market), type(uint256).max);
        market.buyYes(collateralIn, quoteSharesOut);
        vm.stopPrank();

        _assertI1I5(market);
        _assertI6Solvency(market);
    }

    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
}
