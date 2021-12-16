import { importCoreWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import {
  ChainId,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  hexToUint8Array,
  isEVMChain,
  parseTransferPayload,
} from "@certusone/wormhole-sdk";

import { RelayerEnvironment, validateEnvironment } from "../configureEnv";
import { relayEVM } from "./evm";
import { relaySolana } from "./solana";
import { relayTerra } from "./terra";

const env: RelayerEnvironment = validateEnvironment();

function getChainConfigInfo(chainId: ChainId) {
  return env.supportedChains.find((x) => x.chainId === chainId);
}

export async function relay(signedVAA: string): Promise<any> {
  const { parse_vaa } = await importCoreWasm();
  const parsedVAA = parse_vaa(hexToUint8Array(signedVAA));
  if (parsedVAA.payload[0] === 1) {
    var transferPayload = parseTransferPayload(Buffer.from(parsedVAA.payload));

    const unwrapNative = false;
    const chainConfigInfo = getChainConfigInfo(transferPayload.targetChain);
    if (!chainConfigInfo) {
      console.error("Improper chain ID:", transferPayload.targetChain);
      return "invalid chain id";
    }

    if (isEVMChain(transferPayload.targetChain)) {
      return await relayEVM(chainConfigInfo, signedVAA, unwrapNative);
    }

    if (transferPayload.targetChain === CHAIN_ID_SOLANA) {
      return await relaySolana(chainConfigInfo, signedVAA);
    }

    if (transferPayload.targetChain === CHAIN_ID_TERRA) {
      if (!process.env.TERRA_CHAIN_ID) {
        return "TERRA_CHAIN_ID env parameter is not set!";
      }

      if (!process.env.TERRA_GAS_PRICES_URL) {
        return "TERRA_GAS_PRICES_URL env parameter is not set!";
      }

      return await relayTerra(
        chainConfigInfo,
        signedVAA,
        process.env.TERRA_CHAIN_ID,
        process.env.TERRA_GAS_PRICES_URL
      );
    }

    console.error("Improper chain ID");
    return "invalid chain id";
  }
}
