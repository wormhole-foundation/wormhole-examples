// run this script with truffle exec
const fss = require("fs");
const jsonfile = require("jsonfile");
const Messenger = artifacts.require("Messenger");
const MessengerFullABI = jsonfile.readFileSync(
  "../build/contracts/Messenger.json"
).abi;

function prependTo32Bytes(str) {
  var stripStr=(str.substring(0,2) === "0x")? str.substring(2): str;
  while(stripStr.length < 64) {
    stripStr = "00"+stripStr;
  }
  return "0x"+stripStr;
}

module.exports = async function(callback) {
  try {
    const ETH_CONTRACT_ADDRESS = fss.readFileSync('./scripts/contract-addresses/development').toString();
    const BSC_CONTRACT_ADDRESS = fss.readFileSync('./scripts/contract-addresses/development2').toString();
    const accounts = await web3.eth.getAccounts();
    const initialized = new web3.eth.Contract(
        MessengerFullABI,
        Messenger.address
    );
    // Register the Eth endpoint on BSC
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

      // Register the BSC endpoint on BSC
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
