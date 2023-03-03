// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IDAO {
    event newProposal(uint proposalID, address proposer, string description);

    event newVote(uint proposalID, address voter);

    function createProposal(
        address _contractAddress,
        bytes memory _data,
        uint64 _voteLivingTime,
        string memory description
    ) external;

    function vote(uint256 proposalID) external;

    function executeProposal(uint256 proposalID) external;

    function getVotesList(uint256 proposalID) external view returns (address[] memory);

    function getVotesListExist(uint256 proposalID, address user) external view returns (bool);
}
