require("dotenv").config({ path: "../.env" });

// CONFIG
const chainId = process.env.INIT_CHAIN_ID;
const wormholeAddress = process.env.INIT_WORMHOLE_ADDRESS;

const MsgImpl = artifacts.require("MsgImpl");

module.exports = async function(deployer) {
  // deploy MsgImpl
  await deployer.deploy(MsgImpl);
};
