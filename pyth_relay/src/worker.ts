import {
  Mutex,
  MutexInterface,
  Semaphore,
  SemaphoreInterface,
  withTimeout,
} from "async-mutex";

import {
  importCoreWasm,
  setDefaultWasm,
} from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import * as helpers from "./helpers";
import { logger } from "./helpers";
import { connectRelayer, relay } from "./relay/main";

const mutex = new Mutex();
// Note that Map remembers the order of the keys.
var pendingMap = new Map<string, helpers.StorePayload>(); // The key to this is helpers.storeKeyToJson(storeKey)

type EntryData = {
  currWorker: number;
  lastTimePublished: string;
  numTimesPublished: number;
  lastResult: any;
};

var productMap = new Map<string, EntryData>(); // The key to this is helpers.storeKeyToJson(storeKey)

export async function worker() {
  require("dotenv").config();
  var numWorkers = 1;
  if (process.env.NUM_WORKERS) {
    numWorkers = parseInt(process.env.NUM_WORKERS);
    logger.info("will use " + numWorkers + " workers ");
  }

  setDefaultWasm("node");

  for (var workerIdx = 1; workerIdx <= numWorkers; ++workerIdx) {
    logger.debug("[" + workerIdx + "] starting worker ");
    (async () => {
      let myWorkerIdx = workerIdx;
      let connectionData = connectRelayer(myWorkerIdx);
      while (true) {
        var foundSomething = false;
        var entryKey: string;
        var entryPayload: helpers.StorePayload;
        await mutex.runExclusive(() => {
          // Go through the pending map and see if there's anything we can process (any product Id that's not already being processed).
          for (let [pendingKey, pendingValue] of pendingMap) {
            let currObj = productMap.get(pendingKey);
            if (currObj) {
              if (currObj.currWorker === 0) {
                currObj.currWorker = myWorkerIdx;
                currObj.lastTimePublished = new Date().toISOString();
                productMap.set(pendingKey, currObj);
                logger.debug(
                  "[" + myWorkerIdx + "] processing update %d for [%s]",
                  currObj.numTimesPublished,
                  pendingKey
                );

                foundSomething = true;
                entryKey = pendingKey;
                entryPayload = pendingValue;
                pendingMap.delete(pendingKey);
                break;
              } else {
                logger.debug(
                  "[" + myWorkerIdx + "] entry [%s] is busy, worker is %d",
                  pendingKey,
                  currObj.currWorker
                );
              }
            } else {
              logger.debug(
                "[" +
                  myWorkerIdx +
                  "] this is the first time we are seeing [%s]",
                pendingKey
              );
              productMap.set(pendingKey, {
                currWorker: myWorkerIdx,
                lastTimePublished: new Date().toISOString(),
                numTimesPublished: 0,
                lastResult: "",
              });

              foundSomething = true;
              entryKey = pendingKey;
              entryPayload = pendingValue;
              pendingMap.delete(pendingKey);
              break;
            }
          }
        });

        if (foundSomething) {
          logger.debug(
            "[" + myWorkerIdx + "] processing message: [%s]",
            entryKey
          );
          var relayResult: any;
          var success = true;
          try {
            relayResult = await relay(entryPayload.vaa_bytes, connectionData);
            if (relayResult.txhash) {
              relayResult = { txhash: relayResult.txhash };
            } else if (relayResult.message) {
              relayResult = "message: " + relayResult.message;
            }
          } catch (e) {
            logger.error("[" + myWorkerIdx + "] relay failed: %o", e);
            relayResult = "Error: " + e.message;
            success = false;
          }
          await mutex.runExclusive(() => {
            logger.debug(
              "[" + myWorkerIdx + "] done processing message: [%s]",
              entryKey
            );
            let currObj = productMap.get(entryKey);
            currObj.currWorker = 0;
            currObj.lastResult = relayResult;
            if (success) {
              currObj.numTimesPublished = currObj.numTimesPublished + 1;
            }
            productMap.set(entryKey, currObj);
          });
        }

        // add sleep
        await helpers.sleep(3000);
      }
    })();

    // Stagger the threads so they don't all wake up at once
    await helpers.sleep(500);
  }
}

export async function postEvent(
  storeKeyStr: string,
  storePayload: helpers.StorePayload
) {
  await mutex.runExclusive(() => {
    pendingMap.set(storeKeyStr, storePayload);
  });
}

export async function getStatus() {
  var result = "[";
  await mutex.runExclusive(() => {
    var first: boolean = true;
    for (let [key, value] of productMap) {
      if (first) {
        first = false;
      } else {
        result = result + ", ";
      }

      var storeKey = helpers.storeKeyFromJson(key);
      var item: object = {
        product_id: storeKey.product_id,
        price_id: storeKey.price_id,
        num_times_published: value.numTimesPublished,
        last_time_published: value.lastTimePublished,
        curr_being_processed_by: value.currWorker,
        result: value.lastResult,
      };

      result = result + JSON.stringify(item);
    }
  });

  result = result + "]";
  return result;
}
