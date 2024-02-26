import { TaskArguments } from "hardhat/types";
import hre from "hardhat";
import { sleep } from "./sleep.util";
import { Addressable } from "ethers";

export async function verify(
    address: string | Addressable,
    constructorArguments: any[] = [],
    args: TaskArguments = {}
) {
    const verificationDelay = 15; // in seconds
    console.log(`Waiting ${verificationDelay} seconds before verification`);
    await sleep(verificationDelay * 1000);
    if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
        return;
    }
    return hre.run("verify:verify", {
        address,
        constructorArguments,
        ...args,
    });
}
