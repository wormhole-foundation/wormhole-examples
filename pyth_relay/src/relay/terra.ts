import { hexToUint8Array } from "@certusone/wormhole-sdk";
import { redeemOnTerra, transferFromTerra } from "@certusone/wormhole-sdk";
import { LCDClient, MnemonicKey, Msg, Wallet } from "@terra-money/terra.js";
import { ChainConfigInfo } from "../configureEnv";
import { fromUint8Array } from "js-base64";
import { importCoreWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import * as helpers from "../helpers";

export async function relayTerra(
  chainConfigInfo: ChainConfigInfo,
  signedVAA: string,
  terraChainId: string,
  gassPriceUrl: string
) {
  const signedVaaArray = hexToUint8Array(signedVAA);
  const lcdConfig = {
    URL: chainConfigInfo.nodeUrl,
    chainID: terraChainId,
    name: "localhost",
  };
  const lcd = new LCDClient(lcdConfig);
  const mk = new MnemonicKey({
    mnemonic: chainConfigInfo.walletPrivateKey,
  });
  const wallet = lcd.wallet(mk);

  console.log(
    "relaying to terra, terraChainId: [%s], private key: [%s], contractAddress: [%s], accAddress: [%s], pythData: [%s]",
    terraChainId,
    chainConfigInfo.walletPrivateKey,
    chainConfigInfo.contractAddress,
    wallet.key.accAddress,
    signedVAA
  );

  // It is not a bug to call redeem here, since it creates a submit_vaa message, which is what we want.
  const msg = await redeemOnTerra(
    chainConfigInfo.contractAddress,
    wallet.key.accAddress,
    signedVaaArray
  );

  //Alternate FCD methodology
  //let gasPrices = await axios.get("http://localhost:3060/v1/txs/gas_prices").then((result) => result.data);
  const gasPrices = await lcd.config.gasPrices;

  //const walletSequence = await wallet.sequence();
  const feeEstimate = await lcd.tx.estimateFee(wallet.key.accAddress, [msg], {
    //TODO figure out type mismatch
    feeDenoms: ["uluna"],
    gasPrices,
  });

  const tx = await wallet.createAndSignTx({
    msgs: [msg],
    memo: "Relayer - Complete Transfer",
    feeDenoms: ["uluna"],
    gasPrices,
    fee: feeEstimate,
  });

  const receipt = await lcd.tx.broadcast(tx);
  console.log("submitted to terra: receipt:", receipt);
  return { redeemed: true, result: receipt };
}

export async function queryTerra(
  chainConfigInfo: ChainConfigInfo,
  terraChainId: string,
  productIdStr: string
) {
  const encodedProductId = fromUint8Array(hexToUint8Array(productIdStr));

  console.log(
    "Querying terra for price info for productId [%s], encoded as [%s]",
    productIdStr,
    encodedProductId
  );

  const lcdConfig = {
    URL: chainConfigInfo.nodeUrl,
    chainID: terraChainId,
    name: "localhost",
  };
  const lcd = new LCDClient(lcdConfig);

  const query_result = await lcd.wasm.contractQuery(
    chainConfigInfo.contractAddress,
    {
      price_info: {
        product_id: encodedProductId,
      },
    }
  );

  console.log("queryTerra: query returned:", query_result);
  return query_result;
}
