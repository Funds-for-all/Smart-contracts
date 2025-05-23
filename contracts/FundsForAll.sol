// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FundsForAll {
    struct Pool {
        address owner;
        string name;
        uint256 totalFunds;
        bool withdrawn;
        address[] voters;
        mapping(address => uint256) votes;
        mapping(address => bool) hasVoted;
        address[] candidates;
    }

    uint256 public poolCount;
    mapping(uint256 => Pool) public pools;

    event PoolCreated(uint256 poolId, address owner, string name);
    event Funded(uint256 poolId, address funder, uint256 amount);
    event Voted(uint256 poolId, address voter, address candidate);
    event Withdrawn(uint256 poolId, address to, uint256 amount);

    modifier onlyOwner(uint256 poolId) {
        require(msg.sender == pools[poolId].owner, "Not pool owner");
        _;
    }

    function createPool(string calldata name, address[] calldata candidates) external {
        Pool storage pool = pools[poolCount];
        pool.owner = msg.sender;
        pool.name = name;
        pool.withdrawn = false;
        pool.candidates = candidates;
        emit PoolCreated(poolCount, msg.sender, name);
        poolCount++;
    }

    function fundPool(uint256 poolId) external payable {
        require(msg.value > 0, "Must send funds");
        Pool storage pool = pools[poolId];
        pool.totalFunds += msg.value;
        emit Funded(poolId, msg.sender, msg.value);
    }

    function vote(uint256 poolId, address candidate) external {
        Pool storage pool = pools[poolId];
        require(!pool.hasVoted[msg.sender], "Already voted");

        bool validCandidate = false;
        for (uint256 i = 0; i < pool.candidates.length; i++) {
            if (pool.candidates[i] == candidate) {
                validCandidate = true;
                break;
            }
        }
        require(validCandidate, "Invalid candidate");

        pool.votes[candidate]++;
        pool.hasVoted[msg.sender] = true;
        pool.voters.push(msg.sender);
        emit Voted(poolId, msg.sender, candidate);
    }

    function withdraw(uint256 poolId) external onlyOwner(poolId) {
        Pool storage pool = pools[poolId];
        require(!pool.withdrawn, "Already withdrawn");

        address topCandidate;
        uint256 highestVotes;

        for (uint256 i = 0; i < pool.candidates.length; i++) {
            address candidate = pool.candidates[i];
            if (pool.votes[candidate] > highestVotes) {
                highestVotes = pool.votes[candidate];
                topCandidate = candidate;
            }
        }

        require(topCandidate != address(0), "No votes");

        uint256 amount = pool.totalFunds;
        pool.totalFunds = 0;
        pool.withdrawn = true;
        payable(topCandidate).transfer(amount);
        emit Withdrawn(poolId, topCandidate, amount);
    }

    function getCandidates(uint256 poolId) external view returns (address[] memory) {
        return pools[poolId].candidates;
    }

    function getVoteCount(uint256 poolId, address candidate) external view returns (uint256) {
        return pools[poolId].votes[candidate];
    }
}
