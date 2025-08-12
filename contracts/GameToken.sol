// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameToken is ERC20, Ownable {
    address public tokenStore;

    constructor() ERC20("Game Token", "GT") Ownable(msg.sender) {}

    modifier onlyTokenStore() {
        require(msg.sender == tokenStore, "Not TokenStore");
        _;
    }

    function setTokenStore(address _store) external onlyOwner {
        tokenStore = _store;
    }

    function mint(address to, uint256 amount) external onlyTokenStore {
        _mint(to, amount);
    }
}
