import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const TestToken = await ethers.getContractFactory("TestToken");
  const testToken = await TestToken.deploy(deployer.address);
  await testToken.waitForDeployment();

  console.log("TestToken deployed to:", await testToken.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 