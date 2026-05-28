// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract FeeRouter is AccessControl {
    bytes32 public constant FEE_ADMIN_ROLE = keccak256("FEE_ADMIN_ROLE");

    uint16 public protocolFeeBps;
    uint16 public immutable maxFeeBps;
    uint16 public systemMaxSlippageBps;
    uint16 public tradeCapBps;

    event ProtocolFeeUpdated(uint16 bps);
    event MaxSlippageUpdated(uint16 bps);
    event TradeCapUpdated(uint16 bps);

    constructor(
        uint16 _protocolFeeBps,
        uint16 _maxFeeBps,
        uint16 _systemMaxSlippageBps,
        uint16 _tradeCapBps
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FEE_ADMIN_ROLE, msg.sender);
        require(_protocolFeeBps <= _maxFeeBps, "fee exceeds max");
        protocolFeeBps = _protocolFeeBps;
        maxFeeBps = _maxFeeBps;
        systemMaxSlippageBps = _systemMaxSlippageBps;
        tradeCapBps = _tradeCapBps;
    }

    function setProtocolFeeBps(uint16 bps) external onlyRole(FEE_ADMIN_ROLE) {
        require(bps <= maxFeeBps, "exceeds max");
        protocolFeeBps = bps;
        emit ProtocolFeeUpdated(bps);
    }

    function setSystemMaxSlippageBps(uint16 bps) external onlyRole(FEE_ADMIN_ROLE) {
        systemMaxSlippageBps = bps;
        emit MaxSlippageUpdated(bps);
    }

    function setTradeCapBps(uint16 bps) external onlyRole(FEE_ADMIN_ROLE) {
        tradeCapBps = bps;
        emit TradeCapUpdated(bps);
    }
}
