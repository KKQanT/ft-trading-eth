// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Martketplace is ERC721Holder, Ownable, ReentrancyGuard {
  // Struct to store listing information
  struct Listing {
    address seller;
    address tokenAddress;
    uint256 tokenId;
    uint256 price;
    bool isActive;
  } 

  mapping(uint256 => Listing) public listings;

  uint256 private _listingIds;

  // Platform fee percentage (e.g., 250 = 2.5%)
  uint256 public constant PLATFORM_FEE = 250;
  uint256 public constant FEE_DENOMINATOR = 10000;

  // Events
  event Listed(
    uint256 indexed listingId,
    address indexed seller,
    address indexed tokenAddress,
    uint256 tokenId,
    uint256 price
  );

  event Saled(
    uint256 indexed listingId,
    address indexed seller,
    address indexed buyer,
    address tokenAddress,
    uint256 tokenId,
    uint256 price
  );

  event CanceledListing(
    uint256 indexed listingId
  );

  event UpdatedPrice(
    uint256 indexed listingId,
    uint256 price 
  );

  constructor(address initialOwner) Ownable(initialOwner) {}

  function listNFT(
    address tokenAddress,
    uint256 tokenId,
    uint256 price
  ) external nonReentrant {
    require(price > 0, "Price must be greater than 0");
    require(tokenAddress != address(0), "Invalid token address");

    IERC721 nft = IERC721(tokenAddress);
    require(nft.ownerOf(tokenId) == msg.sender, "Not token owner");

    // Transfer NFT to marketplace
    nft.safeTransferFrom(msg.sender, address(this), tokenId);

    uint256 listingId = _listingIds++;
    listings[listingId] = Listing({
      seller: msg.sender,
      tokenAddress: tokenAddress,
      tokenId: tokenId,
      price: price,
      isActive: true
    });

    emit Listed(listingId, msg.sender, tokenAddress, tokenId, price);
  }

  function buyNFT(uint256 listingId) external payable nonReentrant {
    Listing storage listing = listings[listingId];
    require(listing.isActive, "Listing is not active");
    require(msg.value >= listing.price, "Insufficient payment");

    //Transfer funds
    // Calculate platform fee
    uint256 platformFee = (listing.price * PLATFORM_FEE) / FEE_DENOMINATOR;
    uint256 ethToSeller = listing.price - platformFee;
    
    (bool success1, ) = payable(listing.seller).call{value: ethToSeller}("");
    require(success1, "Failed to send ETH to seller");

    // Refund excess payment
    if(msg.value > listing.price) {
      (bool success3, ) = payable(msg.sender).call{value: msg.value - listing.price}("");
      require(success3, "Failed to refund excess");
    }

    // Transfer NFT to buyer
    IERC721(listing.tokenAddress).safeTransferFrom(
      address(this),
      msg.sender,
      listing.tokenId
    );

    // Update listing status
    listing.isActive = false;

    emit Saled(
      listingId,
      listing.seller,
      msg.sender,
      listing.tokenAddress,
      listing.tokenId,
      listing.price
    );
    
  }

  function cancelListing(uint256 listingId) external nonReentrant {
    Listing storage listing = listings[listingId];
    require(listing.isActive, "Listing is not active");
    require(listing.seller == msg.sender, "Only seller can cancel listing");

    // Transfer NFT back to seller
    IERC721(listing.tokenAddress).safeTransferFrom(
      address(this),
      listing.seller,
      listing.tokenId
    );

    listing.isActive = false;
    emit CanceledListing(listingId);    
    
  }

  function updatePrice(uint256 listingId, uint256 newPrice) external nonReentrant {

    Listing storage listing = listings[listingId];

    require(listing.isActive, "Listing is not active");
    require(listing.seller == msg.sender, "Only seller can update price");

    require(newPrice > 0, "Price must be greater than 0");

    listing.price = newPrice;
    emit UpdatedPrice(listingId, newPrice);

  }

  function withdrawFunds() external onlyOwner() {
    (bool success, ) = payable(msg.sender).call{value: address(this).balance}("");
    require(success, "Failed to withdraw funds");
  }

  //TO DO: Paginate this
  function getActiveListings() external view returns (uint256[] memory) {
    uint256 activeCount = 0;

    for (uint256 i = 0; i < _listingIds; i++) {
      if (listings[i].isActive) {
        activeCount++;
      }
    }

    uint256[] memory activeListings = new uint256[](activeCount);
    uint256 currentIndex = 0;

    for (uint256 i = 0; i < _listingIds; i++) {
      if (listings[i].isActive) {
        activeListings[currentIndex] = i;
        currentIndex++;
      }
    }

    return activeListings;
  }
}