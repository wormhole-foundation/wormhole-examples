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
import { relayTerra, queryTerra } from "./terra";

const env: RelayerEnvironment = validateEnvironment();

function getChainConfigInfo(chainId: ChainId) {
  return env.supportedChains.find((x) => x.chainId === chainId);
}

export async function relay(signedVAA: string): Promise<any> {
  var chainConfigInfo = getChainConfigInfo(CHAIN_ID_TERRA);
  if (chainConfigInfo) {
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

  return "no target chains configured";
}

export async function query(productIdStr: string): Promise<any> {
  var chainConfigInfo = getChainConfigInfo(CHAIN_ID_TERRA);
  if (chainConfigInfo) {
    if (!process.env.TERRA_CHAIN_ID) {
      return "TERRA_CHAIN_ID env parameter is not set!";
    }

    if (!process.env.TERRA_GAS_PRICES_URL) {
      return "TERRA_GAS_PRICES_URL env parameter is not set!";
    }

    return await queryTerra(
      chainConfigInfo,
      process.env.TERRA_CHAIN_ID,
      productIdStr
    );
  }

  return "no target chains configured";
}
