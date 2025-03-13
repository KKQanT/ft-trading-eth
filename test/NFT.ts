import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers";
import { Signer } from "ethers";
import { NFT } from "../typechain-types/contracts/NFT";
import { NFTMintedEvent } from "../typechain-types/contracts/NFT";

describe("NFT Contract", function () {
  let nft: NFT;
  let owner: Signer;
  let addr1: Signer;
  let addr2: Signer;

  beforeEach(async function () {
    const NFT = await ethers.getContractFactory("NFT");
    [owner, addr1, addr2] = await ethers.getSigners();
    nft = await NFT.deploy(await owner.getAddress(), "NFT Collection", "NFT");
    await nft.waitForDeployment();
  });

  describe("Minting NFTs", function () {
    it("Should mint an NFT and emit an event", async function () {
      const tokenURI = "https://example.com/token/1";
      const mintPrice = parseEther("0.01");

      const tx = await nft.connect(addr1).mint(tokenURI, { value: mintPrice });
      const receipt = await tx.wait();

      // Get the NFTMinted event from the receipt
      const nftMintedEvent = (await nft.queryFilter(nft.filters.NFTMinted(), receipt.blockNumber, receipt.blockNumber))?.[0];

      // Type-safe assertions
      expect(nftMintedEvent).to.exist;
      expect(nftMintedEvent.args.to).to.equal(await addr1.getAddress());
      expect(nftMintedEvent.args.tokenId).to.equal(0n);
      expect(nftMintedEvent.args.uri).to.equal(tokenURI);

      const actualOwner = await nft.ownerOf(0);
      const expectedOwner = await addr1.getAddress();

      const actualTokenURI = await nft.tokenURI(0);
      const expectedTokenURI = tokenURI;

      expect(actualOwner).to.equal(expectedOwner);
      expect(actualTokenURI).to.equal(expectedTokenURI);
    });

    it("Should revert if payment is less than the minimum price", async function () {
      const tokenURI = "https://example.com/token/1";
      const mintPrice = parseEther("0.005"); // Less than MINT_PRICE
      const tx = nft.connect(addr1).mint(tokenURI, { value: mintPrice });
      await expect(tx).to.be.revertedWith("Invalid payment amount! contract requires 0.01 ether");
    });

    it("Should revert if max supply is reached", async function () {
      const tokenURI = "https://example.com/token/1";
      const mintPrice = parseEther("0.01");

      // Mint up to max supply
      for (let i = 0; i < 10000; i++) {
        await nft.connect(addr1).mint(`${tokenURI}/${i}`, { value: mintPrice });
      }

      const tx = nft.connect(addr1).mint(tokenURI, { value: mintPrice });
      await expect(tx).to.be.revertedWith("Max supply reached");
    });
  });

  describe("Owner Minting", function () {
    it("Should allow the owner to mint an NFT", async function () {
      const tokenURI = "https://example.com/token/owner";
      await nft.ownerMint(await addr2.getAddress(), tokenURI);

      const actualOwner = await nft.ownerOf(0);
      const expectedOwner = await addr2.getAddress();

      const actualTokenURI = await nft.tokenURI(0);
      const expectedTokenURI = tokenURI;  

      expect(actualOwner).to.equal(expectedOwner);
      expect(actualTokenURI).to.equal(expectedTokenURI);
    });

    it("Should revert if non-owner tries to mint", async function () {
      const tokenURI = "https://example.com/token/owner";
      const tx = nft.connect(addr1).ownerMint(await addr2.getAddress(), tokenURI);
      await expect(tx).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });
  });

  describe("Withdrawals", function () {
    it("Should allow the owner to withdraw funds", async function () {

      const initialBalance = await ethers.provider.getBalance(await owner.getAddress());

      const mintPrice = parseEther("0.01");
      await nft.connect(addr1).mint("https://example.com/token/1", { value: mintPrice });
      await nft.connect(addr2).mint("https://example.com/token/2", { value: mintPrice });

      await nft.withdraw();

      const finalBalance = await ethers.provider.getBalance(await owner.getAddress());
      expect(finalBalance - initialBalance).to.be.gt(parseEther("0.019")); // Owner's balance should increase around 0.019
    });

    it("Should revert if non-owner tries to withdraw", async function () {

      const tx = nft.connect(addr1).withdraw();
      await expect(tx).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });
  });
});