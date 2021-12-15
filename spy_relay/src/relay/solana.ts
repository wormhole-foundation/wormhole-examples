import {
  getIsTransferCompletedSolana,
  hexToUint8Array,
  postVaaSolana,
} from "@certusone/wormhole-sdk";
import { redeemOnSolana } from "@certusone/wormhole-sdk";
import { Connection, Keypair } from "@solana/web3.js";
import { TextEncoder } from "util";
import { ChainConfigInfo } from "../configureEnv";

export async function relaySolana(
  chainConfigInfo: ChainConfigInfo,
  signedVAAString: string
) {
  //TODO native transfer & create associated token account
  //TODO close connection
  const signedVaaArray = hexToUint8Array(signedVAAString);
  const signedVaaBuffer = Buffer.from(signedVaaArray);
  const connection = new Connection(chainConfigInfo.nodeUrl, "confirmed");
  // console.log(
  //   "relaying to solana, private key: [%s], bridgeAddress: [%s], signedVAAString: [%s]",
  //   chainConfigInfo.walletPrivateKey,
  //   chainConfigInfo.bridgeAddress,
  //   signedVAAString,
  //   ", signedVaaArray",
  //   signedVaaArray,
  //   ", signedVaaBuffer",
  //   signedVaaBuffer
  // );
  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(chainConfigInfo.walletPrivateKey))
  );
  const payerAddress = keypair.publicKey.toString();
  await postVaaSolana(
    connection,
    async (transaction) => {
      transaction.partialSign(keypair);
      return transaction;
    },
    chainConfigInfo.bridgeAddress,
    payerAddress,
    signedVaaBuffer
  );
  const unsignedTransaction = await redeemOnSolana(
    connection,
    chainConfigInfo.bridgeAddress,
    chainConfigInfo.tokenBridgeAddress,
    payerAddress,
    signedVaaArray
  );
  unsignedTransaction.partialSign(keypair);
  const txid = await connection.sendRawTransaction(
    unsignedTransaction.serialize()
  );
  await connection.confirmTransaction(txid);

  var success = await getIsTransferCompletedSolana(
    chainConfigInfo.tokenBridgeAddress,
    signedVaaArray,
    connection
  );

  console.log("redeemed on solana: success:", success, ", txid:", txid);
  return { redeemed: success, result: txid };
}
