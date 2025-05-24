import { ethers } from "hardhat";
import { expect } from "chai";
import { FundsForAll } from "../typechain-types";

describe("FundsForAll", function () {
  let contract: FundsForAll;
  let owner: any, addr1: any, addr2: any, addr3: any;

  beforeEach(async () => {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("FundsForAll");
    contract = (await Factory.deploy()) as FundsForAll;
  });

  it("should create a new pool", async () => {
    await contract.createPool("Save Earth", [addr1.address, addr2.address]);
    const poolCount = await contract.poolCount();
    expect(poolCount).to.equal(1);
  });

  it("should allow funding", async () => {
    await contract.createPool("Health Aid", [addr1.address]);
    await contract.fundPool(0, { value: ethers.parseEther("1.0") });
    const poolData = await contract.poolCount();
    expect(poolData).to.equal(1); // Basic check
  });

  it("should allow voting and withdrawal", async () => {
    await contract.createPool("Vote Funds", [addr1.address, addr2.address]);
    await contract.fundPool(0, { value: ethers.parseEther("1.0") });

    await contract.connect(addr3).vote(0, addr1.address);

    const votes = await contract.getVoteCount(0, addr1.address);
    expect(votes).to.equal(1);

    const balanceBefore = await ethers.provider.getBalance(addr1.address);
    const tx = await contract.withdraw(0);
    await tx.wait();

    const balanceAfter = await ethers.provider.getBalance(addr1.address);
    expect(balanceAfter).to.be.gt(balanceBefore); // Should receive funds
  });

  it("should not allow double voting", async () => {
    await contract.createPool("No Double Vote", [addr1.address]);
    await contract.connect(addr2).vote(0, addr1.address);
    await expect(contract.connect(addr2).vote(0, addr1.address)).to.be.revertedWith("Already voted");
  });

  it("should not allow withdrawal before any votes", async () => {
    await contract.createPool("No Votes", [addr1.address]);
    await contract.fundPool(0, { value: ethers.parseEther("1.0") });
    await expect(contract.withdraw(0)).to.be.revertedWith("No votes");
  });

  it("should reject invalid candidate vote", async () => {
    await contract.createPool("Invalid Vote", [addr1.address]);
    await expect(contract.connect(addr2).vote(0, addr3.address)).to.be.revertedWith("Invalid candidate");
  });

  it("should emit events correctly", async () => {
    await expect(contract.createPool("Event Pool", [addr1.address]))
      .to.emit(contract, "PoolCreated")
      .withArgs(0, owner.address, "Event Pool");

    await expect(contract.fundPool(0, { value: ethers.parseEther("0.5") }))
      .to.emit(contract, "Funded")
      .withArgs(0, owner.address, ethers.parseEther("0.5"));

    await contract.connect(addr2).vote(0, addr1.address);
    await expect(contract.withdraw(0))
      .to.emit(contract, "Withdrawn");
  });
});
