import { createClient } from "redis";

import {
  ChainId,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  hexToUint8Array,
  uint8ArrayToHex,
  parseTransferPayload,
  getEmitterAddressEth,
  getEmitterAddressSolana,
  getEmitterAddressTerra,
} from "@certusone/wormhole-sdk";

import {
  createSpyRPCServiceClient,
  subscribeSignedVAA,
} from "@certusone/wormhole-spydk";

import {
  importCoreWasm,
  setDefaultWasm,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import * as helpers from "./helpers";

export async function spy_listen() {
  require("dotenv").config();
  if (!process.env.SPY_SERVICE_HOST) {
    console.error("Missing environment variable SPY_SERVICE_HOST");
    process.exit(1);
  }

  console.log(
    "spy_relay starting up, will listen for signed VAAs from [%s]",
    process.env.SPY_SERVICE_HOST
  );

  // Connect to redis
  var myRedisClient = connectToRedis();

  setDefaultWasm("node");

  (async () => {
    var filter = {};
    if (process.env.SPY_SERVICE_FILTERS) {
      const parsedJsonFilters = eval(process.env.SPY_SERVICE_FILTERS);

      var myFilters = [];
      for (var i = 0; i < parsedJsonFilters.length; i++) {
        var myChainId = parseInt(parsedJsonFilters[i].chain_id) as ChainId;
        var myEmitterAddress = await encodeEmitterAddress(
          myChainId,
          parsedJsonFilters[i].emitter_address
        );
        var myEmitterFilter = {
          emitterFilter: {
            chainId: myChainId,
            emitterAddress: myEmitterAddress,
          },
        };
        console.log(
          "adding filter: chainId: [%i], emitterAddress: [%s]",
          myEmitterFilter.emitterFilter.chainId,
          myEmitterFilter.emitterFilter.emitterAddress
        );
        myFilters.push(myEmitterFilter);
      }

      console.log("setting", myFilters.length, "filters");
      filter = {
        filters: myFilters,
      };
    } else {
      console.log("processing all signed VAAs");
    }

    const client = createSpyRPCServiceClient(process.env.SPY_SERVICE_HOST);
    const stream = await subscribeSignedVAA(client, filter);

    const { parse_vaa } = await importCoreWasm();

    stream.on("data", ({ vaaBytes }) => {
      processVaa(myRedisClient, parse_vaa, vaaBytes);
    });

    console.log("spy_relay waiting for transfer signed VAAs");
  })();
}

async function encodeEmitterAddress(
  myChainId,
  emitterAddressStr
): Promise<string> {
  if (myChainId === CHAIN_ID_SOLANA) {
    return await getEmitterAddressSolana(emitterAddressStr);
  }

  if (myChainId === CHAIN_ID_TERRA) {
    return await getEmitterAddressTerra(emitterAddressStr);
  }

  return getEmitterAddressEth(emitterAddressStr);
}

function processVaa(myRedisClient, parse_vaa, vaaBytes) {
  // console.log(vaaBytes);
  const parsedVAA = parse_vaa(hexToUint8Array(vaaBytes));
  // console.log(parsedVAA);
  if (parsedVAA.payload[0] === 1) {
    var storeKey = helpers.storeKeyFromParsedVAA(parsedVAA);
    var storePayload = helpers.storePayloadFromVaaBytes(vaaBytes);
    // console.log("storeKey: ", helpers.storeKeyToJson(storeKey));
    // console.log("storePayload: ", helpers.storePayloadToJson(storePayload));
    console.log(
      "storing: key: [%d/%s/%d], payload: [%s]",
      storeKey.chain_id,
      storeKey.emitter_address,
      storeKey.sequence,
      helpers.storePayloadToJson(storePayload)
    );
    storeInRedis(
      myRedisClient,
      helpers.storeKeyToJson(storeKey),
      helpers.storePayloadToJson(storePayload)
    );

    var transferPayload = parseTransferPayload(Buffer.from(parsedVAA.payload));
    console.log(
      "transfer: emitter: [%d:%s], seqNum: %d, payload: origin: [%d:%s], target: [%d:%s],  amount: %d",
      parsedVAA.emitter_chain,
      uint8ArrayToHex(parsedVAA.emitter_address),
      parsedVAA.sequence,
      transferPayload.originChain,
      transferPayload.originAddress,
      transferPayload.targetChain,
      transferPayload.targetAddress,
      transferPayload.amount
    );
    // console.log(transferPayload);
  }
}

async function connectToRedis() {
  var rClient = createClient();

  rClient.on("error", (err) => console.log("Redis writer client error", err));
  rClient.on("connect", (err) =>
    console.log("Redis writer client connected", err)
  );

  await rClient.connect();
  return rClient;
}

async function storeInRedis(myRedisClient, name: string, value: string) {
  await (await myRedisClient).set(name, value);
}
