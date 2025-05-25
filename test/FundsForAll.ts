import { ethers } from "hardhat";
import { expect } from "chai";

describe("FundPoolFactory and FundPool", function () {
  let factory: any;
  let pool: any;
  let owner: any;
  let contributor1: any;
  let contributor2: any;
  let candidate1: any;
  let candidate2: any;

  beforeEach(async function () {
    [owner, contributor1, contributor2, candidate1, candidate2] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("FundPoolFactory");
    factory = await Factory.deploy();
    await factory.deployed();

    const tx = await factory.createFundPool("Test Pool", ethers.utils.parseEther("1"), 1);
    const receipt = await tx.wait();
    const poolAddress = receipt.events?.[0].args?.poolAddress;

    pool = await ethers.getContractAt("FundPool", poolAddress);
  });

  it("should allow funding the pool", async function () {
    await contributor1.sendTransaction({ to: pool.address, value: ethers.utils.parseEther("0.5") });
    expect(await pool.getBalance()).to.equal(ethers.utils.parseEther("0.5"));
  });

  it("should allow creator to add candidates", async function () {
    await pool.connect(owner).addCandidate(candidate1.address);
    const candidates = await pool.getCandidates();
    expect(candidates).to.include(candidate1.address);
  });

  it("should allow contributors to vote after pool closes and goal is met", async function () {
    await pool.connect(owner).addCandidate(candidate1.address);
    await contributor1.sendTransaction({ to: pool.address, value: ethers.utils.parseEther("1") });

    await ethers.provider.send("evm_increaseTime", [86400]); // 1 day
    await ethers.provider.send("evm_mine", []);
    await pool.connect(owner).closePool();

    await pool.connect(contributor1).vote(candidate1.address);
    expect(await pool.getCandidateVotes(candidate1.address)).to.equal(1);
  });

  it("should allow withdrawal to the winning candidate", async function () {
    await pool.connect(owner).addCandidate(candidate1.address);
    await contributor1.sendTransaction({ to: pool.address, value: ethers.utils.parseEther("1") });

    await ethers.provider.send("evm_increaseTime", [86400]);
    await ethers.provider.send("evm_mine", []);
    await pool.connect(owner).closePool();
    await pool.connect(contributor1).vote(candidate1.address);

    const before = await ethers.provider.getBalance(candidate1.address);
    const tx = await pool.connect(owner).withdrawToWinner();
    await tx.wait();
    const after = await ethers.provider.getBalance(candidate1.address);

    expect(after.sub(before)).to.be.gt(ethers.utils.parseEther("0.9"));
  });

  it("should allow refund if goal not met", async function () {
    await contributor1.sendTransaction({ to: pool.address, value: ethers.utils.parseEther("0.5") });

    await ethers.provider.send("evm_increaseTime", [86400]);
    await ethers.provider.send("evm_mine", []);
    await pool.connect(owner).closePool();

    const before = await contributor1.getBalance();
    const tx = await pool.connect(contributor1).claimRefund();
    const receipt = await tx.wait();
    const gas = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const after = await contributor1.getBalance();

    expect(after.add(gas)).to.be.closeTo(before, ethers.utils.parseEther("0.01"));
  });
});
