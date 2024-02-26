import { ethers } from "hardhat";
import hre from "hardhat";
import { verify } from "../lib/utils";

async function main() {
    console.log("DEPLOYING...");

    const [deployer] = await ethers.getSigners();

    const args = {
        adminAddress: deployer.address,
        operatorAddress: deployer.address,
        intervalSeconds: 120,
        minBetAmount: 1,
        treasuryFee: 1000,
    };

    const prediction = await ethers.deployContract("Prediction", Object.values(args), deployer);

    await prediction.waitForDeployment();

    await verify(prediction.target, Object.values(args));

    console.log("Successfuly deployed to", prediction.target);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
