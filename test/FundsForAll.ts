import { expect } from "chai";
import { ethers } from "hardhat";
import { FundsForAll, FundPool } from "../typechain-types";

describe("FundsForAll + FundPool", () => {
  let factory: FundsForAll;
  let poolAddress: string;
  let pool: FundPool;

  const name = "Test Pool";
  const goalAmount = ethers.utils.parseEther("5");
  const durationInDays = 1;

  beforeEach(async () => {
    const [deployer] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("FundsForAll");
    factory = await Factory.deploy();
    await factory.deployed();

    const tx = await factory.createFundPool(name, goalAmount, durationInDays);
    const receipt = await tx.wait();

    const event = receipt.events?.find(e => e.event === "PoolCreated");
    poolAddress = event?.args?.poolAddress;
    pool = await ethers.getContractAt("FundPool", poolAddress);
  });

  it("should create a FundPool", async () => {
    const pools = await factory.getAllPools();
    expect(pools.length).to.equal(1);
    expect(pools[0]).to.equal(poolAddress);
  });

  it("should accept funds and update contributions", async () => {
    const [user] = await ethers.getSigners();
    const amount = ethers.utils.parseEther("1");

    await user.sendTransaction({
      to: poolAddress,
      value: amount,
    });

    const contribution = await pool.getMyContribution(user.address);
    expect(contribution).to.equal(amount);
  });

  it("should close the pool and emit event", async () => {
    // fast-forward time
    await ethers.provider.send("evm_increaseTime", [86400 + 1]); // 1 day
    await ethers.provider.send("evm_mine", []);

    const tx = await pool.closePool();
    const receipt = await tx.wait();
    const event = receipt.events?.find(e => e.event === "PoolClosed");

    expect(event?.args?.goalReached).to.be.false;
    expect(await pool.isEnded()).to.be.true;
  });

  it("should refund contributors if goal not reached", async () => {
    const [user] = await ethers.getSigners();
    const amount = ethers.utils.parseEther("1");

    await user.sendTransaction({ to: poolAddress, value: amount });

    // close the pool after deadline
    await ethers.provider.send("evm_increaseTime", [86400 + 1]);
    await ethers.provider.send("evm_mine", []);
    await pool.closePool();

    const prevBalance = await ethers.provider.getBalance(user.address);
    const tx = await pool.connect(user).claimRefund();
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const newBalance = await ethers.provider.getBalance(user.address);

    expect(newBalance).to.be.closeTo(prevBalance.add(amount).sub(gasUsed), ethers.utils.parseEther("0.01"));
  });

  it("should allow voting and withdraw to winner", async () => {
    const [creator, user, candidate] = await ethers.getSigners();
    const amount = ethers.utils.parseEther("5");

    // fund the pool to reach the goal
    await user.sendTransaction({ to: poolAddress, value: amount });

    // add candidate
    await pool.connect(creator).addCandidate(candidate.address);

    // close pool
    await ethers.provider.send("evm_increaseTime", [86400 + 1]);
    await ethers.provider.send("evm_mine", []);
    await pool.closePool();

    // vote
    await pool.connect(user).vote(candidate.address);

    // withdraw
    const balanceBefore = await ethers.provider.getBalance(candidate.address);
    const tx = await pool.connect(user).withdrawToWinner();
    await tx.wait();
    const balanceAfter = await ethers.provider.getBalance(candidate.address);

    expect(balanceAfter.sub(balanceBefore)).to.equal(amount);
  });
});
