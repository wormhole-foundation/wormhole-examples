// run this script with truffle exec
const jsonfile = require("jsonfile");
const fss = require("fs");
const Messenger = artifacts.require("Messenger");
const MessengerFullABI = jsonfile.readFileSync(
  "../build/contracts/Messenger.json"
).abi;

function prependTo32Bytes(str) {
  if(str.substring(0,2) === "0x") {
    return "0x000000000000000000000000" + str.substring(2);
  } else {
    return "0x000000000000000000000000" + str;
  }
}

module.exports = async function(callback) {
  try {
    const ETH_CONTRACT_ADDRESS =fss.readFileSync('./scripts/contract-addresses/development').toString();
    const BSC_CONTRACT_ADDRESS = fss.readFileSync('./scripts/contract-addresses/development2').toString();
    const accounts = await web3.eth.getAccounts();
    const initialized = new web3.eth.Contract(
        MessengerFullABI,
        Messenger.address
    );

    // Register the Eth endpoint on Eth
    await initialized.methods
      .registerChain(
        2,
        prependTo32Bytes(ETH_CONTRACT_ADDRESS)
      )
      .send({
        value: 0,
        from: accounts[0],
        gasLimit: 2000000,
      });

      // Register the BSC endpoint on Eth
      await initialized.methods
        .registerChain(
          4,
          prependTo32Bytes(BSC_CONTRACT_ADDRESS)
        )
        .send({
          value: 0,
          from: accounts[0],
          gasLimit: 2000000,
        });

    callback();
  } catch (e) {
    callback(e);
  }
};
