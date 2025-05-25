// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract FundsForAll {
    address[] public allPools;

    event PoolCreated(address poolAddress, address creator, string name, uint goalAmount, uint deadline);

    function createFundPool(
        string memory _name,
        uint _goalAmount,
        uint _durationInDays
    ) external {
        uint deadline = block.timestamp + (_durationInDays * 1 days);
        FundPool newPool = new FundPool(msg.sender, _name, _goalAmount, deadline);
        allPools.push(address(newPool));
        emit PoolCreated(address(newPool), msg.sender, _name, _goalAmount, deadline);
    }

    function getAllPools() external view returns (address[] memory) {
        return allPools;
    }
}

contract FundPool {
    address public creator;
    string public name;
    uint public goalAmount;
    uint public deadline;
    bool public isEnded;
    bool public goalReached;
    bool public hasWithdrawn;

    mapping(address => uint) public contributions;
    mapping(address => bool) public hasVoted;

    address[] public candidates;
    mapping(address => uint) public candidateVotes;

    event Funded(address indexed contributor, uint amount);
    event Refunded(address indexed contributor, uint amount);
    event PoolClosed(bool goalReached);
    event Voted(address indexed voter, address indexed candidate);
    event Withdrawn(address indexed to, uint amount);
    event CandidateAdded(address indexed candidate);

    modifier onlyCreator() {
        require(msg.sender == creator, "Not the pool creator");
        _;
    }

    modifier poolActive() {
        require(!isEnded, "Pool has ended");
        _;
    }

    modifier poolEndedAndGoalReached() {
        require(isEnded, "Pool not closed yet");
        require(goalReached, "Goal not reached");
        _;
    }

    constructor(address _creator, string memory _name, uint _goalAmount, uint _deadline) {
        creator = _creator;
        name = _name;
        goalAmount = _goalAmount;
        deadline = _deadline;
    }

    // Add a candidate (can only be done by creator before deadline)
    function addCandidate(address _candidate) external onlyCreator poolActive {
        candidates.push(_candidate);
        emit CandidateAdded(_candidate);
    }

    // Fund the pool
    receive() external payable poolActive {
        require(block.timestamp < deadline, "Funding period is over");
        contributions[msg.sender] += msg.value;
        emit Funded(msg.sender, msg.value);
    }

    // Close the pool after the deadline
    function closePool() public {
        require(!isEnded, "Pool already closed");
        require(block.timestamp >= deadline, "Deadline not reached");
        isEnded = true;
        goalReached = address(this).balance >= goalAmount;
        emit PoolClosed(goalReached);
    }

    // Vote for a candidate (only after pool is closed, only one vote per contributor)
    function vote(address _candidate) external poolEndedAndGoalReached {
        require(contributions[msg.sender] > 0, "Must have contributed to vote");
        require(!hasVoted[msg.sender], "Already voted");

        bool isValidCandidate = false;
        for (uint i = 0; i < candidates.length; i++) {
            if (candidates[i] == _candidate) {
                isValidCandidate = true;
                break;
            }
        }
        require(isValidCandidate, "Invalid candidate");

        hasVoted[msg.sender] = true;
        candidateVotes[_candidate]++;
        emit Voted(msg.sender, _candidate);
    }

    // Withdraw funds to the most voted candidate
    function withdrawToWinner() external poolEndedAndGoalReached {
        require(!hasWithdrawn, "Funds already withdrawn");

        address winner = address(0);
        uint highestVotes = 0;

        for (uint i = 0; i < candidates.length; i++) {
            if (candidateVotes[candidates[i]] > highestVotes) {
                highestVotes = candidateVotes[candidates[i]];
                winner = candidates[i];
            }
        }

        require(winner != address(0), "No votes cast");

        hasWithdrawn = true;
        uint amount = address(this).balance;
        payable(winner).transfer(amount);
        emit Withdrawn(winner, amount);
    }

    // Refunds for contributors if goal not met
    function claimRefund() external {
        require(isEnded, "Pool not closed yet");
        require(!goalReached, "Goal was reached; no refunds");

        uint amount = contributions[msg.sender];
        require(amount > 0, "No contribution to refund");

        contributions[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit Refunded(msg.sender, amount);
    }

    // Views
    function getBalance() external view returns (uint) {
        return address(this).balance;
    }

    function timeLeft() external view returns (uint) {
        if (block.timestamp >= deadline) return 0;
        return deadline - block.timestamp;
    }

    function getMyContribution(address user) external view returns (uint) {
        return contributions[user];
    }

    function getCandidates() external view returns (address[] memory) {
        return candidates;
    }

    function getCandidateVotes(address candidate) external view returns (uint) {
        return candidateVotes[candidate];
    }
}
