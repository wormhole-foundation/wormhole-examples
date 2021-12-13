import {
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
        chainConfigInfo.tokenBridgeAddress,
        signer,
        hexToUint8Array(signedVAA)
      )
    : await redeemOnEth(
        chainConfigInfo.tokenBridgeAddress,
        signer,
        hexToUint8Array(signedVAA)
      );
  provider.destroy();
  console.log("redeemed on evm: receipt:", receipt);
}
