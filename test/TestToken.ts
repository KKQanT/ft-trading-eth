import { expect } from "chai";
import { ethers } from "hardhat";
import { TestToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TEST_CONSTANTS } from "./constants";

describe("TestToken", function () {
  let testToken: TestToken;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const TestToken = await ethers.getContractFactory("TestToken");

    testToken = await TestToken.deploy(
      owner.address,
      TEST_CONSTANTS.NAME,
      TEST_CONSTANTS.SYMBOL,
      TEST_CONSTANTS.INITIAL_SUPPLY
    );

    await testToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await testToken.owner()).to.equal(owner.address);
    })

    it("Should assign the total supply of tokens to the owner", async function () {
      const ownerBalance = await testToken.balanceOf(owner.address);
      expect(await testToken.totalSupply()).to.equal(ownerBalance);
    })

  })

  describe("Transactions", function () {
    it("Should transfer tokens between accounts", async function () {
      // Transfer 50 tokens from owner to addr1
      await testToken.transfer(addr1.address, 50);
      expect(await testToken.balanceOf(addr1.address)).to.equal(50);

      // Transfer 50 tokens from address 1 to address 2
      await testToken.connect(addr1).transfer(addr2.address, 50);
      expect(await testToken.balanceOf(addr2.address)).to.equal(50);
    })

    it("Should fail if sender doesn't have enough tokens", async function () {
      const initialOwnerBalance = await testToken.balanceOf(owner.address);
      await expect(
        testToken.connect(addr1).transfer(owner.address, 1)
      ).to.be.revertedWithCustomError(testToken, "ERC20InsufficientBalance")
    })

  })

  describe("Minting", function () {
    it("should allow owner to mint tokens", async function () {
      await testToken.mint(100);
      expect(await testToken.balanceOf(owner.address)).to.equal(
        ethers.parseUnits((100 + TEST_CONSTANTS.INITIAL_SUPPLY).toString(), 18)
      );
    })

    it("should not allow non-owner to mint tokens", async function () {
      await expect(
        testToken.connect(addr1).mint(100)
      ).to.be.revertedWithCustomError(testToken, "OwnableUnauthorizedAccount")
    })
  }),

  describe("Approval and TransferFrom", function () {
    it("should allow approval of tokens", async function () {
      await testToken.approve(addr1.address, 100);
      expect(await testToken.allowance(owner.address, addr1.address)).to.equal(100);
    })

    it("should allow transferFrom to spend allowance", async function () {
      await testToken.approve(addr1.address, 100);
      await testToken.connect(addr1).transferFrom(owner.address, addr2.address, 50);
      expect(await testToken.balanceOf(addr2.address)).to.equal(50);
      expect(await testToken.allowance(owner.address, addr1.address)).to.equal(50);
    })

    it("should fail if sender doesn't have enough tokens", async function () {
      await testToken.approve(addr1.address, 100);
      await expect(
        testToken.connect(addr1).transferFrom(owner.address, addr2.address, 101)
      ).to.be.revertedWithCustomError(testToken, "ERC20InsufficientAllowance")
    })

    it("should fail if allowance is not enough", async function () {
      await testToken.approve(addr1.address, 100);
      await expect(
        testToken.connect(addr1).transferFrom(owner.address, addr2.address, 101)
      ).to.be.revertedWithCustomError(testToken, "ERC20InsufficientAllowance")
    })
  })
})