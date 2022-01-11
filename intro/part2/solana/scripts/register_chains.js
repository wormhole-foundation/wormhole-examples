// run this script with ??
//const { PublicKey } = require("@solana/web3.js");
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} = require("@solana/web3.js");
const fs = require("fs");
const sdk = require("@certusone/wormhole-sdk");
const bs58 = require("bs58");

sdk.setDefaultWasm("node");
console.log("-- start -- ");

function prependTo32Bytes(str) {
  var stripStr = str.substring(0, 2) === "0x" ? str.substring(2) : str;
  while (stripStr.length < 64) {
    stripStr = "00" + stripStr;
  }
  return stripStr;
}

function cut0x(str) {
  const p = str.indexOf("0x");
  return str.substring(p, str.length - 1);
}

(async () => {
  try {
    const ETH_CONTRACT_ADDRESS_STR = cut0x(
      fs.readFileSync("../ui/src/contract-addresses/development.js").toString()
    );
    const BSC_CONTRACT_ADDRESS_STR = cut0x(
      fs.readFileSync("../ui/src/contract-addresses/development2.js").toString()
    );
    const SOLANA_CONTRACT_ADDRESS =
      require("../../ui/src/contract-addresses/solana.json").programId;

    // This is emitter_address in VAA from ETH
    //  [00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 43, 39, 31, 6E, 04, CF, FB, 59, 61, D1, C4, 1F, EF, 8E, 44, BF, A2, A7, FB, D1]
    //    const EthProgramId = new PublicKey(ETH_CONTRACT_ADDRESS);

    console.log("Eth Contract: " + ETH_CONTRACT_ADDRESS_STR);
    console.log("Bsc Contract: " + BSC_CONTRACT_ADDRESS_STR);
    console.log("Solana Contract: " + SOLANA_CONTRACT_ADDRESS);

    const ethEmitter = sdk.getEmitterAddressEth(ETH_CONTRACT_ADDRESS_STR);
    const bscEmitter = sdk.getEmitterAddressEth(BSC_CONTRACT_ADDRESS_STR);

    const solanaEmitterPDAHex = await sdk.getEmitterAddressSolana(
      SOLANA_CONTRACT_ADDRESS
    );

    console.log("EthDevEmitter: " + ethEmitter);
    console.log("BscDevEmitter: " + bscEmitter);
    console.log("SolDevEmitter: " + solanaEmitterPDAHex);

    // create a keypair for Solana
    const SOLANA_PRIVATE_KEY = new Uint8Array([
      14, 173, 153, 4, 176, 224, 201, 111, 32, 237, 183, 185, 159, 247, 22, 161,
      89, 84, 215, 209, 212, 137, 10, 92, 157, 49, 29, 192, 101, 164, 152, 70,
      87, 65, 8, 174, 214, 157, 175, 126, 98, 90, 54, 24, 100, 177, 247, 77, 19,
      112, 47, 44, 165, 109, 233, 102, 14, 86, 109, 29, 134, 145, 132, 141,
    ]);
    const keypair = Keypair.fromSecretKey(SOLANA_PRIVATE_KEY);
    const payerAddress = keypair.publicKey;

    // Create register_chain instruction using wasm to rust.
    const { register_chain_ix } = await require("../nodejs");
    const connection = new Connection("http://localhost:8899", "confirmed");

    // Register all chaind in solana contract.
    await registerChainOnSolana(
      SOLANA_CONTRACT_ADDRESS,
      register_chain_ix,
      payerAddress,
      sdk.CHAIN_ID_ETH,
      ethEmitter,
      connection,
      keypair
    );
    await registerChainOnSolana(
      SOLANA_CONTRACT_ADDRESS,
      register_chain_ix,
      payerAddress,
      sdk.CHAIN_ID_BSC,
      bscEmitter,
      connection,
      keypair
    );
    await registerChainOnSolana(
      SOLANA_CONTRACT_ADDRESS,
      register_chain_ix,
      payerAddress,
      sdk.CHAIN_ID_SOLANA,
      solanaEmitterPDAHex,
      connection,
      keypair
    );
  } catch (e) {
    console.log("Caught Exception: " + e);
  }

  async function registerChainOnSolana(
    solanaContractAddr,
    register_chain_ix,
    payerAddress,
    chainId,
    emitterAddress,
    connection,
    keypair
  ) {
    const ix = sdk.ixFromRust(
      register_chain_ix(
        solanaContractAddr,
        payerAddress.toString(),
        chainId,
        emitterAddress
      )
    );
    // console.log("payerAddress: " + payerAddress);
    // Create register_chain transaction and call it.
    const transaction = new Transaction().add(ix);
    const { blockhash } = await connection.getRecentBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payerAddress;
    transaction.partialSign(keypair);
    const txid = await connection.sendRawTransaction(transaction.serialize());
    // console.log("txid: " + txid);
    await connection.confirmTransaction(txid);
  }
})();
