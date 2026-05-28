// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ITreasury {
    function sweep(address token, address to, uint256 amount) external;
    function setRecipient(address newRecipient) external;
    function recipient() external view returns (address);
    event TreasuryRecipientUpdated(address indexed newRecipient);
    event TreasurySwept(address indexed token, address indexed to, uint256 amount);
}
