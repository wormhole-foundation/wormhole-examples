// import {
//   createSpyRPCServiceClient,
//   subscribeSignedVAA,
// } from "@certusone/wormhole-spydk";

// import {
//   ChainId,
//   CHAIN_ID_SOLANA,
//   CHAIN_ID_TERRA,
//   hexToUint8Array,
//   uint8ArrayToHex,
//   parseTransferPayload,
//   getEmitterAddressEth,
//   getEmitterAddressSolana,
//   getEmitterAddressTerra,
// } from "@certusone/wormhole-sdk";

import {
  importCoreWasm,
  setDefaultWasm,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import { createClient } from "redis";
import { isAnyArrayBuffer } from "util/types";

// import { storeKeyFromParsedVAA, storePayloadFromVaaBytes } from "./helpers";
import * as helpers from "./helpers";
import { connectRelayer, relay } from "./relay/main";

export async function worker() {
  require("dotenv").config();
  var numWorkers = 1;
  if (process.env.NUM_WORKERS) {
    numWorkers = parseInt(process.env.NUM_WORKERS);
    console.log("will use %d workers", numWorkers);
  }

  setDefaultWasm("node");

  for (var workerIdx = 0; workerIdx < numWorkers; ++workerIdx) {
    console.log("starting worker %d", workerIdx);
    (async () => {
      let myWorkerIdx = workerIdx;
      let connectionData = connectRelayer();
      const redisClient = createClient();
      redisClient.on("connect", function (err) {
        if (err) {
          console.error("Redis reader client failed to connect to Redis:", err);
        } else {
          console.log("[%d]Redis reader client connected", myWorkerIdx);
        }
      });
      await redisClient.connect();
      while (true) {
        await redisClient.select(helpers.INCOMING);
        for await (const si_key of redisClient.scanIterator()) {
          const si_value = await redisClient.get(si_key);
          if (si_value) {
            // console.log("SI: %s => %s", si_key, si_value);
            // Get result from evaluation algorithm
            // If true, then do the transfer
            const shouldDo = evaluate(si_value);
            if (shouldDo) {
              // Move this entry to from incoming store to working store
              await redisClient.select(helpers.INCOMING);
              if ((await redisClient.del(si_key)) === 0) {
                console.log(
                  "[%d]The key [%s] no longer exists in INCOMING",
                  myWorkerIdx,
                  si_key
                );
                return;
              }
              await redisClient.select(helpers.WORKING);
              var oldPayload = helpers.storePayloadFromJson(si_value);
              var newPayload: helpers.StoreWorkingPayload;
              newPayload = helpers.initWorkingPayload();
              newPayload.vaa_bytes = oldPayload.vaa_bytes;
              await redisClient.set(
                si_key,
                helpers.workingPayloadToJson(newPayload)
              );

              // I think our redis key needs to change to be productId and priceType.

              // Process the request
              await processRequest(redisClient, si_key, connectionData);
            }
          } else {
            console.error("No si_keyval returned!");
          }
        }
        // add sleep
        await helpers.sleep(3000);
      }

      console.log("worker %d exiting", myWorkerIdx);
      await redisClient.quit();
    })();
    // Stagger the threads so they don't all wake up at once
    await helpers.sleep(500);
  }
}

function evaluate(blob: string) {
  // console.log("Checking [%s]", blob);
  // if (blob.startsWith("01000000000100e", 14)) {
  // if (Math.floor(Math.random() * 5) == 1) {
  // console.log("Evaluated true...");
  return true;
  // }
  // console.log("Evaluated false...");
  // return false;
}

async function processRequest(rClient, key: string, connectionData: any) {
  console.log("Processing request [%s]...", key);
  // Get the entry from the working store
  await rClient.select(helpers.WORKING);
  var value: string = await rClient.get(key);
  if (!value) {
    console.error("processRequest could not find key [%s]", key);
    return;
  }
  var storeKey = helpers.storeKeyFromJson(key);
  var payload: helpers.StoreWorkingPayload =
    helpers.workingPayloadFromJson(value);
  if (payload.status !== "Pending") {
    console.log("This key [%s] has already been processed.", key);
    return;
  }
  // Actually do the processing here and update status and time field
  try {
    console.log(
      "processRequest() - Calling with vaa_bytes [%s]",
      payload.vaa_bytes
    );
    var relayResult = await relay(payload.vaa_bytes, connectionData);
    // console.log("processRequest() - relay returned", relayResult);
    payload.status = relayResult;
  } catch (e) {
    console.error("processRequest() - failed to relay transfer vaa:", e);
    payload.status = "Failed: " + e;
  }
  // Put result back into store
  payload.timestamp = new Date().toString();
  value = helpers.workingPayloadToJson(payload);
  await rClient.set(key, value);
}
