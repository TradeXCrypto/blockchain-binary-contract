import { expect } from "chai";
import { Prediction } from "../typechain-types";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther } from "ethers";

describe("Predicion", () => {
    let owner: HardhatEthersSigner,
        operator: HardhatEthersSigner,
        acc1: HardhatEthersSigner,
        acc2: HardhatEthersSigner,
        acc3: HardhatEthersSigner,
        acc4: HardhatEthersSigner,
        acc5: HardhatEthersSigner;
    let predictionContract: Prediction;

    beforeEach(async () => {
        [owner, operator, acc1, acc2, acc3, acc4, acc5] = await ethers.getSigners();
        const args = {
            adminAddress: owner.address,
            operatorAddress: operator.address,
            intervalSeconds: 120,
            minBetAmount: 1,
            treasuryFee: 1000,
        };
        predictionContract = await ethers.deployContract("Prediction", Object.values(args), owner);
    });

    it("should be deployed", () => {
        expect(predictionContract.target).to.be.properAddress;
    });

    it("should be possible to start round", async () => {
        const startPrice = 100n;
        const tx = await predictionContract.connect(operator).executeRound(startPrice);
        await tx.wait();
        const currentEpoch = await predictionContract.currentEpoch();
        const round = await predictionContract.rounds(currentEpoch);
        const intervalSecods = await predictionContract.intervalSeconds();
        const startTimestamp = await getBlockTimestamp(tx.blockNumber);
        expect(currentEpoch).to.be.equal(1);
        expect(round).to.be.eql([
            currentEpoch,
            startTimestamp,
            startTimestamp + intervalSecods,
            startPrice,
            0n,
            0n,
            0n,
            0n,
            0n,
            0n,
            false,
        ]);
    });

    it("should not be possible to close round before closeTimestamp", async () => {
        const price = 100;
        const startTx = await predictionContract.connect(operator).executeRound(price);
        await startTx.wait();
        const closeTx = predictionContract.connect(operator).executeRound(price);
        await expect(closeTx).to.be.rejectedWith("Can only end round after closeTimestamp");
    });

    it("should be possible to close round and start next", async () => {
        const startPrice = 100n;
        const closePrice = 150n;
        const startTx = await predictionContract.connect(operator).executeRound(startPrice);
        await startTx.wait();
        const roundBeforeExecute = await predictionContract.rounds(1);
        await time.increaseTo(roundBeforeExecute.closeTimestamp);
        const closeTx = await predictionContract.connect(operator).executeRound(closePrice);
        await closeTx.wait();
        const currentEpoch = await predictionContract.currentEpoch();
        const roundAfterExecute = await predictionContract.rounds(currentEpoch - 1n);
        const intervalSecods = await predictionContract.intervalSeconds();
        const startTimestamp = await getBlockTimestamp(startTx.blockNumber);
        expect(currentEpoch).to.be.equal(2);
        expect(roundAfterExecute).to.be.eql([
            currentEpoch - 1n,
            startTimestamp,
            startTimestamp + intervalSecods,
            startPrice,
            closePrice,
            0n,
            0n,
            0n,
            0n,
            0n,
            true,
        ]);
    });

    it("should be possible to make bets", async () => {
        const startTx = await predictionContract.connect(operator).executeRound(100);
        await startTx.wait();
        const betAmount = parseEther("1");
        const betBullTx = predictionContract.connect(acc1).betBull(1, { value: betAmount });
        const betBearTx = predictionContract.connect(acc2).betBear(1, { value: betAmount });
        await expect(betBullTx).to.changeEtherBalances([predictionContract, acc1], [betAmount, -betAmount]);
        await expect(betBearTx).to.changeEtherBalances([predictionContract, acc2], [betAmount, -betAmount]);
    });

    it("should not be possible to make multiple bets", async () => {
        const startTx = await predictionContract.connect(operator).executeRound(100);
        await startTx.wait();
        const betAmount = parseEther("1");
        const betBullTx = await predictionContract.connect(acc1).betBull(1, { value: betAmount });
        await betBullTx.wait();
        const betBearTx = predictionContract.connect(acc1).betBear(1, { value: betAmount });
        await expect(betBearTx).to.be.revertedWith("Can only bet once per round");
    });

    it("should not be possible to make bet lower than minBetAmount", async () => {
        const startTx = await predictionContract.connect(operator).executeRound(100);
        await startTx.wait();
        const betBullTx = predictionContract.connect(acc1).betBull(1);
        await expect(betBullTx).to.be.revertedWith("Bet amount must be greater than minBetAmount");
    });

    it("should correct calculate and claim rewards", async () => {
        const startPrice = 100n;
        const closePrice = 200n;
        const startTx = await predictionContract.connect(operator).executeRound(startPrice);
        await startTx.wait();
        const betBullAmount = parseEther("1");
        const betBearAmount = parseEther("2");
        const roundBeforeExecute = await predictionContract.rounds(1);
        const betBullTx = await predictionContract.connect(acc1).betBull(1, { value: betBullAmount });
        await betBullTx.wait();
        const betBearTx = await predictionContract.connect(acc2).betBear(1, { value: betBearAmount });
        await betBearTx.wait();
        await time.increaseTo(roundBeforeExecute.closeTimestamp);
        const executeTx = await predictionContract.connect(operator).executeRound(closePrice);
        await executeTx.wait();
        const roundAfterExecute = await predictionContract.rounds(1);
        const intervalSecods = await predictionContract.intervalSeconds();
        const treasuryFee = await predictionContract.treasuryFee();
        const totalAmount = betBullAmount + betBearAmount;
        const roundRewardAmount = totalAmount - (totalAmount * treasuryFee) / 10000n;
        const bullRewardAmount = (betBullAmount * roundRewardAmount) / betBullAmount;
        const claimBullTx = predictionContract.connect(acc1).claim([1]);
        await expect(claimBullTx).to.changeEtherBalances(
            [predictionContract, acc1],
            [-bullRewardAmount, bullRewardAmount]
        );
        expect(roundAfterExecute).to.be.eql([
            1n,
            roundBeforeExecute.startTimestamp,
            roundBeforeExecute.startTimestamp + intervalSecods,
            startPrice,
            closePrice,
            totalAmount,
            betBullAmount,
            betBearAmount,
            betBullAmount,
            roundRewardAmount,
            true,
        ]);
    });
});

async function getBlockTimestamp(blockNumber: number | null): Promise<bigint> {
    if (!blockNumber) {
        throw new Error("getBlockTimestamp: block number is empty");
    }
    const block = await ethers.provider.getBlock(blockNumber);
    return BigInt(block?.timestamp || 0);
}

//    uint256 epoch;
//         uint256 startTimestamp;
//         uint256 closeTimestamp;
//         int256 startPrice;
//         int256 closePrice;
//         uint256 totalAmount;
//         uint256 bullAmount;
//         uint256 bearAmount;
//         uint256 rewardBaseCalAmount;
//         uint256 rewardAmount;
//         bool roundEnded;
