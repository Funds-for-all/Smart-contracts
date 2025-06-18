import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract, Signer } from "ethers";

describe("FundsForAll", function () {
  let deployer: Signer;
  let contributor1: Signer;
  let contributor2: Signer;
  let candidate1: Signer;
  let candidate2: Signer;
  let fundsForAll: Contract;

  beforeEach(async () => {
    [deployer, contributor1, contributor2, candidate1, candidate2] = await ethers.getSigners();

    const FundsForAll = await ethers.getContractFactory("FundsForAll");
    fundsForAll = await FundsForAll.deploy(); // ✅ No need for .deployed()
  });

  it("should create a FundPool correctly", async () => {
    await expect(
      fundsForAll.connect(deployer).createFundPool("Save The Whales", ethers.parseEther("5"), 1)
    ).to.emit(fundsForAll, "PoolCreated");

    const pools = await fundsForAll.getAllPools();
    expect(pools.length).to.equal(1);
  });

  describe("FundPool logic", function () {
    let fundPool: Contract;

    beforeEach(async () => {
      const tx = await fundsForAll.connect(deployer).createFundPool("TestPool", ethers.parseEther("3"), 1);
      const receipt = await tx.wait();
      const poolCreatedEvent = receipt?.logs?.find((log: any) => log.fragment?.name === "PoolCreated");
      const poolAddress = poolCreatedEvent?.args?.poolAddress;

      fundPool = await ethers.getContractAt("FundPool", poolAddress);
    });

    it("should accept contributions and emit Funded", async () => {
      await expect(
        contributor1.sendTransaction({ to: fundPool.target, value: ethers.parseEther("1") })
      ).to.emit(fundPool, "Funded");

      const balance = await fundPool.getBalance();
      expect(balance).to.equal(ethers.parseEther("1"));
    });

    it("should allow the creator to add candidates", async () => {
      await expect(fundPool.connect(deployer).addCandidate(await candidate1.getAddress()))
        .to.emit(fundPool, "CandidateAdded");

      const candidates = await fundPool.getCandidates();
      expect(candidates[0]).to.equal(await candidate1.getAddress());
    });

    it("should close the pool after the deadline and emit PoolClosed", async () => {
      await contributor1.sendTransaction({ to: fundPool.target, value: ethers.parseEther("1") });

      await ethers.provider.send("evm_increaseTime", [86400]); // 1 day
      await ethers.provider.send("evm_mine", []);

      await expect(fundPool.connect(deployer).closePool()).to.emit(fundPool, "PoolClosed");
    });

    it("should allow contributors to vote after goal is reached", async () => {
      await fundPool.connect(deployer).addCandidate(await candidate1.getAddress());
      await contributor1.sendTransaction({ to: fundPool.target, value: ethers.parseEther("3") });

      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);
      await fundPool.connect(deployer).closePool();

      await expect(fundPool.connect(contributor1).vote(await candidate1.getAddress()))
        .to.emit(fundPool, "Voted");

      const votes = await fundPool.getCandidateVotes(await candidate1.getAddress());
      expect(votes).to.equal(1);
    });

    it("should withdraw to the most voted candidate", async () => {
      await fundPool.connect(deployer).addCandidate(await candidate1.getAddress());
      await fundPool.connect(deployer).addCandidate(await candidate2.getAddress());

      await contributor1.sendTransaction({ to: fundPool.target, value: ethers.parseEther("2") });
      await contributor2.sendTransaction({ to: fundPool.target, value: ethers.parseEther("2") });

      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);
      await fundPool.connect(deployer).closePool();

      await fundPool.connect(contributor1).vote(await candidate1.getAddress());
      await fundPool.connect(contributor2).vote(await candidate1.getAddress());

      await expect(fundPool.connect(deployer).withdrawToWinner())
        .to.emit(fundPool, "Withdrawn");
    });

    it("should allow refunds if goal is not reached", async () => {
      await contributor1.sendTransaction({ to: fundPool.target, value: ethers.parseEther("1") });

      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);
      await fundPool.connect(deployer).closePool();

      const before = await ethers.provider.getBalance(await contributor1.getAddress());

      const tx = await fundPool.connect(contributor1).claimRefund();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice!;

      const after = await ethers.provider.getBalance(await contributor1.getAddress());
      expect(after).to.be.closeTo(before + ethers.parseEther("1") - gasUsed, ethers.parseEther("0.01"));
    });
  });
});
