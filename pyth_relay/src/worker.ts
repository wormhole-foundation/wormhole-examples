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
  key: string;
  lastTimePublished: Date;
  numTimesPublished: number;
  lastPa: helpers.PythPriceAttestation;
  lastResult: any;
};

type CurrentEntry = {
  pendingEntry: PendingPayload;
  currObj: ProductData;
};

var productMap = new Map<string, ProductData>(); // The key to this is price_id

var connectionData: main.ConnectionData;
var metrics: PromHelper;
var nextBalanceQueryTimeAsMs: number = 0;
var balanceQueryInterval = 0;
var walletTimeStamp: Date;

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
    if (!isNaN(balance)) {
      walletTimeStamp = new Date();
    }
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
    "entering callback, pendingEvents: " +
      pendingMap.size +
      ", err: %o, result: %o",
    err,
    result
  );
  // condition = null;
  // await helpers.sleep(10000);
  // logger.debug("done with long sleep");
  var done = false;
  do {
    var currObjs = new Array<CurrentEntry>();
    var messages = new Array<string>();

    await mutex.runExclusive(async () => {
      condition = null;
      logger.debug("in callback, getting pending events.");
      await getPendingEventsAlreadyLocked(currObjs, messages);

      if (currObjs.length === 0) {
        done = true;
        condition = new CondVar();
        await condition.wait(computeTimeout(), callBack);
      }
    });

    if (currObjs.length !== 0) {
      logger.debug("in callback, relaying " + currObjs.length + " events.");
      var sendTime = new Date();
      var retVal: number;
      var relayResult: any;
      [retVal, relayResult] = await relayEventsNotLocked(messages);

      await mutex.runExclusive(async () => {
        logger.debug("in callback, finalizing " + currObjs.length + " events.");
        await finalizeEventsAlreadyLocked(
          currObjs,
          retVal,
          relayResult,
          sendTime
        );

        if (pendingMap.size === 0) {
          logger.debug("in callback, rearming the condition.");
          done = true;
          condition = new CondVar();
          await condition.wait(computeTimeout(), callBack);
        }
      });
    }
  } while (!done);

  logger.debug("leaving callback.");
}

function computeTimeout(): number {
  if (balanceQueryInterval !== 0) {
    var now = new Date().getTime();
    if (now < nextBalanceQueryTimeAsMs) {
      return nextBalanceQueryTimeAsMs - now;
    }

    return 0;
  }

  return conditionTimeout;
}

async function getPendingEventsAlreadyLocked(
  currObjs: Array<CurrentEntry>,
  messages: Array<string>
) {
  for (let [pk, pendingValue] of pendingMap) {
    logger.debug("processing event with key [" + pk + "]");
    var pendingKey = pendingValue.pa.priceId;
    var currObj = productMap.get(pendingKey);
    if (currObj) {
      currObj.lastPa = pendingValue.pa;
      currObj.lastTimePublished = new Date();
      productMap.set(pendingKey, currObj);
      logger.debug(
        "processing update " +
          currObj.numTimesPublished +
          " for [" +
          pendingKey +
          "], seq num " +
          pendingValue.seqNum
      );

      currObjs.push({ pendingEntry: pendingValue, currObj: currObj });
      messages.push(pendingValue.vaa_bytes);
      pendingMap.delete(pendingKey);
    } else {
      logger.debug(
        "processing first update for [" +
          pendingKey +
          "], seq num " +
          pendingValue.seqNum
      );
      currObj = {
        key: pendingKey,
        lastPa: pendingValue.pa,
        lastTimePublished: new Date(),
        numTimesPublished: 0,
        lastResult: "",
      };
      productMap.set(pendingKey, currObj);

      currObjs.push({ pendingEntry: pendingValue, currObj: currObj });
      messages.push(pendingValue.vaa_bytes);
      pendingMap.delete(pendingKey);
    }
  }

  pendingMap.clear();
}

const RELAY_SUCCESS: number = 0;
const RELAY_FAIL: number = 1;
const RELAY_ALREADY_EXECUTED: number = 2;
const RELAY_TIMEOUT: number = 3;

