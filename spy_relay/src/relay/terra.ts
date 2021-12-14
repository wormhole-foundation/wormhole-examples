import { hexToUint8Array } from "@certusone/wormhole-sdk";
import { redeemOnTerra, transferFromTerra } from "@certusone/wormhole-sdk";
import { LCDClient, MnemonicKey, Msg, Wallet } from "@terra-money/terra.js";
import { ChainConfigInfo } from "../configureEnv";

export async function relayTerra(
  chainConfigInfo: ChainConfigInfo,
  signedVAA: string,
  terraChainId: string
) {
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

  // console.log(
  //   "relaying to terra, terraChainId: [%s], private key: [%s], tokenBridgeAddress: [%s], accAddress: [%s], signedVAA: [%s]",
  //   terraChainId,
  //   chainConfigInfo.walletPrivateKey,
  //   chainConfigInfo.tokenBridgeAddress,
  //   wallet.key.accAddress,
  //   signedVAA
  // );

  const msg = await redeemOnTerra(
    chainConfigInfo.tokenBridgeAddress,
    wallet.key.accAddress,
    hexToUint8Array(signedVAA)
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

  console.log("redeemed on terra: receipt:", receipt);
  return receipt;
}
