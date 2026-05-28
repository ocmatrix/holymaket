// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ICPMMEngine} from "../interfaces/ICPMMEngine.sol";

contract BinaryPredictionMarket is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    enum Outcome { Unset, Yes, No, Cancelled, Invalid }
    enum MarketStatus { Active, Paused, Resolved, Cancelled, Invalid }

    uint256 public marketId;
    string public question;
    string public metadataURI;
    IERC20 public collateral;
    uint64 public startTime;
    uint64 public endTime;
    uint16 public feeBps;
    uint16 public maxSlippageBps;
    uint256 public minTradeAmount;
    uint256 public maxTradeAmount;

    Outcome public outcome;
    MarketStatus public status;
    string public evidenceURI;
    uint64 public resolvedAt;
    uint64 public refundWindow;

    uint256 public collateralLocked;
    uint256 public pairSupply;
    uint256 public totalYesSupply;
    uint256 public totalNoSupply;
    uint256 public R_yes;
    uint256 public R_no;
    uint256 public totalUserYesShares;
    uint256 public totalUserNoShares;
    uint256 public totalFeesCollected;

    mapping(address => uint256) public yesShares;
    mapping(address => uint256) public noShares;
    mapping(address => bool) public claimedFinalPayout;

    uint256 public treasuryYes;
    uint256 public treasuryNo;

    address public resolver;
    address public feeRouter;
    address public treasury;

    ICPMMEngine public ammEngine;

    event LiquidityInitialized(uint256 initialCollateral, uint16 initialPriceYesBps);
    event PositionBought(
        uint256 indexed marketId, address indexed user, uint8 side,
        uint256 collateralIn, uint256 sharesOut, uint256 fee, uint256 priceAfter
    );
    event PositionSold(
        uint256 indexed marketId, address indexed user, uint8 side,
        uint256 sharesIn, uint256 collateralOut, uint256 fee, uint256 priceAfter
    );
    event MarketResolved(
        uint256 indexed marketId, Outcome outcome, address indexed resolver, string evidenceURI
    );
    event RewardClaimed(uint256 indexed marketId, address indexed user, uint256 payout);
    event TreasuryRefundClaimed(uint256 indexed marketId, uint256 refundAmount);
    event RefundClaimed(
        uint256 indexed marketId, address indexed user, uint256 yesShares, uint256 noShares, uint256 refundAmount
    );
    event FeeCollected(uint256 indexed marketId, uint256 amount, address indexed to);
    event MarketPaused(uint256 indexed marketId);
    event MarketUnpaused(uint256 indexed marketId);
    event ReservesUpdated(uint256 indexed marketId, uint256 yes, uint256 no);

    constructor(
        string memory _question,
        string memory _metadataURI,
        address _collateral,
        uint64 _startTime,
        uint64 _endTime,
        uint256 _initialCollateral,
        uint16 _initialPriceYesBps,
        uint256 _minTradeAmount,
        uint256 _maxTradeAmount,
        uint16 _maxSlippageBps,
        uint16 _feeBps,
        address _resolver,
        address _feeRouter,
        address _treasury
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RESOLVER_ROLE, _resolver);
        _grantRole(ADMIN_ROLE, msg.sender);

        question = _question;
        metadataURI = _metadataURI;
        collateral = IERC20(_collateral);
        startTime = _startTime;
        endTime = _endTime;
        feeBps = _feeBps;
        maxSlippageBps = _maxSlippageBps;
        minTradeAmount = _minTradeAmount;
        maxTradeAmount = _maxTradeAmount;
        resolver = _resolver;
        feeRouter = _feeRouter;
        treasury = _treasury;

        _initializeLiquidity(_initialCollateral, _initialPriceYesBps);
    }

    function _initializeLiquidity(uint256 _initialCollateral, uint16 _initialPriceYesBps) internal {
        uint256 p = uint256(_initialPriceYesBps) * 1e18 / 10000;
        R_no = _initialCollateral * p / 1e18;
        R_yes = _initialCollateral - R_no;

        pairSupply = _initialCollateral;
        totalYesSupply = _initialCollateral;
        totalNoSupply = _initialCollateral;
        collateralLocked = _initialCollateral;

        treasuryYes = totalYesSupply - R_yes;
        treasuryNo = totalNoSupply - R_no;

        status = MarketStatus.Active;
        refundWindow = uint64(6 hours);

        emit LiquidityInitialized(_initialCollateral, _initialPriceYesBps);
        emit ReservesUpdated(0, R_yes, R_no);
    }

    modifier onlyActive() {
        require(status == MarketStatus.Active, "not active");
        require(block.timestamp >= startTime, "not started");
        require(block.timestamp < endTime, "ended");
        _;
    }

    modifier onlyResolver() {
        require(hasRole(RESOLVER_ROLE, msg.sender), "not resolver");
        _;
    }

    // --- Quote functions ---

    function quoteBuyYes(uint256 collateralIn) external view returns (
        uint256 sharesOut, uint256 fee, uint256 priceImpactBps
    ) {
        (sharesOut, fee, , , priceImpactBps) = ammEngine.quoteBuyYes(collateralIn, R_yes, R_no, feeBps);
    }

    function quoteBuyNo(uint256 collateralIn) external view returns (
        uint256 sharesOut, uint256 fee, uint256 priceImpactBps
    ) {
        (sharesOut, fee, , , priceImpactBps) = ammEngine.quoteBuyNo(collateralIn, R_yes, R_no, feeBps);
    }

    function quoteSellYes(uint256 sharesIn) external view returns (
        uint256 collateralOut, uint256 fee, uint256 priceImpactBps
    ) {
        (collateralOut, fee, , , priceImpactBps) = ammEngine.quoteSellYes(sharesIn, R_yes, R_no, feeBps);
    }

    function quoteSellNo(uint256 sharesIn) external view returns (
        uint256 collateralOut, uint256 fee, uint256 priceImpactBps
    ) {
        (collateralOut, fee, , , priceImpactBps) = ammEngine.quoteSellNo(sharesIn, R_yes, R_no, feeBps);
    }

    function getPrices() external view returns (uint256 pYes, uint256 pNo) {
        (pYes, pNo) = ammEngine.getSpotPrice(R_yes, R_no);
    }

    function getUserPosition(address user) external view returns (
        uint256 _yesShares, uint256 _noShares, bool _claimed
    ) {
        _yesShares = yesShares[user];
        _noShares = noShares[user];
        _claimed = claimedFinalPayout[user];
    }

    // --- Trading ---

    function buyYes(uint256 collateralIn, uint256 minSharesOut) external nonReentrant whenNotPaused onlyActive {
        require(collateralIn >= minTradeAmount && collateralIn <= maxTradeAmount, "trade size");
        (uint256 sharesOut, uint256 fee, uint256 newRYes, uint256 newRNo, ) =
            ammEngine.quoteBuyYes(collateralIn, R_yes, R_no, feeBps);
        require(sharesOut >= minSharesOut, "slippage");

        uint256 net = collateralIn - fee;
        collateral.safeTransferFrom(msg.sender, treasury, fee);
        collateral.safeTransferFrom(msg.sender, address(this), net);
        totalFeesCollected += fee;

        collateralLocked += net;
        pairSupply += net;
        totalYesSupply += net;
        totalNoSupply += net;

        R_yes = newRYes;
        R_no = newRNo;

        yesShares[msg.sender] += sharesOut;
        totalUserYesShares += sharesOut;

        uint256 priceAfter = (R_no * 10000) / (R_yes + R_no);
        emit PositionBought(0, msg.sender, 1, collateralIn, sharesOut, fee, priceAfter);
        emit FeeCollected(0, fee, treasury);
        emit ReservesUpdated(0, R_yes, R_no);
    }

    function buyNo(uint256 collateralIn, uint256 minSharesOut) external nonReentrant whenNotPaused onlyActive {
        require(collateralIn >= minTradeAmount && collateralIn <= maxTradeAmount, "trade size");
        (uint256 sharesOut, uint256 fee, uint256 newRYes, uint256 newRNo, ) =
            ammEngine.quoteBuyNo(collateralIn, R_yes, R_no, feeBps);
        require(sharesOut >= minSharesOut, "slippage");

        uint256 net = collateralIn - fee;
        collateral.safeTransferFrom(msg.sender, treasury, fee);
        collateral.safeTransferFrom(msg.sender, address(this), net);
        totalFeesCollected += fee;

        collateralLocked += net;
        pairSupply += net;
        totalYesSupply += net;
        totalNoSupply += net;

        R_yes = newRYes;
        R_no = newRNo;

        noShares[msg.sender] += sharesOut;
        totalUserNoShares += sharesOut;

        uint256 priceAfter = (R_yes * 10000) / (R_yes + R_no);
        emit PositionBought(0, msg.sender, 2, collateralIn, sharesOut, fee, priceAfter);
        emit FeeCollected(0, fee, treasury);
        emit ReservesUpdated(0, R_yes, R_no);
    }

    function sellYes(uint256 sharesIn, uint256 minCollateralOut) external nonReentrant whenNotPaused onlyActive {
        require(sharesIn >= minTradeAmount && sharesIn <= maxTradeAmount, "trade size");
        require(yesShares[msg.sender] >= sharesIn, "insufficient shares");
        (uint256 collateralOut, uint256 fee, uint256 newRYes, uint256 newRNo, ) =
            ammEngine.quoteSellYes(sharesIn, R_yes, R_no, feeBps);
        require(collateralOut >= minCollateralOut, "slippage");

        yesShares[msg.sender] -= sharesIn;
        totalUserYesShares -= sharesIn;
        R_yes = newRYes;
        R_no = newRNo;

        uint256 y = sharesIn - (newRYes - (R_yes - newRYes)); // reconstructed for event

        pairSupply -= sharesIn;
        totalYesSupply -= sharesIn;
        totalNoSupply -= sharesIn;
        collateralLocked -= sharesIn;

        collateral.safeTransfer(msg.sender, collateralOut);
        collateral.safeTransfer(treasury, fee);
        totalFeesCollected += fee;

        uint256 priceAfter = (R_no * 10000) / (R_yes + R_no);
        emit PositionSold(0, msg.sender, 1, sharesIn, collateralOut, fee, priceAfter);
        emit FeeCollected(0, fee, treasury);
        emit ReservesUpdated(0, R_yes, R_no);
    }

    function sellNo(uint256 sharesIn, uint256 minCollateralOut) external nonReentrant whenNotPaused onlyActive {
        require(sharesIn >= minTradeAmount && sharesIn <= maxTradeAmount, "trade size");
        require(noShares[msg.sender] >= sharesIn, "insufficient shares");
        (uint256 collateralOut, uint256 fee, uint256 newRYes, uint256 newRNo, ) =
            ammEngine.quoteSellNo(sharesIn, R_yes, R_no, feeBps);
        require(collateralOut >= minCollateralOut, "slippage");

        noShares[msg.sender] -= sharesIn;
        totalUserNoShares -= sharesIn;
        R_yes = newRYes;
        R_no = newRNo;

        uint256 y = sharesIn - (newRNo - (R_no - newRNo)); // reconstructed for event

        pairSupply -= sharesIn;
        totalYesSupply -= sharesIn;
        totalNoSupply -= sharesIn;
        collateralLocked -= sharesIn;

        collateral.safeTransfer(msg.sender, collateralOut);
        collateral.safeTransfer(treasury, fee);
        totalFeesCollected += fee;

        uint256 priceAfter = (R_yes * 10000) / (R_yes + R_no);
        emit PositionSold(0, msg.sender, 2, sharesIn, collateralOut, fee, priceAfter);
        emit FeeCollected(0, fee, treasury);
        emit ReservesUpdated(0, R_yes, R_no);
    }

    // --- Resolution ---

    function resolveByAdmin(Outcome _outcome, string calldata _evidenceURI) external onlyResolver {
        require(status == MarketStatus.Active || status == MarketStatus.Paused, "not active");
        require(_outcome == Outcome.Yes || _outcome == Outcome.No, "invalid outcome");
        outcome = _outcome;
        evidenceURI = _evidenceURI;
        status = MarketStatus.Resolved;
        resolvedAt = uint64(block.timestamp);
        emit MarketResolved(0, outcome, msg.sender, _evidenceURI);
    }

    function cancel(string calldata reason, string calldata _evidenceURI) external onlyResolver {
        require(status == MarketStatus.Active || status == MarketStatus.Paused, "not active");
        outcome = Outcome.Cancelled;
        evidenceURI = _evidenceURI;
        status = MarketStatus.Cancelled;
        resolvedAt = uint64(block.timestamp);
        emit MarketResolved(0, outcome, msg.sender, _evidenceURI);
    }

    function markInvalid(string calldata reason, string calldata _evidenceURI) external onlyResolver {
        require(status == MarketStatus.Active || status == MarketStatus.Paused, "not active");
        outcome = Outcome.Invalid;
        evidenceURI = _evidenceURI;
        status = MarketStatus.Invalid;
        resolvedAt = uint64(block.timestamp);
        emit MarketResolved(0, outcome, msg.sender, _evidenceURI);
    }

    // --- Claims ---

    function claim() external nonReentrant {
        require(status == MarketStatus.Resolved, "not resolved");
        require(!claimedFinalPayout[msg.sender], "already claimed");
        require(outcome == Outcome.Yes || outcome == Outcome.No, "not binary outcome");
        claimedFinalPayout[msg.sender] = true;

        uint256 payout;
        if (outcome == Outcome.Yes) {
            payout = yesShares[msg.sender];
            yesShares[msg.sender] = 0;
        } else {
            payout = noShares[msg.sender];
            noShares[msg.sender] = 0;
        }

        if (payout > 0) {
            collateral.safeTransfer(msg.sender, payout);
        }
        emit RewardClaimed(0, msg.sender, payout);
    }

    function refund() external nonReentrant {
        require(status == MarketStatus.Cancelled || status == MarketStatus.Invalid, "not refundable");
        require(!claimedFinalPayout[msg.sender], "already claimed");
        require(block.timestamp <= uint256(resolvedAt) + uint256(refundWindow), "refund window closed");

        uint256 y = yesShares[msg.sender];
        uint256 n = noShares[msg.sender];
        uint256 refundAmount = (y + n) / 2;

        yesShares[msg.sender] = 0;
        noShares[msg.sender] = 0;
        totalUserYesShares -= y;
        totalUserNoShares -= n;

        claimedFinalPayout[msg.sender] = true;

        if (refundAmount > 0) {
            collateral.safeTransfer(msg.sender, refundAmount);
        }
        emit RefundClaimed(0, msg.sender, y, n, refundAmount);
    }

    function refundTreasury() external {
        require(msg.sender == treasury, "only treasury");
        require(status == MarketStatus.Cancelled || status == MarketStatus.Invalid, "not refundable");
        require(block.timestamp > uint256(resolvedAt) + uint256(refundWindow), "refund window active");

        uint256 treasuryRefund = collateral.balanceOf(address(this));

        treasuryYes = 0;
        treasuryNo = 0;
        R_yes = 0;
        R_no = 0;
        collateralLocked = 0;
        pairSupply = 0;
        totalYesSupply = 0;
        totalNoSupply = 0;

        if (treasuryRefund > 0) {
            collateral.safeTransfer(treasury, treasuryRefund);
        }
        emit TreasuryRefundClaimed(0, treasuryRefund);
    }

    // --- Admin ---

    function pause() external onlyRole(ADMIN_ROLE) {
        require(status == MarketStatus.Active, "not active");
        status = MarketStatus.Paused;
        _pause();
        emit MarketPaused(0);
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        require(status == MarketStatus.Paused, "not paused");
        status = MarketStatus.Active;
        _unpause();
        emit MarketUnpaused(0);
    }

    function setAmmEngine(address _ammEngine) external onlyRole(ADMIN_ROLE) {
        ammEngine = ICPMMEngine(_ammEngine);
    }

    function setMarketId(uint256 _marketId) external onlyRole(ADMIN_ROLE) {
        require(marketId == 0, "already set");
        marketId = _marketId;
    }
}
