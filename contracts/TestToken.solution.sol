// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestToken is ERC20, Ownable {
    constructor(address initialOwner) 
        ERC20("Test Token", "TEST") 
        Ownable(initialOwner)
    {
        // Mint initial supply to the contract creator
        _mint(initialOwner, 1000000 * 10 ** decimals());
    }

    // Function to mint new tokens (only owner can call)
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
} 