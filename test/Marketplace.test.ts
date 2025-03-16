import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers";
import { Martketplace } from "../typechain-types/contracts/Martketplace";
import { NFT } from "../typechain-types/contracts/NFT";
import { Signer } from "ethers";
import { Log } from "ethers";

const PLATFORM_FEE = 250n;
const PLATFORM_FEE_DENOMINATOR = 10000n;

describe("Marketplace", function () {
  let marketplace: Martketplace;
  let nft: NFT;
  let owner: Signer;
  let seller: Signer;
  let buyer: Signer;
  const TOKEN_URI = "https://example.com/token/1";
  const LISTING_PRICE = parseEther("1.0"); // 1 ETH

  beforeEach(async function () {
    // Get signers
    [owner, seller, buyer] = await ethers.getSigners();

    // Deploy NFT contract
    const NFT = await ethers.getContractFactory("NFT");
    nft = await NFT.deploy(await owner.getAddress(), "Test NFT", "TNFT");
    await nft.waitForDeployment();

    // Deploy Marketplace contract
    const Martketplace = await ethers.getContractFactory("Martketplace");
    marketplace = await Martketplace.deploy(await owner.getAddress());
    await marketplace.waitForDeployment();

    // Mint an NFT for the seller
    await nft.connect(seller).mint(TOKEN_URI, { value: parseEther("0.01") });
  });

  describe("Listing NFTs", function () {
    beforeEach(async function () {
      // Approve marketplace to transfer NFT
      await nft.connect(seller).approve(await marketplace.getAddress(), 0);
    });

    it("Should list an NFT and emit Listed event", async function () {
      const tx = await marketplace.connect(seller).listNFT(
        await nft.getAddress(),
        0,
        LISTING_PRICE
      );
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed");
      
      // Naivly check if the event was emitted
      expect(receipt.logs.length).to.be.greaterThan(0);
      
      // Check if the NFT ownership transferred to marketplace
      expect(await nft.ownerOf(0)).to.equal(await marketplace.getAddress());

      // Verify listing details
      const listing = await marketplace.listings(0);
      expect(listing.seller).to.equal(await seller.getAddress());
      expect(listing.tokenAddress).to.equal(await nft.getAddress());
      expect(listing.tokenId).to.equal(0);
      expect(listing.price).to.equal(LISTING_PRICE);
      expect(listing.isActive).to.be.true;
    });

    it("Should revert if price is zero", async function () {
      await expect(
        marketplace.connect(seller).listNFT(await nft.getAddress(), 0, 0)
      ).to.be.revertedWith("Price must be greater than 0");
    });

    it("Should revert if not token owner", async function () {
      await expect(
        marketplace.connect(buyer).listNFT(await nft.getAddress(), 0, LISTING_PRICE)
      ).to.be.revertedWith("Not token owner");
    });
  });

  describe("Buying NFTs", function () {
    beforeEach(async function () {
      // List NFT
      await nft.connect(seller).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(seller).listNFT(
        await nft.getAddress(),
        0,
        LISTING_PRICE
      );
    });

    it("Should buy NFT and distribute funds correctly", async function () {
      const platformFee = (LISTING_PRICE * PLATFORM_FEE) / PLATFORM_FEE_DENOMINATOR;
      const sellerAmount = LISTING_PRICE - platformFee;

      console.log("platformFee", platformFee);
      console.log("sellerAmount", sellerAmount);

      // Get initial balances
      const initialSellerBalance = await ethers.provider.getBalance(await seller.getAddress());
      const initialMarketplaceBalance = await ethers.provider.getBalance(await marketplace.getAddress());

      // Buy NFT
      await marketplace.connect(buyer).buyNFT(0, { value: LISTING_PRICE });

      // Check NFT ownership
      expect(await nft.ownerOf(0)).to.equal(await buyer.getAddress());

      // Check balances
      const finalSellerBalance = await ethers.provider.getBalance(await seller.getAddress());
      const finalMarketplaceBalance = await ethers.provider.getBalance(await marketplace.getAddress());

      //console.log("finalSellerBalance", finalSellerBalance);
      //console.log("initialSellerBalance", initialSellerBalance);
      //console.log("finalSellerBalance - initialSellerBalance", finalSellerBalance - initialSellerBalance);
      //console.log("finalMarketplaceBalance", finalMarketplaceBalance);
      //console.log("initialMarketplaceBalance", initialMarketplaceBalance);

      expect(finalSellerBalance - initialSellerBalance).to.equal(sellerAmount);
      expect(finalMarketplaceBalance - initialMarketplaceBalance).to.equal(platformFee);

      // Check listing status
      const listing = await marketplace.listings(0);
      expect(listing.isActive).to.be.false;
    });

    it("Should refund excess payment", async function () {
      const excessAmount = parseEther("0.5");
      const paymentAmount = LISTING_PRICE + excessAmount;
      
      const initialBuyerBalance = await ethers.provider.getBalance(await buyer.getAddress());
      
      const tx = await marketplace.connect(buyer).buyNFT(0, { value: paymentAmount });
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed");
      
      const finalBuyerBalance = await ethers.provider.getBalance(await buyer.getAddress());
      const gasUsedPrice = receipt.gasUsed * receipt.gasPrice;
      
      // Buyer should get back excess minus gas fees
      const expectedBalance = initialBuyerBalance - LISTING_PRICE - gasUsedPrice;
      expect(finalBuyerBalance).to.be.closeTo(expectedBalance, 1000000n);
    });

    it("Should revert if payment is insufficient", async function () {
      const insufficientAmount = LISTING_PRICE - parseEther("0.1");
      await expect(
        marketplace.connect(buyer).buyNFT(0, { value: insufficientAmount })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should revert if listing is not active", async function () {
      // Buy NFT first time
      await marketplace.connect(buyer).buyNFT(0, { value: LISTING_PRICE });

      // Try to buy again
      await expect(
        marketplace.connect(buyer).buyNFT(0, { value: LISTING_PRICE })
      ).to.be.revertedWith("Listing is not active");
    });
  });

  describe("Canceling Listings", function () {
    beforeEach(async function () {
      // List NFT
      await nft.connect(seller).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(seller).listNFT(
        await nft.getAddress(),
        0,
        LISTING_PRICE
      );
    });

    it("Should cancel listing and return NFT", async function () {
      await marketplace.connect(seller).cancelListing(0);

      // Check NFT returned to seller
      expect(await nft.ownerOf(0)).to.equal(await seller.getAddress());

      // Check listing status
      const listing = await marketplace.listings(0);
      expect(listing.isActive).to.be.false;
    });

    it("Should revert if not the seller", async function () {
      await expect(
        marketplace.connect(buyer).cancelListing(0)
      ).to.be.revertedWith("Only seller can cancel listing");
    });

    it("Should revert if listing is not active", async function () {
      await marketplace.connect(seller).cancelListing(0);
      await expect(
        marketplace.connect(seller).cancelListing(0)
      ).to.be.revertedWith("Listing is not active");
    });
  });

  describe("Updating Price", function () {
    beforeEach(async function () {
      // List NFT
      await nft.connect(seller).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(seller).listNFT(
        await nft.getAddress(),
        0,
        LISTING_PRICE
      );
    });

    it("Should update price and emit event", async function () {
      const newPrice = parseEther("2.0");
      const tx = await marketplace.connect(seller).updatePrice(0, newPrice);
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed");

      // Verify the event was emitted
      expect(receipt.logs.length).to.be.greaterThan(0);

      // Check listing price updated
      const listing = await marketplace.listings(0);
      expect(listing.price).to.equal(newPrice);
    });

    it("Should revert if not the seller", async function () {
      await expect(
        marketplace.connect(buyer).updatePrice(0, parseEther("2.0"))
      ).to.be.revertedWith("Only seller can update price");
    });

    it("Should revert if listing is not active", async function () {
      await marketplace.connect(seller).cancelListing(0);
      await expect(
        marketplace.connect(seller).updatePrice(0, parseEther("2.0"))
      ).to.be.revertedWith("Listing is not active");
    });

    it("Should revert if new price is zero", async function () {
      await expect(
        marketplace.connect(seller).updatePrice(0, 0)
      ).to.be.revertedWith("Price must be greater than 0");
    });
  });

  describe("Getting Active Listings", function () {
    it("Should return correct active listings", async function () {
      // List multiple NFTs
      for(let i = 0; i < 3; i++) {
        // Mint NFT
        await nft.connect(seller).mint(TOKEN_URI, { value: parseEther("0.01") });
        // Approve marketplace
        await nft.connect(seller).approve(await marketplace.getAddress(), i);
        // List NFT
        await marketplace.connect(seller).listNFT(
          await nft.getAddress(),
          i,
          LISTING_PRICE
        );
      }

      // Cancel one listing
      await marketplace.connect(seller).cancelListing(1);

      // Get active listings
      const activeListings = await marketplace.getActiveListings();

      // Should return [0, 2]
      expect(activeListings.length).to.equal(2);
      expect(activeListings).to.deep.equal([0n, 2n]);
    });
  });

  describe("Withdrawals", function () {
    it("Should allow the owner to withdraw funds", async function () {

      await nft.connect(seller).approve(await marketplace.getAddress(), 0);
      await marketplace.connect(seller).listNFT(
        await nft.getAddress(),
        0,
        LISTING_PRICE
      );

      await marketplace.connect(buyer).buyNFT(0, { value: LISTING_PRICE });

      const initialBalance = await ethers.provider.getBalance(await owner.getAddress());

      const platformFee = (LISTING_PRICE * PLATFORM_FEE) / PLATFORM_FEE_DENOMINATOR;

      const tx = await marketplace.withdrawFunds();
      const receipt = await tx.wait();
      if (!receipt) throw new Error("Transaction failed");
      const gasUsedPrice = receipt.gasUsed * receipt.gasPrice;

      const finalBalance = await ethers.provider.getBalance(await owner.getAddress());
      const expectedBalance = initialBalance + platformFee - gasUsedPrice;

     //console.log("finalBalance", finalBalance);
     //console.log("expectedBalance", expectedBalance );

      expect(expectedBalance).to.be.closeTo(finalBalance, 1000000n);
    });

    it("Should revert if non-owner tries to withdraw", async function () {

      const tx = marketplace.connect(seller).withdrawFunds();
      await expect(tx).to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
    });
  });
}); 