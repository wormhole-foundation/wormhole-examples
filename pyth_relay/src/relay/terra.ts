import { fromUint8Array } from "js-base64";
import { LCDClient, MnemonicKey, Msg, Wallet } from "@terra-money/terra.js";
import { hexToUint8Array } from "@certusone/wormhole-sdk";
import { redeemOnTerra } from "@certusone/wormhole-sdk";

type TerraConfigData = {
  nodeUrl: string;
  terraChainId: string;
  walletPrivateKey: string;
  contractAddress: string;
};

export type TerraConnectionData = {
  config: TerraConfigData;
  lcdClient: LCDClient;
  wallet: Wallet;
};

export function connectToTerra(): TerraConnectionData {
  if (!process.env.TERRA_NODE_URL) {
    console.error("Missing environment variable TERRA_NODE_URL");
    process.exit(1);
  }

  if (!process.env.TERRA_CHAIN_ID) {
    console.error("Missing environment variable TERRA_CHAIN_ID");
    process.exit(1);
  }

  if (!process.env.TERRA_PRIVATE_KEY) {
    console.error("Missing environment variable TERRA_PRIVATE_KEY");
    process.exit(1);
  }

  if (!process.env.TERRA_PYTH_CONTRACT_ADDRESS) {
    console.error("Missing environment variable TERRA_PYTH_CONTRACT_ADDRESS");
    process.exit(1);
  }

  const config: TerraConfigData = {
    nodeUrl: process.env.TERRA_NODE_URL,
    terraChainId: process.env.TERRA_CHAIN_ID,
    walletPrivateKey: process.env.TERRA_PRIVATE_KEY,
    contractAddress: process.env.TERRA_PYTH_CONTRACT_ADDRESS,
  };

  console.log(
    "connecting to Terra: url: [%s], terraChainId: [%s], contractAddress: [%s]",
    config.nodeUrl,
    config.terraChainId,
    config.contractAddress
  );

  const lcdConfig = {
    URL: config.nodeUrl,
    chainID: config.terraChainId,
    name: "localhost",
  };

  const lcdClient = new LCDClient(lcdConfig);

  const mk = new MnemonicKey({
    mnemonic: config.walletPrivateKey,
  });

  const wallet = lcdClient.wallet(mk);

  return { config: config, lcdClient: lcdClient, wallet: wallet };
}

export async function relayTerra(
  connectionData: TerraConnectionData,
  signedVAA: string
) {
  const signedVaaArray = hexToUint8Array(signedVAA);
  console.log("relaying to terra, pythData: [%s]", signedVAA);

  console.log("DEBUG: creating message,", new Date().toISOString());
  // It is not a bug to call redeem here, since it creates a submit_vaa message, which is what we want.
  const msg = await redeemOnTerra(
    connectionData.config.contractAddress,
    connectionData.wallet.key.accAddress,
    signedVaaArray
  );

  console.log("DEBUG: looking up gas,", new Date().toISOString());
  //Alternate FCD methodology
  //let gasPrices = await axios.get("http://localhost:3060/v1/txs/gas_prices").then((result) => result.data);
  const gasPrices = connectionData.lcdClient.config.gasPrices;

  console.log("DEBUG: estimating fees,", new Date().toISOString());
  //const walletSequence = await wallet.sequence();
  const feeEstimate = await connectionData.lcdClient.tx.estimateFee(
    connectionData.wallet.key.accAddress,
    [msg],
    {
      //TODO figure out type mismatch
      feeDenoms: ["uluna"],
      gasPrices,
    }
  );

  console.log("DEBUG: creating transaction,", new Date().toISOString());
  const tx = await connectionData.wallet.createAndSignTx({
    msgs: [msg],
    memo: "Relayer - Complete Transfer",
    feeDenoms: ["uluna"],
    gasPrices,
    fee: feeEstimate,
  });

  console.log("DEBUG: sending msg,", new Date().toISOString());
  const receipt = await connectionData.lcdClient.tx.broadcast(tx);
  console.log("DEBUG: done,", new Date().toISOString());
  console.log("submitted to terra: receipt:", receipt);
  return { redeemed: true, result: receipt };
}

export async function queryTerra(
  connectionData: TerraConnectionData,
  productIdStr: string
) {
  const encodedProductId = fromUint8Array(hexToUint8Array(productIdStr));

  console.log(
    "Querying terra for price info for productId [%s], encoded as [%s]",
    productIdStr,
    encodedProductId
  );

  const query_result = await connectionData.lcdClient.wasm.contractQuery(
    connectionData.config.contractAddress,
    {
      price_info: {
        product_id: encodedProductId,
      },
    }
  );

  console.log("queryTerra: query returned:", query_result);
  return query_result;
}
