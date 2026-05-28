// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ICPMMEngine {
    function quoteBuyYes(
        uint256 collateralIn,
        uint256 rYes,
        uint256 rNo,
        uint16 feeBps
    )
        external
        pure
        returns (uint256 sharesOut, uint256 fee, uint256 newRYes, uint256 newRNo, uint256 priceImpactBps);

    function quoteBuyNo(
        uint256 collateralIn,
        uint256 rYes,
        uint256 rNo,
        uint16 feeBps
    )
        external
        pure
        returns (uint256 sharesOut, uint256 fee, uint256 newRYes, uint256 newRNo, uint256 priceImpactBps);

    function quoteSellYes(
        uint256 sharesIn,
        uint256 rYes,
        uint256 rNo,
        uint16 feeBps
    )
        external
        pure
        returns (uint256 collateralOut, uint256 fee, uint256 newRYes, uint256 newRNo, uint256 priceImpactBps);

    function quoteSellNo(
        uint256 sharesIn,
        uint256 rYes,
        uint256 rNo,
        uint16 feeBps
    )
        external
        pure
        returns (uint256 collateralOut, uint256 fee, uint256 newRYes, uint256 newRNo, uint256 priceImpactBps);

    function getSpotPrice(
        uint256 rYes,
        uint256 rNo
    )
        external
        pure
        returns (uint256 pYesBps, uint256 pNoBps);
}
