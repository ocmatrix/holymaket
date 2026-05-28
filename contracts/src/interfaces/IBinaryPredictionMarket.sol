// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ICPMMEngine} from "./ICPMMEngine.sol";

interface IBinaryPredictionMarket is IAccessControl, IERC165 {
    enum Outcome {
        Unset,
        Yes,
        No,
        Cancelled,
        Invalid
    }

    enum MarketStatus {
        Active,
        Paused,
        Resolved,
        Cancelled,
        Invalid
    }

    event LiquidityInitialized(uint256 initialCollateral, uint16 initialPriceYesBps);
    event PositionBought(
        uint256 indexed marketId,
        address indexed user,
        uint8 side,
        uint256 collateralIn,
        uint256 sharesOut,
        uint256 fee,
        uint256 priceAfter
    );
    event PositionSold(
        uint256 indexed marketId,
        address indexed user,
        uint8 side,
        uint256 sharesIn,
        uint256 collateralOut,
        uint256 fee,
        uint256 priceAfter
    );
    event MarketResolved(
        uint256 indexed marketId,
        Outcome outcome,
        address indexed resolver,
        string evidenceURI
    );
    event RewardClaimed(uint256 indexed marketId, address indexed user, uint256 payout);
    event TreasuryRefundClaimed(uint256 indexed marketId, uint256 refundAmount);
    event RefundClaimed(
        uint256 indexed marketId,
        address indexed user,
        uint256 yesShares,
        uint256 noShares,
        uint256 refundAmount
    );
    event FeeCollected(uint256 indexed marketId, uint256 amount, address indexed to);
    event MarketPaused(uint256 indexed marketId);
    event MarketUnpaused(uint256 indexed marketId);
    event ReservesUpdated(uint256 indexed marketId, uint256 yes, uint256 no);

    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);
    function RESOLVER_ROLE() external view returns (bytes32);
    function ADMIN_ROLE() external view returns (bytes32);

    function marketId() external view returns (uint256);
    function question() external view returns (string memory);
    function metadataURI() external view returns (string memory);
    function collateral() external view returns (IERC20);
    function startTime() external view returns (uint64);
    function endTime() external view returns (uint64);
    function feeBps() external view returns (uint16);
    function maxSlippageBps() external view returns (uint16);
    function minTradeAmount() external view returns (uint256);
    function maxTradeAmount() external view returns (uint256);

    function outcome() external view returns (Outcome);
    function status() external view returns (MarketStatus);
    function evidenceURI() external view returns (string memory);
    function resolvedAt() external view returns (uint64);
    function refundWindow() external view returns (uint64);

    function collateralLocked() external view returns (uint256);
    function pairSupply() external view returns (uint256);
    function totalYesSupply() external view returns (uint256);
    function totalNoSupply() external view returns (uint256);
    function R_yes() external view returns (uint256);
    function R_no() external view returns (uint256);
    function totalUserYesShares() external view returns (uint256);
    function totalUserNoShares() external view returns (uint256);
    function totalFeesCollected() external view returns (uint256);

    function yesShares(address user) external view returns (uint256);
    function noShares(address user) external view returns (uint256);
    function claimedFinalPayout(address user) external view returns (bool);
    function treasuryYes() external view returns (uint256);
    function treasuryNo() external view returns (uint256);

    function resolver() external view returns (address);
    function feeRouter() external view returns (address);
    function treasury() external view returns (address);
    function ammEngine() external view returns (ICPMMEngine);
    function paused() external view returns (bool);

    function initializeLiquidity(uint256 _initialCollateral, uint16 _initialPriceYesBps) external;

    function quoteBuyYes(uint256 collateralIn)
        external
        view
        returns (uint256 sharesOut, uint256 fee, uint256 priceImpactBps);

    function quoteBuyNo(uint256 collateralIn)
        external
        view
        returns (uint256 sharesOut, uint256 fee, uint256 priceImpactBps);

    function quoteSellYes(uint256 sharesIn)
        external
        view
        returns (uint256 collateralOut, uint256 fee, uint256 priceImpactBps);

    function quoteSellNo(uint256 sharesIn)
        external
        view
        returns (uint256 collateralOut, uint256 fee, uint256 priceImpactBps);

    function getPrices() external view returns (uint256 pYes, uint256 pNo);
    function getUserPosition(address user)
        external
        view
        returns (uint256 _yesShares, uint256 _noShares, bool _claimed);

    function buyYes(uint256 collateralIn, uint256 minSharesOut) external;
    function buyNo(uint256 collateralIn, uint256 minSharesOut) external;
    function sellYes(uint256 sharesIn, uint256 minCollateralOut) external;
    function sellNo(uint256 sharesIn, uint256 minCollateralOut) external;

    function resolveByAdmin(Outcome _outcome, string calldata _evidenceURI) external;
    function cancel(string calldata reason, string calldata _evidenceURI) external;
    function markInvalid(string calldata reason, string calldata _evidenceURI) external;

    function claim() external;
    function refund() external;
    function refundTreasury() external;

    function pause() external;
    function unpause() external;
    function setAmmEngine(address _ammEngine) external;
    function setMarketId(uint256 _marketId) external;
}
