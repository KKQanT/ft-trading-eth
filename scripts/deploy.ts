import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", await deployer.getAddress());

  // Deploy NFT contract
  console.log("Deploying NFT contract...");
  const NFT = await ethers.getContractFactory("NFT");
  const nft = await NFT.deploy(
    await deployer.getAddress(), // owner
    "Test NFT",                  // name
    "TNFT"                      // symbol
  );
  await nft.waitForDeployment();
  console.log("NFT contract deployed to:", await nft.getAddress());

  // Deploy Marketplace contract
  console.log("Deploying Marketplace contract...");
  const Marketplace = await ethers.getContractFactory("Martketplace");
  const marketplace = await Marketplace.deploy(await deployer.getAddress());
  await marketplace.waitForDeployment();
  console.log("Marketplace contract deployed to:", await marketplace.getAddress());

  // Wait for a few blocks for better confirmation
  console.log("Waiting for block confirmations...");
  await nft.deploymentTransaction()?.wait(5);
  await marketplace.deploymentTransaction()?.wait(5);

  console.log("Deployment completed!");
  console.log("-------------------");
  console.log("NFT Contract:", await nft.getAddress());
  console.log("Marketplace Contract:", await marketplace.getAddress());
  console.log("-------------------");
  console.log("Verify NFT contract:");
  console.log(`npx hardhat verify --network sepolia ${await nft.getAddress()} "${await deployer.getAddress()}" "Test NFT" "TNFT"`);
  console.log("-------------------");
  console.log("Verify Marketplace contract:");
  console.log(`npx hardhat verify --network sepolia ${await marketplace.getAddress()} "${await deployer.getAddress()}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 