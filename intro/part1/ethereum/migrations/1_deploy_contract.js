const Messenger = artifacts.require("Messenger");

module.exports = async function(deployer) {
  // deploy Messenger
  await deployer.deploy(Messenger);
};
