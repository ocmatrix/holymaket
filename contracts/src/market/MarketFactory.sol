// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {BinaryPredictionMarket} from "./BinaryPredictionMarket.sol";

contract MarketFactory is AccessControl {
    bytes32 public constant MARKET_CREATOR_ROLE = keccak256("MARKET_CREATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint256 public nextMarketId;
    mapping(uint256 => address) public markets;
    mapping(address => bool) public collateralAllowed;

    uint16 public systemMaxFeeBps;
    uint16 public systemMaxSlippageBps;
    uint16 public tradeCapBps;
    uint256 public minInitialCollateral;
    uint16 public minInitialPriceYesBps;
    uint16 public maxInitialPriceYesBps;

    address public resolver;
    address public feeRouter;
    address public treasury;

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

    constructor(
        uint16 _systemMaxFeeBps,
        uint16 _systemMaxSlippageBps,
        uint16 _tradeCapBps,
        uint256 _minInitialCollateral,
        uint16 _minInitialPriceYesBps,
        uint16 _maxInitialPriceYesBps,
        address _resolver,
        address _feeRouter,
        address _treasury
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MARKET_CREATOR_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        systemMaxFeeBps = _systemMaxFeeBps;
        systemMaxSlippageBps = _systemMaxSlippageBps;
        tradeCapBps = _tradeCapBps;
        minInitialCollateral = _minInitialCollateral;
        minInitialPriceYesBps = _minInitialPriceYesBps;
        maxInitialPriceYesBps = _maxInitialPriceYesBps;
        resolver = _resolver;
        feeRouter = _feeRouter;
        treasury = _treasury;
    }

    function createMarket(CreateMarketParams calldata p)
        external
        onlyRole(MARKET_CREATOR_ROLE)
        returns (uint256 marketId, address marketAddress)
    {
        require(collateralAllowed[p.collateral], CollateralNotWhitelisted(p.collateral));
        require(p.initialPriceYesBps >= minInitialPriceYesBps && p.initialPriceYesBps <= maxInitialPriceYesBps,
            InvalidPriceBps(p.initialPriceYesBps, minInitialPriceYesBps, maxInitialPriceYesBps));
        require(p.initialCollateral >= minInitialCollateral,
            InsufficientLiquidity(p.initialCollateral, minInitialCollateral));
        require(p.feeBps <= systemMaxFeeBps, InvalidFeeBps(p.feeBps, systemMaxFeeBps));
        require(p.maxSlippageBps <= systemMaxSlippageBps, "slippage exceeds max");
        require(p.maxTradeAmount <= p.initialCollateral * tradeCapBps / 10000,
            TradeLimitExceeded(p.maxTradeAmount, p.initialCollateral));
        require(p.startTime < p.endTime, "invalid time range");

        BinaryPredictionMarket newMarket = new BinaryPredictionMarket(
            p.question,
            p.metadataURI,
            p.collateral,
            p.startTime,
            p.endTime,
            p.initialCollateral,
            p.initialPriceYesBps,
            p.minTradeAmount,
            p.maxTradeAmount,
            p.maxSlippageBps,
            p.feeBps,
            resolver,
            feeRouter,
            treasury
        );

        marketId = nextMarketId;
        markets[marketId] = address(newMarket);
        marketAddress = address(newMarket);
        nextMarketId++;

        emit MarketCreated(
            marketId, marketAddress, msg.sender,
            p.question, p.collateral, p.startTime, p.endTime,
            p.initialCollateral, p.initialPriceYesBps
        );
    }

    function getMarket(uint256 marketId) external view returns (address) {
        require(marketId < nextMarketId, "not found");
        return markets[marketId];
    }

    function setCollateralAllowed(address collateral, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        collateralAllowed[collateral] = allowed;
    }

    function setResolver(address _resolver) external onlyRole(DEFAULT_ADMIN_ROLE) {
        resolver = _resolver;
    }

    function setFeeRouter(address _feeRouter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        feeRouter = _feeRouter;
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        treasury = _treasury;
    }
}
