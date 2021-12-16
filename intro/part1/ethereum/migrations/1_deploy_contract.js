const fsp = require("fs/promises");
const Messenger = artifacts.require("Messenger");
const addressDir = "../ui/src/contract-addresses";
module.exports = async function(deployer, network) {
  // deploy Messenger
  await deployer.deploy(Messenger);
  await fsp.mkdir(addressDir, { recursive: true });
  await fsp.writeFile(
    `${addressDir}/${network}.js`,
    `export const address = "${Messenger.address}"`
  );
};
