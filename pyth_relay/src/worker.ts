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

import { uint8ArrayToHex } from "@certusone/wormhole-sdk";

import * as helpers from "./helpers";
import { logger } from "./helpers";
import { connectRelayer, relay } from "./relay/main";

const mutex = new Mutex();
// Note that Map remembers the order of the keys.

type PendingPayload = {
  vaa_bytes: string;
  pa: helpers.PythPriceAttestation;
  receiveTime: Date;
  seqNum: number;
};

var pendingMap = new Map<string, PendingPayload>(); // The key to this is price_id

type EntryData = {
  currWorker: number;
  lastTimePublished: string;
  numTimesPublished: number;
  lastPa: helpers.PythPriceAttestation;
  lastResult: any;
};

var productMap = new Map<string, EntryData>(); // The key to this is price_id

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
        await mutex.runExclusive(async () => {
          var foundSomething = false;
          var entryKey: string;
          var entryPayload: PendingPayload;
          var currObj: EntryData;

          // Go through the pending map and see if there's anything we can process (any product Id that's not already being processed).
          for (let [pendingKey, pendingValue] of pendingMap) {
            var pk: string = pendingKey;
            currObj = productMap.get(pendingKey);
            if (currObj) {
              if (currObj.currWorker === 0) {
                currObj.currWorker = myWorkerIdx;
                currObj.lastPa = pendingValue.pa;
                currObj.lastTimePublished = new Date().toISOString();
                productMap.set(pendingKey, currObj);
                logger.debug(
                  "[" + myWorkerIdx + "] processing update %d for [%s]",
                  currObj.numTimesPublished,
                  pk
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
              currObj = {
                lastPa: pendingValue.pa,
                currWorker: myWorkerIdx,
                lastTimePublished: new Date().toISOString(),
                numTimesPublished: 0,
                lastResult: "",
              };
              productMap.set(pendingKey, currObj);

              foundSomething = true;
              entryKey = pendingKey;
              entryPayload = pendingValue;
              pendingMap.delete(pendingKey);
              break;
            }
          }

          if (foundSomething) {
            logger.debug(
              "[" + myWorkerIdx + "] processing message: [%s]",
              entryKey
            );
            var sendTime = new Date();
            var relayResult: any;
            var success = true;
            try {
              relayResult = await relay(entryPayload.vaa_bytes, connectionData);
              if (relayResult.txhash) {
                relayResult = relayResult.txhash;
              } else if (relayResult.message) {
                relayResult = relayResult.message;
              }
            } catch (e) {
              logger.error("[" + myWorkerIdx + "] relay failed: %o", e);
              relayResult = "Error: " + e.message;
              success = false;
            }

            currObj.currWorker = 0;
            currObj.lastResult = relayResult;
            if (success) {
              currObj.numTimesPublished = currObj.numTimesPublished + 1;
            }
            productMap.set(entryKey, currObj);

            var completeTime = new Date();

            logger.info(
              "complete: priceId: " +
                entryPayload.pa.priceId +
                ", seqNum: " +
                entryPayload.seqNum +
                ", price: " +
                helpers.computePrice(
                  entryPayload.pa.price,
                  entryPayload.pa.exponent
                ) +
                ", ci: " +
                helpers.computePrice(
                  entryPayload.pa.confidenceInterval,
                  entryPayload.pa.exponent
                ) +
                ", rcv2SendBegin: " +
                (sendTime.getTime() - entryPayload.receiveTime.getTime()) +
                ", rcv2SendComplete: " +
                (completeTime.getTime() - entryPayload.receiveTime.getTime()) +
                ", totalSends: " +
                currObj.numTimesPublished +
                ", result: " +
                relayResult
            );
          }
        });

        // add sleep
        await helpers.sleep(3000);
      }
    })();

    // Stagger the threads so they don't all wake up at once
    await helpers.sleep(500);
  }
}

export async function postEvent(
  vaaBytes: any,
  pa: helpers.PythPriceAttestation,
  sequence: number,
  receiveTime: Date
) {
  var event: PendingPayload = {
    vaa_bytes: uint8ArrayToHex(vaaBytes),
    pa: pa,
    receiveTime: receiveTime,
    seqNum: sequence,
  };
  await mutex.runExclusive(() => {
    pendingMap.set(pa.priceId, event);
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

      var item: object = {
        product_id: value.lastPa.productId,
        price_id: value.lastPa.priceId,
        price: helpers.computePrice(value.lastPa.price, value.lastPa.exponent),
        ci: helpers.computePrice(
          value.lastPa.confidenceInterval,
          value.lastPa.exponent
        ),
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
