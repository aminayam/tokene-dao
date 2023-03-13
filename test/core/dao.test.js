const { assert } = require("chai");
const { artifacts } = require("hardhat");
const { accounts } = require("../../scripts/utils/utils");
const { setTime } = require("../helpers/block-helper");

const truffleAssert = require("truffle-assertions");

const DAO = artifacts.require("DAO");
const ERC20Mock = artifacts.require("ERC20Mock");
const MasterAccessManagement = artifacts.require("MasterAccessManagement");

describe("DAO", () => {
  let USER1;
  let USER2;

  let masterAccess;
  let token;
  let dao;

  const description_ = "Grant to USER1 new role 'NEW_TEST_ROLE'";
  const description2_ = "test proposal with cracked time";

  const expiration_ = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const crackedExpiration_ = Math.floor(Date.now() / 1000) - 100 * 24 * 60 * 60;

  const bytesData =
    "0xee2f6ce500000000000000000000000090f79bf6eb2c4f870365e785982e1f101e93b906000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000d4e45575f544553545f524f4c4500000000000000000000000000000000000000";

  before("setup", async () => {
    MASTER = await accounts(0);
    USER1 = await accounts(1);
    USER2 = await accounts(2);
    USER3 = await accounts(3);

    token = await ERC20Mock.new("Mock", "Mock", 18);
    masterAccess = await MasterAccessManagement.new();
    dao = await DAO.new(token.address, masterAccess.address);
    await masterAccess.__MasterAccessManagement_init(MASTER);
    await masterAccess.grantRoles(dao.address, ["MASTER"]);
    await masterAccess.grantRoles(USER1, ["USER_WITH_PERMISSIONS"]);
    await masterAccess.grantRoles(USER2, ["USER_WITH_PERMISSIONS"]);

    await token.mint(USER1, 10);
    await token.mint(USER2, 10);

    await setTime(Math.floor(Date.now() / 1000));
  });

  describe("createProposal", () => {
    it("user cant`t create proposal, haven`t permission", async () => {
      await truffleAssert.reverts(
        dao.createProposal(masterAccess.address, bytesData, expiration_, description_, 20, { from: USER1 }),
        "RBAC: no CREATE_PROPOSAL permission for resource DAO_RESOURCE"
      );
    });
    it("proposal creation", async () => {
      await masterAccess.addPermissionsToRole(
        "USER_WITH_PERMISSIONS",
        [{ resource: "DAO_RESOURCE", permissions: ["CREATE_PROPOSAL"] }],
        true
      );
      let tx = await dao.createProposal(masterAccess.address, bytesData, expiration_, description_, 20, {
        from: USER1,
      });
      const res_ = await dao.proposals(0);

      assert.equal(res_.data, bytesData);
      assert.equal(res_.description, description_);
      assert.equal(res_.contractAddress, masterAccess.address);
      assert.equal(res_.proposalCreator, USER1);
      assert.equal(res_.proposalExecuted, false);

      assert.equal(tx.logs[0].event, "newProposal");
      assert.equal(tx.logs[0].args.proposalID, 0);
      assert.equal(tx.logs[0].args.description, description_);
    });
  });

  describe("vote", () => {
    it("user cant`t vote, haven`t permission", async () => {
      await truffleAssert.reverts(dao.vote(0, { from: USER1 }), "RBAC: no VOTE permission for resource DAO_RESOURCE");
    });
    it("user vote for proposal for the first time", async () => {
      await masterAccess.addPermissionsToRole(
        "USER_WITH_PERMISSIONS",
        [{ resource: "DAO_RESOURCE", permissions: ["VOTE"] }],
        true
      );

      let tx = await dao.vote(0, { from: USER1 });

      assert.equal(tx.logs[0].event, "newVote");
      assert.equal(tx.logs[0].args.voter, USER1);
      assert.equal(tx.logs[0].args.proposalID, 0);

      assert.equal((await dao.getVotesList(0, 0, 100))[0], USER1);
      assert.equal(await dao.getVotesListExist(0, USER1), true);
    });
    it("revert if user already voted", async () => {
      await truffleAssert.reverts(dao.vote(0, { from: USER1 }), "Already voted");
    });
    it("revert if proposal already ended", async () => {
      await dao.createProposal(masterAccess.address, "0x00", crackedExpiration_, description2_, 20);
      await truffleAssert.reverts(dao.vote(1, { from: USER1 }), "Proposal already ended");
    });
  });

  describe("executeProposal", () => {
    it("revert if vote not yet ended", async () => {
      await truffleAssert.reverts(dao.executeProposal(0), "Vote not yet ended");
    });
    it("revert if not enough votes to execute", async () => {
      await truffleAssert.reverts(dao.executeProposal(1), "Not enough votes to execute");
    });
    it("execute proposal ok", async () => {
      await dao.vote(0, { from: USER2 });

      await setTime(Math.floor(Date.now() / 1000) + 25 * 60 * 60);

      await dao.executeProposal(0);

      assert.equal(await masterAccess.getUserRoles(USER3), "NEW_TEST_ROLE");
      assert.equal((await dao.proposals(0)).proposalExecuted, true);
    });
  });
});