async function relayEventsNotLocked(
  messages: Array<string>
): Promise<[number, any]> {
  var retVal: number = RELAY_SUCCESS;
  var relayResult: any;
  try {
    relayResult = await main.relay(messages, connectionData);
    if (relayResult.txhash) {
      if (
        relayResult.raw_log &&
        relayResult.raw_log.search("VaaAlreadyExecuted") >= 0
      ) {
        relayResult = "Already Executed: " + relayResult.txhash;
        retVal = RELAY_ALREADY_EXECUTED;
      } else if (
        relayResult.raw_log &&
        relayResult.raw_log.search("failed") >= 0
      ) {
        logger.error("relay seems to have failed: %o", relayResult);
        retVal = RELAY_FAIL;
      } else {
        relayResult = relayResult.txhash;
      }
    } else {
      retVal = RELAY_FAIL;
      if (relayResult.message) {
        relayResult = relayResult.message;
      } else {
        logger.error("No txhash: %o", relayResult);
        relayResult = "No txhash";
      }
    }
  } catch (e) {
    if (e.message.search("timeout") >= 0 && e.message.search("exceeded") >= 0) {
      logger.error("relay timed out: %o", e);
      retVal = RELAY_TIMEOUT;
    } else {
      logger.error("relay failed: %o", e);
      if (
        e.response &&
        e.response.data &&
        e.response.data.error &&
        e.response.data.error.search("VaaAlreadyExecuted") >= 0
      ) {
        relayResult = "Already Executed";
        retVal = RELAY_ALREADY_EXECUTED;
      } else {
        retVal = RELAY_FAIL;
        relayResult = "Error: " + e.message;
      }
    }
  }

  return [retVal, relayResult];
}

async function finalizeEventsAlreadyLocked(
  currObjs: Array<CurrentEntry>,
  retVal: number,
  relayResult: any,
  sendTime: Date
) {
  for (var idx = 0; idx < currObjs.length; ++idx) {
    var currObj = currObjs[idx].currObj;
    var currEntry = currObjs[idx].pendingEntry;
    currObj.lastResult = relayResult;
    currObj.numTimesPublished = currObj.numTimesPublished + 1;
    if (retVal == RELAY_SUCCESS) {
      metrics.incSuccesses();
    } else if (retVal == RELAY_ALREADY_EXECUTED) {
      metrics.incAlreadyExec();
    } else if (retVal == RELAY_TIMEOUT) {
      metrics.incTransferTimeout();
      metrics.incFailures();
    } else {
      metrics.incFailures();
    }
    productMap.set(currObj.key, currObj);

    var completeTime = new Date();
    metrics.setSeqNum(currEntry.seqNum);
    metrics.addCompleteTime(
      completeTime.getTime() - currEntry.receiveTime.getTime()
    );

    logger.info(
      "complete: priceId: " +
        currEntry.pa.priceId +
        ", seqNum: " +
        currEntry.seqNum +
        ", price: " +
        helpers.computePrice(currEntry.pa.price, currEntry.pa.exponent) +
        ", ci: " +
        helpers.computePrice(
          currEntry.pa.confidenceInterval,
          currEntry.pa.exponent
        ) +
        ", rcv2SendBegin: " +
        (sendTime.getTime() - currEntry.receiveTime.getTime()) +
        ", rcv2SendComplete: " +
        (completeTime.getTime() - currEntry.receiveTime.getTime()) +
        ", totalSends: " +
        currObj.numTimesPublished +
        ", result: " +
        relayResult
    );
  }

  var now = new Date();
  if (balanceQueryInterval > 0 && now.getTime() >= nextBalanceQueryTimeAsMs) {
    var balance = await main.queryBalance(connectionData);
    if (isNaN(balance)) {
      logger.error("failed to query wallet balance!");
    } else {
      if (!isNaN(balance)) {
        walletTimeStamp = new Date();
      }
      logger.info(
        "wallet balance: " +
          balance +
          ", update time: " +
          walletTimeStamp.toISOString()
      );
      metrics.setWalletBalance(balance);
    }
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
  var pendingKey = pa.priceId;
  // pendingKey = pendingKey + ":" + sequence;
  await mutex.runExclusive(() => {
    logger.debug("posting event with key [" + pendingKey + "]");
    pendingMap.set(pendingKey, event);
    if (condition) {
      logger.debug("hitting condition variable.");
      condition.complete(true);
    }
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

// Note that querying the contract does not update the sequence number, so we don't need to be locked.
export async function getPriceData(
  productId: string,
  priceId: string
): Promise<any> {
  var result: any;
  // await mutex.runExclusive(async () => {
  result = await main.query(productId, priceId);
  // });

  return result;
}
