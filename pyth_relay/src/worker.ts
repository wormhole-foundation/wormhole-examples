import { Mutex } from "async-mutex";
var CondVar = require("condition-variable");

import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";
import { uint8ArrayToHex } from "@certusone/wormhole-sdk";

import * as helpers from "./helpers";
import { logger } from "./helpers";
import * as main from "./relay/main";
import { PromHelper } from "./promHelpers";

const mutex = new Mutex();
var condition = new CondVar();
var conditionTimeout = 20000;

type PendingPayload = {
  vaa_bytes: string;
  pa: helpers.PythPriceAttestation;
  receiveTime: Date;
  seqNum: number;
};

var pendingMap = new Map<string, PendingPayload>(); // The key to this is price_id. Note that Map maintains insertion order, not key order.

type ProductData = {
  busy: boolean;
  lastTimePublished: Date;
  numTimesPublished: number;
  lastPa: helpers.PythPriceAttestation;
  lastResult: any;
};

var productMap = new Map<string, ProductData>(); // The key to this is price_id

var connectionData: main.ConnectionData;
var metrics: PromHelper;
var nextBalanceQueryTimeAsMs: number = 0;
var balanceQueryInterval = 0;

export async function worker(met: PromHelper) {
  setDefaultWasm("node");
  require("dotenv").config();

  await mutex.runExclusive(async () => {
    connectionData = main.connectRelayer();
    metrics = met;

    if (process.env.BAL_QUERY_INTERVAL) {
      balanceQueryInterval = parseInt(process.env.BAL_QUERY_INTERVAL);
    }

    var balance = await main.queryBalance(connectionData);
    if (balanceQueryInterval !== 0) {
      logger.info(
        "initial wallet balance is " +
          balance +
          ", will query every " +
          balanceQueryInterval +
          " milliseconds."
      );
      metrics.setWalletBalance(balance);

      nextBalanceQueryTimeAsMs = new Date().getTime() + balanceQueryInterval;
    } else {
      logger.info("initial wallet balance is " + balance);
      metrics.setWalletBalance(balance);
    }

    await condition.wait(computeTimeout(), callBack);
  });
}

async function callBack(err: any, result: any) {
  logger.debug(
    "in callback, processing events, err: %o, result: %o",
    err,
    result
  );
  await mutex.runExclusive(async () => {
    await processEventsAlreadyLocked();

    logger.debug("in callback, rearming the condition.");
    condition = new CondVar();
    await condition.wait(computeTimeout(), callBack);
  });
}

function computeTimeout(): number {
  if (balanceQueryInterval != 0) {
    var now = new Date().getTime();
    if (now < nextBalanceQueryTimeAsMs) {
      return nextBalanceQueryTimeAsMs - now;
    }

    return 0;
  }

  return conditionTimeout;
}

async function processEventsAlreadyLocked() {
  var foundSomething: boolean;
  do {
    foundSomething = false;
    var entryKey: string;
    var entryPayload: PendingPayload;
    var currObj: ProductData;

    // Go through the pending map and see if there's anything we can process (any product Id that's not already being processed).
    for (let [pendingKey, pendingValue] of pendingMap) {
      var pk: string = pendingKey;
      currObj = productMap.get(pendingKey);
      if (currObj) {
        if (!currObj.busy) {
          currObj.busy = true;
          currObj.lastPa = pendingValue.pa;
          currObj.lastTimePublished = new Date();
          productMap.set(pendingKey, currObj);
          logger.debug(
            "processing update %d for [%s]",
            currObj.numTimesPublished,
            pk
          );

          foundSomething = true;
          entryKey = pendingKey;
          entryPayload = pendingValue;
          pendingMap.delete(pendingKey);
          break;
        } else {
          logger.error(
            "entry [%s] is already busy, this should not happen!",
            pendingKey
          );
        }
      } else {
        logger.debug("this is the first time we are seeing [%s]", pendingKey);
        currObj = {
          lastPa: pendingValue.pa,
          busy: true,
          lastTimePublished: new Date(),
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
      var sendTime = new Date();
      var relayResult: any;
      var success = true;
      try {
        relayResult = await main.relay(entryPayload.vaa_bytes, connectionData);
        if (relayResult.txhash) {
          relayResult = relayResult.txhash;
        } else if (relayResult.message) {
          relayResult = relayResult.message;
        }
      } catch (e) {
        logger.error("relay failed: %o", e);
        relayResult = "Error: " + e.message;
        success = false;
      }

      currObj.busy = false;
      currObj.lastResult = relayResult;
      if (success) {
        currObj.numTimesPublished = currObj.numTimesPublished + 1;
        metrics.incSuccesses();
      } else {
        metrics.incFailures();
      }
      productMap.set(entryKey, currObj);

      var completeTime = new Date();
      metrics.setSeqNum(entryPayload.seqNum);
      metrics.addCompleteTime(
        completeTime.getTime() - entryPayload.receiveTime.getTime()
      );

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
  } while (foundSomething);

  var now = new Date();
  if (balanceQueryInterval > 0 && now.getTime() >= nextBalanceQueryTimeAsMs) {
    var balance = await main.queryBalance(connectionData);
    logger.info("wallet balance: " + balance);
    nextBalanceQueryTimeAsMs = now.getTime() + balanceQueryInterval;
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
    condition.complete(true);
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
        last_time_published: value.lastTimePublished.toISOString(),
        result: value.lastResult,
      };

      result = result + JSON.stringify(item);
    }
  });

  result = result + "]";
  return result;
}

export async function getPriceData(priceId: string): Promise<any> {
  var result: any;
  await mutex.runExclusive(async () => {
    result = await main.query(priceId);
  });

  return result;
}
