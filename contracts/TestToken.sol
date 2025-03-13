// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestToken is ERC20, Ownable {
    constructor(
        address initialOwner,
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(initialOwner) {
         _mint(initialOwner, initialSupply * 10 ** decimals());
    }

    function mint(uint256 amount) public onlyOwner {
      _mint(msg.sender, amount * 10 ** decimals());
    }
}
