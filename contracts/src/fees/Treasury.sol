// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract Treasury is AccessControl {
    bytes32 public constant TREASURY_ADMIN_ROLE = keccak256("TREASURY_ADMIN_ROLE");
    address public recipient;

    event TreasuryRecipientUpdated(address indexed newRecipient);
    event TreasurySwept(address indexed token, address indexed to, uint256 amount);

    constructor(address _recipient) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TREASURY_ADMIN_ROLE, msg.sender);
        recipient = _recipient;
    }

    function setRecipient(address newRecipient) external onlyRole(TREASURY_ADMIN_ROLE) {
        require(newRecipient != address(0), "zero address");
        recipient = newRecipient;
        emit TreasuryRecipientUpdated(newRecipient);
    }

    function sweep(address token, address to, uint256 amount) external onlyRole(TREASURY_ADMIN_ROLE) {
        require(to != address(0), "zero address");
        (bool success, ) = token.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        require(success, "transfer failed");
        emit TreasurySwept(token, to, amount);
    }
}
