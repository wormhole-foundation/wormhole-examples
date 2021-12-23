const fsp = require("fs/promises");
const Messenger = artifacts.require("Messenger");
const uiAddressDir = "../ui/src/contract-addresses";
const scAddressDir = "scripts/contract-addresses";
module.exports = async function(deployer, network) {
  // deploy Messenger
  await deployer.deploy(Messenger);

  // Store Messenger address to smart contract source for registration of message originators.
  await fsp.mkdir(scAddressDir, { recursive: true });
  await fsp.writeFile(
    `${scAddressDir}/${network}`,
    `${Messenger.address}`
  );

  // Store Messenger address to ui. To call it.
  await fsp.mkdir(uiAddressDir, { recursive: true });
  await fsp.writeFile(
    `${uiAddressDir}/${network}.js`,
    `export const address = "${Messenger.address}"`
  );
};
