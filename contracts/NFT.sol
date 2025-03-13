// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


contract NFT is ERC721, ERC721URIStorage, ERC721Enumerable, Ownable, ReentrancyGuard {
    uint256 private _tokenIds;
    uint256 public constant MINP_PRICE = 0.01 ether;
    uint256 public constant MAX_SUPPLY = 10000;

    event NFTMinted(address indexed to, uint256 indexed tokenId, string uri);

    constructor(address initialOwner, string memory name, string memory symbol)
        ERC721(name, symbol)
        Ownable(initialOwner)
    {}

    function mint(string memory uri) public payable nonReentrant {
        //check if user has paid enough
        require(msg.value >= MINP_PRICE, "Invalid payment amount! contract requires 0.01 ether");

        require(_tokenIds < MAX_SUPPLY, "Max supply reached");

        uint256 tokenId = _tokenIds++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);

        emit NFTMinted(msg.sender, tokenId, uri);   
        
        //prevent user from transfering excess payment
        if (msg.value > MINP_PRICE) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - MINP_PRICE}("");
            require(success, "Refund failed");
        }
    }

    function ownerMint(address to, string memory uri) public onlyOwner nonReentrant {
        require(_tokenIds < MAX_SUPPLY, "Max supply reached");

        uint256 tokenId = _tokenIds++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit NFTMinted(to, tokenId, uri);
    }

    //withdraw contract balance
    function withdraw() public onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    // Required overrides 
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    // Required overrides 
    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    // Required overrides 
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    // Required overrides 
    function supportsInterface(bytes4 interfaceId)  
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
