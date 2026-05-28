// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract AdminOracleResolver is AccessControl {
    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");

    event ResolutionIssued(
        address indexed market, uint8 outcome, string evidenceURI, address indexed resolver
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RESOLVER_ROLE, msg.sender);
    }

    function resolveMarket(address market) external onlyRole(RESOLVER_ROLE) {
        require(market != address(0), "zero address");
        emit ResolutionIssued(market, 0, "", msg.sender);
    }

    function grantResolver(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(RESOLVER_ROLE, account);
    }

    function revokeResolver(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(RESOLVER_ROLE, account);
    }
}
