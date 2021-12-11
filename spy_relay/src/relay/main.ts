import {
  ChainId,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  isEVMChain,
} from "@certusone/wormhole-sdk";
import { RelayerEnvironment, validateEnvironment } from "../configureEnv";
import { relayEVM } from "./evm";
import { relaySolana } from "./solana";
import { relayTerra } from "./terra";

const env: RelayerEnvironment = validateEnvironment();

function getChainConfigInfo(chainId: ChainId) {
  return env.supportedChains.find((x) => x.chainId === chainId);
}

export async function relay(chainId: ChainId, signedVAA) {
  const unwrapNative = false;
  const chainConfigInfo = getChainConfigInfo(chainId);
  if (!chainConfigInfo) {
    console.error("Improper chain ID:", chainId);
    return [false, "invalid chain id"];
  }

  if (isEVMChain(chainId)) {
    await relayEVM(chainConfigInfo, signedVAA, unwrapNative);
  } else if (chainId === CHAIN_ID_SOLANA) {
    await relaySolana(chainConfigInfo, signedVAA);
  } else if (chainId === CHAIN_ID_TERRA) {
    await relayTerra(chainConfigInfo, signedVAA);
  } else {
    console.error("Improper chain ID");
    throw "invalid chain id";
  }
}
