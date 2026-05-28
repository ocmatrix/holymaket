// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ICPMMEngine} from "../interfaces/ICPMMEngine.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract CPMMEngine is ICPMMEngine {
    uint256 internal constant BPS_DENOMINATOR = 10000;
    uint256 internal constant PRECISION = 1e18;

    struct SellQuoteCandidate {
        bool valid;
        uint256 payout;
        uint256 error;
        uint256 collateralGross;
        uint256 newRSold;
        uint256 newROpposite;
    }

    function getSpotPrice(uint256 rYes, uint256 rNo)
        external
        pure
        returns (uint256 pYesBps, uint256 pNoBps)
    {
        uint256 total = rYes + rNo;
        if (total == 0) return (5000, 5000);
        pYesBps = (rNo * BPS_DENOMINATOR) / total;
        pNoBps = BPS_DENOMINATOR - pYesBps;
    }

    function quoteBuyYes(
        uint256 collateralIn,
        uint256 rYes,
        uint256 rNo,
        uint16 feeBps
    ) external pure returns (
        uint256 sharesOut,
        uint256 fee,
        uint256 newRYes,
        uint256 newRNo,
        uint256 priceImpactBps
    ) {
        require(collateralIn > 0, "zero input");
        require(rYes > 0 && rNo > 0, "empty pool");
        fee = collateralIn * feeBps / BPS_DENOMINATOR;
        uint256 net = collateralIn - fee;
        uint256 priceBefore = (rNo * BPS_DENOMINATOR) / (rYes + rNo);
        newRNo = rNo + net;
        uint256 k = rYes * rNo;
        newRYes = k / newRNo;
        uint256 deltaYes = rYes - newRYes;
        sharesOut = net + deltaYes;
        uint256 totalAfter = newRYes + newRNo;
        uint256 priceAfter = totalAfter > 0 ? (newRNo * BPS_DENOMINATOR) / totalAfter : priceBefore;
        priceImpactBps = _computePriceImpact(priceBefore, priceAfter);
        require(newRYes > 0, "AMM depleted");
    }

    function quoteBuyNo(
        uint256 collateralIn,
        uint256 rYes,
        uint256 rNo,
        uint16 feeBps
    ) external pure returns (
        uint256 sharesOut,
        uint256 fee,
        uint256 newRYes,
        uint256 newRNo,
        uint256 priceImpactBps
    ) {
        require(collateralIn > 0, "zero input");
        require(rYes > 0 && rNo > 0, "empty pool");
        fee = collateralIn * feeBps / BPS_DENOMINATOR;
        uint256 net = collateralIn - fee;
        uint256 priceBefore = (rYes * BPS_DENOMINATOR) / (rYes + rNo);
        newRYes = rYes + net;
        uint256 k = rYes * rNo;
        newRNo = k / newRYes;
        uint256 deltaNo = rNo - newRNo;
        sharesOut = net + deltaNo;
        uint256 totalAfter = newRYes + newRNo;
        uint256 priceAfter = totalAfter > 0 ? (newRYes * BPS_DENOMINATOR) / totalAfter : priceBefore;
        priceImpactBps = _computePriceImpact(priceBefore, priceAfter);
        require(newRNo > 0, "AMM depleted");
    }

    function quoteSellYes(
        uint256 sharesIn,
        uint256 rYes,
        uint256 rNo,
        uint16 feeBps
    ) external pure returns (
        uint256 collateralOut,
        uint256 fee,
        uint256 newRYes,
        uint256 newRNo,
        uint256 priceImpactBps
    ) {
        require(sharesIn > 0, "zero input");
        require(rYes > 0 && rNo > 0, "empty pool");
        require(sharesIn <= rYes, "shares exceeds reserve");

        (uint256 collateralGross, uint256 x) = _selectSellYesQuote(sharesIn, rYes, rNo, feeBps);
        newRYes = rYes + x;
        newRNo = Math.ceilDiv(rYes * rNo, newRYes);
        fee = collateralGross * feeBps / BPS_DENOMINATOR;
        collateralOut = collateralGross - fee;
        uint256 totalAfter = newRYes + newRNo;
        uint256 priceBefore = (rNo * BPS_DENOMINATOR) / (rYes + rNo);
        uint256 priceAfter = totalAfter > 0 ? (newRNo * BPS_DENOMINATOR) / totalAfter : priceBefore;
        priceImpactBps = _computePriceImpact(priceBefore, priceAfter);
    }

    function quoteSellNo(
        uint256 sharesIn,
        uint256 rYes,
        uint256 rNo,
        uint16 feeBps
    ) external pure returns (
        uint256 collateralOut,
        uint256 fee,
        uint256 newRYes,
        uint256 newRNo,
        uint256 priceImpactBps
    ) {
        require(sharesIn > 0, "zero input");
        require(rYes > 0 && rNo > 0, "empty pool");
        require(sharesIn <= rNo, "shares exceeds reserve");

        (uint256 collateralGross, uint256 x) = _selectSellNoQuote(sharesIn, rYes, rNo, feeBps);
        newRNo = rNo + x;
        newRYes = Math.ceilDiv(rYes * rNo, newRNo);
        fee = collateralGross * feeBps / BPS_DENOMINATOR;
        collateralOut = collateralGross - fee;
        uint256 totalAfter = newRYes + newRNo;
        uint256 priceBefore = (rYes * BPS_DENOMINATOR) / (rYes + rNo);
        uint256 priceAfter = totalAfter > 0 ? (newRYes * BPS_DENOMINATOR) / totalAfter : priceBefore;
        priceImpactBps = _computePriceImpact(priceBefore, priceAfter);
    }

    function _selectSellYesQuote(
        uint256 sharesIn,
        uint256 rYes,
        uint256 rNo,
        uint16 feeBps
    ) internal pure returns (uint256 collateralGross, uint256 x) {
        uint256 a = rYes + rNo - sharesIn;
        uint256 discriminant = a * a + 4 * sharesIn * rYes;
        uint256 xFloor = (Math.sqrt(discriminant) - a) / 2;

        SellQuoteCandidate memory selected =
            _quoteSellYesCandidate(xFloor, sharesIn, rYes, rNo, feeBps);
        if (xFloor > 0) {
            selected = _pickBetterSellCandidate(
                selected,
                _quoteSellYesCandidate(xFloor - 1, sharesIn, rYes, rNo, feeBps)
            );
        }
        selected = _pickBetterSellCandidate(
            selected,
            _quoteSellYesCandidate(xFloor + 1, sharesIn, rYes, rNo, feeBps)
        );
        require(selected.valid, "insufficient depth");
        return (selected.collateralGross, selected.newRSold - rYes);
    }

    function _selectSellNoQuote(
        uint256 sharesIn,
        uint256 rYes,
        uint256 rNo,
        uint16 feeBps
    ) internal pure returns (uint256 collateralGross, uint256 x) {
        uint256 a = rYes + rNo - sharesIn;
        uint256 discriminant = a * a + 4 * sharesIn * rNo;
        uint256 xFloor = (Math.sqrt(discriminant) - a) / 2;

        SellQuoteCandidate memory selected =
            _quoteSellNoCandidate(xFloor, sharesIn, rYes, rNo, feeBps);
        if (xFloor > 0) {
            selected = _pickBetterSellCandidate(
                selected,
                _quoteSellNoCandidate(xFloor - 1, sharesIn, rYes, rNo, feeBps)
            );
        }
        selected = _pickBetterSellCandidate(
            selected,
            _quoteSellNoCandidate(xFloor + 1, sharesIn, rYes, rNo, feeBps)
        );
        require(selected.valid, "insufficient depth");
        return (selected.collateralGross, selected.newRSold - rNo);
    }

    function _quoteSellYesCandidate(
        uint256 x,
        uint256 sharesIn,
        uint256 rYes,
        uint256 rNo,
        uint16 feeBps
    ) internal pure returns (SellQuoteCandidate memory candidate) {
        if (x > sharesIn) {
            return candidate;
        }

        uint256 newRYes = rYes + x;
        uint256 newRNo = Math.ceilDiv(rYes * rNo, newRYes);
        if (newRNo == 0 || newRNo >= rNo) {
            return candidate;
        }

        uint256 collateralGross = rNo - newRNo;
        uint256 fee = collateralGross * feeBps / BPS_DENOMINATOR;
        uint256 payout = collateralGross - fee;
        if (collateralGross == 0 || payout == 0) {
            return candidate;
        }

        uint256 idealY = sharesIn - x;
        candidate.valid = true;
        candidate.payout = payout;
        candidate.error = collateralGross > idealY ? collateralGross - idealY : idealY - collateralGross;
        candidate.collateralGross = collateralGross;
        candidate.newRSold = newRYes;
        candidate.newROpposite = newRNo;
    }

    function _quoteSellNoCandidate(
        uint256 x,
        uint256 sharesIn,
        uint256 rYes,
        uint256 rNo,
        uint16 feeBps
    ) internal pure returns (SellQuoteCandidate memory candidate) {
        if (x > sharesIn) {
            return candidate;
        }

        uint256 newRNo = rNo + x;
        uint256 newRYes = Math.ceilDiv(rYes * rNo, newRNo);
        if (newRYes == 0 || newRYes >= rYes) {
            return candidate;
        }

        uint256 collateralGross = rYes - newRYes;
        uint256 fee = collateralGross * feeBps / BPS_DENOMINATOR;
        uint256 payout = collateralGross - fee;
        if (collateralGross == 0 || payout == 0) {
            return candidate;
        }

        uint256 idealY = sharesIn - x;
        candidate.valid = true;
        candidate.payout = payout;
        candidate.error = collateralGross > idealY ? collateralGross - idealY : idealY - collateralGross;
        candidate.collateralGross = collateralGross;
        candidate.newRSold = newRNo;
        candidate.newROpposite = newRYes;
    }

    function _pickBetterSellCandidate(
        SellQuoteCandidate memory first,
        SellQuoteCandidate memory second
    ) internal pure returns (SellQuoteCandidate memory) {
        if (!first.valid) return second;
        if (!second.valid) return first;
        if (second.error < first.error) return second;
        if (second.error == first.error && second.payout > first.payout) return second;
        return first;
    }

    function _computePriceImpact(uint256 priceBefore, uint256 priceAfter) internal pure returns (uint256) {
        if (priceBefore == 0) {
            return 0;
        }

        if (priceAfter >= priceBefore) {
            return ((priceAfter - priceBefore) * BPS_DENOMINATOR) / priceBefore;
        }

        return ((priceBefore - priceAfter) * BPS_DENOMINATOR) / priceBefore;
    }
}
