import { fromUint8Array } from "js-base64";
import { LCDClient, MnemonicKey, Msg, Wallet } from "@terra-money/terra.js";
import { hexToUint8Array } from "@certusone/wormhole-sdk";
import { redeemOnTerra } from "@certusone/wormhole-sdk";

import { logger } from "../helpers";

type TerraConfigData = {
  nodeUrl: string;
  terraChainId: string;
  terraName: string;
  walletPrivateKey: string;
  contractAddress: string;
};

export type TerraConnectionData = {
  config: TerraConfigData;
  lcdClient: LCDClient;
  wallet: Wallet;
};

export function connectToTerra(workerIdx: number): TerraConnectionData {
  if (!process.env.TERRA_NODE_URL) {
    logger.error("Missing environment variable TERRA_NODE_URL");
    process.exit(1);
  }

  if (!process.env.TERRA_CHAIN_ID) {
    logger.error("Missing environment variable TERRA_CHAIN_ID");
    process.exit(1);
  }

  if (!process.env.TERRA_NAME) {
    logger.error("Missing environment variable TERRA_NAME");
    process.exit(1);
  }

  if (!process.env.TERRA_PRIVATE_KEY) {
    logger.error("Missing environment variable TERRA_PRIVATE_KEY");
    process.exit(1);
  }

  if (!process.env.TERRA_PYTH_CONTRACT_ADDRESS) {
    logger.error("Missing environment variable TERRA_PYTH_CONTRACT_ADDRESS");
    process.exit(1);
  }

  const config: TerraConfigData = {
    nodeUrl: process.env.TERRA_NODE_URL,
    terraChainId: process.env.TERRA_CHAIN_ID,
    terraName: process.env.TERRA_NAME,
    walletPrivateKey: process.env.TERRA_PRIVATE_KEY,
    contractAddress: process.env.TERRA_PYTH_CONTRACT_ADDRESS,
  };

  logger.info(
    "[" +
      workerIdx +
      "] connecting to Terra: url: [" +
      config.nodeUrl +
      "], terraChainId: [" +
      config.terraChainId +
      "], terraName: [" +
      config.terraName +
      "], contractAddress: [" +
      config.contractAddress +
      "]"
  );

  const lcdConfig = {
    URL: config.nodeUrl,
    chainID: config.terraChainId,
    name: config.terraName,
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
  logger.debug("relaying to terra, pythData: [" + signedVAA + "]");

  logger.debug("TIME: creating message,", new Date().toISOString());
  // It is not a bug to call redeem here, since it creates a submit_vaa message, which is what we want.
  const msg = await redeemOnTerra(
    connectionData.config.contractAddress,
    connectionData.wallet.key.accAddress,
    signedVaaArray
  );

  logger.debug("TIME: looking up gas,", new Date().toISOString());
  //Alternate FCD methodology
  //let gasPrices = await axios.get("http://localhost:3060/v1/txs/gas_prices").then((result) => result.data);
  const gasPrices = connectionData.lcdClient.config.gasPrices;

  logger.debug("TIME: estimating fees,", new Date().toISOString());
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

  logger.debug("TIME: creating transaction,", new Date().toISOString());
  const tx = await connectionData.wallet.createAndSignTx({
    msgs: [msg],
    memo: "Relayer - Complete Transfer",
    feeDenoms: ["uluna"],
    gasPrices,
    fee: feeEstimate,
  });

  logger.debug("TIME: sending msg,", new Date().toISOString());
  const receipt = await connectionData.lcdClient.tx.broadcast(tx);
  logger.debug("TIME: done,", new Date().toISOString());
  logger.debug("TIME:submitted to terra: receipt: %o", receipt);
  return receipt;
}

export async function queryTerra(
  connectionData: TerraConnectionData,
  productIdStr: string
) {
  const encodedProductId = fromUint8Array(hexToUint8Array(productIdStr));

  logger.info(
    "Querying terra for price info for productId [" +
      productIdStr +
      "], encoded as [" +
      encodedProductId +
      "]"
  );

  const query_result = await connectionData.lcdClient.wasm.contractQuery(
    connectionData.config.contractAddress,
    {
      price_info: {
        product_id: encodedProductId,
      },
    }
  );

  logger.info("queryTerra: query returned: %o", query_result);
  return query_result;
}
