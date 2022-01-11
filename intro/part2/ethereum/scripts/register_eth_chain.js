// run this script with truffle exec
// Eth is for port 8545
// Bsc is for port 8546 (devnet2)
const { PublicKey } = require("@solana/web3.js");
const jsonfile = require("jsonfile");
const fss = require("fs");
const bs58 = require("bs58");
const Messenger = artifacts.require("Messenger");
const MessengerFullABI = jsonfile.readFileSync(
  "../build/contracts/Messenger.json"
).abi;

function prependTo32Bytes(str) {
  var stripStr = str.substring(0, 2) === "0x" ? str.substring(2) : str;
  while (stripStr.length < 64) {
    stripStr = "00" + stripStr;
  }
  return "0x" + stripStr;
}

module.exports = async function(callback) {
  try {
    const ETH_CONTRACT_ADDRESS = fss
      .readFileSync("./scripts/contract-addresses/development")
      .toString();
    const BSC_CONTRACT_ADDRESS = fss
      .readFileSync("./scripts/contract-addresses/development2")
      .toString();
    // const SOLANA_CONTRACT_ADDRESS =
    //   "MK3nUKWkx4qRpLPXJzVa9zN4jZWpZE1syNnu8qQrupH"; // Messenger address from intro/part2/ui/src/contract-addresses/solana.json.
    const SOLANA_CONTRACT_ADDRESS = require("../../ui/src/contract-addresses/solana.json")
      .programId;

    const accounts = await web3.eth.getAccounts();
    const initialized = new web3.eth.Contract(
      MessengerFullABI,
      Messenger.address
    );

    // code to derive solana emitter from SOLANA_CONTRACT_ADDRESS
    // export const SOLANA_CONTRACT_ADDRESS = require("./contract-addresses/solana.json").programId;
    const solanaProgramId = new PublicKey(SOLANA_CONTRACT_ADDRESS);
    let [solanaEmitter, nonce] = await PublicKey.findProgramAddress(
      [Buffer.from("emitter", "utf8")],
      solanaProgramId
    );

    // Register the Eth endpoint
    await initialized.methods
      .registerChain(2, prependTo32Bytes(ETH_CONTRACT_ADDRESS))
      .send({
        value: 0,
        from: accounts[0],
        gasLimit: 2000000,
      });

    // Register the BSC endpoint
    await initialized.methods
      .registerChain(4, prependTo32Bytes(BSC_CONTRACT_ADDRESS))
      .send({
        value: 0,
        from: accounts[0],
        gasLimit: 2000000,
      });
    // Register Terra.  TBD chain=3

    // Register Solana
    console.log(
      "Solana emitter: " +
        bs58.encode(solanaEmitter.toBytes()) +
        " or " +
        solanaEmitter.toBuffer().toString("hex")
    );
    await initialized.methods.registerChain(1, solanaEmitter.toBuffer()).send({
      value: 0,
      from: accounts[0],
      gasLimit: 2000000,
    });

    callback();
  } catch (e) {
    callback(e);
  }
};
