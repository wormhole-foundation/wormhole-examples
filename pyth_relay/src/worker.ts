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
import { logger } from "./helpers";
import { connectRelayer, relay } from "./relay/main";

export async function worker() {
  require("dotenv").config();
  var numWorkers = 1;
  if (process.env.NUM_WORKERS) {
    numWorkers = parseInt(process.env.NUM_WORKERS);
    logger.info("will use " + numWorkers + " workers ");
  }

  setDefaultWasm("node");

  for (var workerIdx = 0; workerIdx < numWorkers; ++workerIdx) {
    logger.debug("[" + workerIdx + "] starting worker ");
    (async () => {
      let myWorkerIdx = workerIdx;
      let connectionData = connectRelayer();
      const redisClient = createClient();
      redisClient.on("connect", function (err) {
        if (err) {
          logger.error(
            "[" +
              workerIdx +
              "] Redis reader client failed to connect to Redis: %o",
            err
          );
        } else {
          logger.debug("[" + myWorkerIdx + "] Redis reader client connected");
        }
      });
      await redisClient.connect();
      while (true) {
        await redisClient.select(helpers.INCOMING);
        for await (const si_key of redisClient.scanIterator()) {
          const si_value = await redisClient.get(si_key);
          if (si_value) {
            // logger.info("SI: %s => %s", si_key, si_value);
            // Get result from evaluation algorithm
            // If true, then do the transfer
            const shouldDo = evaluate(si_value);
            if (shouldDo) {
              // Move this entry to from incoming store to working store
              await redisClient.select(helpers.INCOMING);
              if ((await redisClient.del(si_key)) === 0) {
                logger.debug(
                  "[" +
                    myWorkerIdx +
                    "] The key [" +
                    si_key +
                    "] no longer exists in INCOMING"
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
            logger.error("[" + myWorkerIdx + "] No si_keyval returned!");
          }
        }
        // add sleep
        await helpers.sleep(3000);
      }

      logger.debug("[" + myWorkerIdx + "] worker exiting");
      await redisClient.quit();
    })();
    // Stagger the threads so they don't all wake up at once
    await helpers.sleep(500);
  }
}

function evaluate(blob: string) {
  // logger.info("Checking [%s]", blob);
  // if (blob.startsWith("01000000000100e", 14)) {
  // if (Math.floor(Math.random() * 5) == 1) {
  // logger.info("Evaluated true...");
  return true;
  // }
  // logger.info("Evaluated false...");
  // return false;
}

async function processRequest(rClient, key: string, connectionData: any) {
  logger.debug("Processing request [" + key + "]...");
  // Get the entry from the working store
  await rClient.select(helpers.WORKING);
  var value: string = await rClient.get(key);
  if (!value) {
    logger.error("processRequest could not find key [" + key + "]");
    return;
  }
  var storeKey = helpers.storeKeyFromJson(key);
  var payload: helpers.StoreWorkingPayload =
    helpers.workingPayloadFromJson(value);
  if (payload.status !== "Pending") {
    logger.info("This key [" + key + "] has already been processed.");
    return;
  }
  // Actually do the processing here and update status and time field
  try {
    logger.info(
      "processRequest() - Calling with vaa_bytes [" + payload.vaa_bytes + "]"
    );
    var relayResult = await relay(payload.vaa_bytes, connectionData);
    // logger.info("processRequest() - relay returned", relayResult);
    payload.status = relayResult;
  } catch (e) {
    logger.error("processRequest() - failed to relay transfer vaa: %o", e);
    payload.status = "Failed: " + e;
  }
  // Put result back into store
  payload.timestamp = new Date().toString();
  value = helpers.workingPayloadToJson(payload);
  await rClient.set(key, value);
}
