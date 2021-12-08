import {
  createSpyRPCServiceClient,
  subscribeSignedVAA,
} from "@certusone/wormhole-spydk";

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
  importCoreWasm,
  setDefaultWasm,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import { createClient } from "redis";

// import { storeKeyFromParsedVAA, storePayloadFromVaaBytes } from "./helpers";
import * as helpers from "./helpers";

require("dotenv").config();
var numWorkers = 1;
if (process.env.SPY_NUM_WORKERS) {
  numWorkers = parseInt(process.env.SPY_NUM_WORKERS);
  console.log("will use %d workers", numWorkers);
}

setDefaultWasm("node");

for (var workerIdx = 0; workerIdx < numWorkers; ++workerIdx) {
  console.log("staring worker %d", workerIdx);
  (async () => {
    let myWorkerIdx = workerIdx;
    const redisClient = createClient();
    redisClient.on("error", (err) => console.log("Redis Client Error", err));
    redisClient.on("connect", (err) =>
      console.log("Redis Client Connected", err)
    );
    await redisClient.connect();
    var keysReply = await redisClient.keys("*");
    if (keysReply) {
      console.log("keysReply: ", keysReply);
      keysReply.forEach(async (element) => {
        var keyVal = await redisClient.get(element);
        if (keyVal) {
          console.log("%s => %s", element, keyVal);
        } else {
          console.log("No keyVal returned.");
        }
      });
    } else {
      console.log("No keysReply");
    }
    // for (var i = 0; i < 5; i++) {
    //   await sleep(1000 * myWorkerIdx);
    //   console.log("worker %d: %d", myWorkerIdx, i);
    // }

    console.log("worker %d exiting", myWorkerIdx);
    await redisClient.quit();
  })();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
