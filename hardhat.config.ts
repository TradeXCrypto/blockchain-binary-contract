import { HardhatUserConfig } from "hardhat/config";
import { configDotenv } from "dotenv";

import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-ethers";

configDotenv();

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.8.19",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    networks: {
        hardhat: {
            blockGasLimit: 30000000,
        },
        localhost: {
            url: "http://127.0.0.1:8545",
            blockGasLimit: 30000000,
        },
        mumbai: {
            url: process.env.MUMBAI_URL || "",
            accounts: [process.env.DEPLOYER_PRIVATE_KEY || ""] || [],
        },
    },
    etherscan: {
        apiKey: {
            mumbai: process.env.POLYGONSCAN_API_KEY || "",
        },
        customChains: [
            {
                network: "mumbai",
                chainId: 80001,
                urls: {
                    apiURL: "https://api-mumbai.polygonscan.com/api",
                    browserURL: "https://mumbai.polygonscan.com",
                },
            },
        ],
    },
};

export default config;
