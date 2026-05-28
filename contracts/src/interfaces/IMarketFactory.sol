// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IMarketFactory is IAccessControl, IERC165 {
    struct CreateMarketParams {
        string question;
        string metadataURI;
        address collateral;
        uint64 startTime;
        uint64 endTime;
        uint256 initialCollateral;
        uint16 initialPriceYesBps;
        uint256 minTradeAmount;
        uint256 maxTradeAmount;
        uint16 maxSlippageBps;
        uint16 feeBps;
    }

    event MarketCreated(
        uint256 indexed marketId,
        address indexed marketAddress,
        address indexed creator,
        string question,
        address collateral,
        uint64 startTime,
        uint64 endTime,
        uint256 initialCollateral,
        uint16 initialPriceYesBps
    );

    error InsufficientLiquidity(uint256 provided, uint256 required);
    error InvalidPriceBps(uint16 provided, uint16 min, uint16 max);
    error CollateralNotWhitelisted(address collateral);
    error InvalidFeeBps(uint16 provided, uint16 max);
    error TradeLimitExceeded(uint256 maxTrade, uint256 poolLiquidity);
    error ZeroInitialCollateral();
    error ZeroCollateralAddress();

    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);
    function MARKET_CREATOR_ROLE() external view returns (bytes32);
    function PAUSER_ROLE() external view returns (bytes32);

    function nextMarketId() external view returns (uint256);
    function markets(uint256 marketId) external view returns (address);
    function collateralAllowed(address collateral) external view returns (bool);

    function systemMaxFeeBps() external view returns (uint16);
    function systemMaxSlippageBps() external view returns (uint16);
    function tradeCapBps() external view returns (uint16);
    function minInitialCollateral() external view returns (uint256);
    function minInitialPriceYesBps() external view returns (uint16);
    function maxInitialPriceYesBps() external view returns (uint16);

    function resolver() external view returns (address);
    function feeRouter() external view returns (address);
    function treasury() external view returns (address);

    function createMarket(CreateMarketParams calldata p)
        external
        returns (uint256 marketId, address marketAddress);

    function getMarket(uint256 marketId) external view returns (address);

    function setCollateralAllowed(address collateral, bool allowed) external;
    function setResolver(address _resolver) external;
    function setFeeRouter(address _feeRouter) external;
    function setTreasury(address _treasury) external;
}
