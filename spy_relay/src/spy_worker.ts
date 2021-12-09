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

export async function spy_worker() {
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
      redisClient.on("connect", function (err) {
        if (err) {
          console.error("Redis reader client failed to connect to Redis:", err);
        } else {
          console.log("Redis reader client connected");
        }
      });
      await redisClient.connect();
      for await (const si_key of redisClient.scanIterator()) {
        const si_keyval = await redisClient.get(si_key);
        if (si_keyval) {
          console.log("SI: %s => %s", si_key, si_keyval);
        } else {
          console.error("No si_keyval returned!");
        }
      }
      // for (var i = 0; i < 5; i++) {
      //   await sleep(1000 * myWorkerIdx);
      //   console.log("worker %d: %d", myWorkerIdx, i);
      // }

      console.log("worker %d exiting", myWorkerIdx);
      await redisClient.quit();
    })();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
