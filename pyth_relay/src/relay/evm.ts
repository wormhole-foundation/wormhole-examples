import {
  getIsTransferCompletedEth,
  hexToUint8Array,
  redeemOnEth,
  redeemOnEthNative,
} from "@certusone/wormhole-sdk";
import { ethers } from "ethers";
import { ChainConfigInfo } from "../configureEnv";

export async function relayEVM(
  chainConfigInfo: ChainConfigInfo,
  signedVAA: string,
  unwrapNative: boolean
) {
  const signedVaaArray = hexToUint8Array(signedVAA);
  const provider = new ethers.providers.WebSocketProvider(
    chainConfigInfo.nodeUrl
  );
  // console.log(
  //   "relaying to evm, private key: [%s]",
  //   chainConfigInfo.walletPrivateKey
  // );
  const signer = new ethers.Wallet(chainConfigInfo.walletPrivateKey, provider);
  const receipt = unwrapNative
    ? await redeemOnEthNative(
        chainConfigInfo.contractAddress,
        signer,
        signedVaaArray
      )
    : await redeemOnEth(
        chainConfigInfo.contractAddress,
        signer,
        signedVaaArray
      );

  console.log("redeemed on evm: receipt:", receipt);

  var success = await getIsTransferCompletedEth(
    chainConfigInfo.contractAddress,
    provider,
    signedVaaArray
  );

  provider.destroy();

  console.log("redeemed on evm: success:", success, ", receipt:", receipt);
  return { redeemed: success, result: receipt };
}
