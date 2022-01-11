import { Wallet, LCDClient, MnemonicKey } from "@terra-money/terra.js";
import {
  StdFee,
  MsgInstantiateContract,
  MsgExecuteContract,
  MsgStoreCode,
} from "@terra-money/terra.js";
import { readFileSync, readdirSync, writeFile } from "fs";

// TODO: Workaround /tx/estimate_fee errors.

const gas_prices = {
  uluna: "0.15",
  usdr: "0.1018",
  uusd: "0.15",
  ukrw: "178.05",
  umnt: "431.6259",
  ueur: "0.125",
  ucny: "0.97",
  ujpy: "16",
  ugbp: "0.11",
  uinr: "11",
  ucad: "0.19",
  uchf: "0.13",
  uaud: "0.19",
  usgd: "0.2",
};

async function main() {
  const terra = new LCDClient({
    URL: "http://localhost:1317",
    chainID: "localterra",
  });

  const wallet = terra.wallet(
    new MnemonicKey({
      mnemonic:
        "notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius",
    })
  );

  await wallet.sequence();

  // Deploy WASM blobs.
  // Read a list of files from directory containing compiled contracts.
  const artifacts = readdirSync("../artifacts/");

  // Sort them to get a determinstic list for consecutive code ids.
  artifacts.sort();
  artifacts.reverse();

  console.log(artifacts);

  const hardcodedGas = {
    "wormhole_messenger_terra.wasm": 4000000,
  };

  const codeIds = {};
  const addresses = {};

  // Deploy found WASM files and assign Code IDs.
  for (const artifact in artifacts) {
    if (
      artifacts.hasOwnProperty(artifact) &&
      artifacts[artifact].includes(".wasm")
    ) {
      const file = artifacts[artifact];
      const contract_bytes = readFileSync(`../artifacts/${file}`);

      console.log(`Storing WASM: ${file} (${contract_bytes.length} bytes)`);

      const store_code = new MsgStoreCode(
        wallet.key.accAddress,
        contract_bytes.toString("base64")
      );

      try {
        const tx = await wallet.createAndSignTx({
          msgs: [store_code],
          memo: "",
          fee: new StdFee(hardcodedGas[artifacts[artifact]], {
            uluna: "100000",
          }),
        });

        console.log("step1 done");

        const rs = await terra.tx.broadcast(tx);
        const ci = /"code_id","value":"([^"]+)/gm.exec(rs.raw_log)[1];
        codeIds[file] = parseInt(ci);
      } catch (e) {
        console.log("Failed to Execute" + e);
      }
    }
  }

  console.log(codeIds);

  // Instantiate messenger
  console.log("Instantiating messenger");
  await wallet
    .createAndSignTx({
      msgs: [
        new MsgInstantiateContract(
          wallet.key.accAddress,
          wallet.key.accAddress,
          codeIds["wormhole_messenger_terra.wasm"],
          {
            // TBD...
            version: "1.0.0",
          }
        ),
      ],
      memo: "",
    })
    .then((tx) => terra.tx.broadcast(tx))
    .then((rs) => {
      const address = /"contract_address","value":"([^"]+)/gm.exec(
        rs.raw_log
      )[1];
      addresses["wormhole_messenger_terra.wasm"] = address;
    });

  console.log(addresses);

  // store contract address.
  writeFile(
    "/address/terra.js",
    'export const address = "' +
      addresses["wormhole_messenger_terra.wasm"] +
      '"',
    (err) => {
      if (err) {
        console.error(err);
      }
    }
  );
}

main();
