// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IDAO.sol";

contract DAO is IDAO {
    struct Proposal {
        address contractAddress;
        bytes data;
        address[] votedUsers;
        mapping(address => bool) votedUsersExist;
        uint64 expiration;
        string description;
        bool proposalExecuted;
        address proposalCreator;
    }

    Proposal[] public proposals;

    uint256 public votesLimit;
    uint256 public proposalCount;

    IERC20 public tokenContract;

    constructor(IERC20 token, uint votesLimit_) {
        votesLimit = votesLimit_;
        tokenContract = token;
    }

    function createProposal(
        address contractAddress_,
        bytes memory _data,
        uint64 voteLivingTime_,
        string memory description
    ) external {
        Proposal storage proposal_ = proposals.push();
        proposal_.contractAddress = contractAddress_;
        proposal_.data = _data;
        proposal_.description = description;
        proposal_.proposalCreator = msg.sender;
        proposal_.expiration = voteLivingTime_;
        proposal_.votedUsers = new address[](0);

        emit newProposal(proposalCount, msg.sender, description);

        proposalCount++;
    }

    function vote(uint256 proposalID) external {
        Proposal storage proposal_ = proposals[proposalID];
        require(
            !proposal_.proposalExecuted && (proposal_.expiration > block.timestamp),
            "Proposal already ended"
        );
        require(!proposal_.votedUsersExist[msg.sender], "Already voted");

        proposals[proposalID].votedUsers.push(msg.sender);
        proposals[proposalID].votedUsersExist[msg.sender] = true;

        emit newVote(proposalID, msg.sender);
    }

    function executeProposal(uint256 proposalID) external {
        Proposal storage proposal_ = proposals[proposalID];

        require(block.timestamp > proposal_.expiration, "Vote not yet ended.");

        require(_countVotes(proposal_.votedUsers), "Not enough votes to execute");

        (bool success, ) = proposal_.contractAddress.call(proposal_.data);
        require(success, "Failed to execute proposal");

        proposal_.proposalExecuted = true;
    }

    function getVotesList(uint256 proposalID) public view returns (address[] memory) {
        return proposals[proposalID].votedUsers;
    }

    function getVotesListExist(uint256 proposalID, address user) public view returns (bool) {
        return proposals[proposalID].votedUsersExist[user];
    }

    function _countVotes(address[] memory votedUsers_) internal view returns (bool) {
        uint votesCount_;
        for (uint i = 0; i < votedUsers_.length; i++) {
            votesCount_ += tokenContract.balanceOf(msg.sender);
        }
        if (votesCount_ >= votesLimit) {
            return true;
        }
        return false;
    }
}