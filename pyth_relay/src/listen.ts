import { createClient } from "redis";

import {
  ChainId,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  hexToUint8Array,
  uint8ArrayToHex,
  getEmitterAddressEth,
  getEmitterAddressSolana,
  getEmitterAddressTerra,
} from "@certusone/wormhole-sdk";

import {
  createSpyRPCServiceClient,
  subscribeSignedVAA,
} from "@certusone/wormhole-spydk";

import { importCoreWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import * as helpers from "./helpers";
import { logger } from "./helpers";

var seqMap = new Map<string, number>();

export async function listen() {
  require("dotenv").config();
  if (!process.env.SPY_SERVICE_HOST) {
    logger.error("Missing environment variable SPY_SERVICE_HOST");
    process.exit(1);
  }

  logger.info(
    "pyth_relay starting up, will listen for signed VAAs from [" +
      process.env.SPY_SERVICE_HOST +
      "]"
  );

  // Connect to redis globally
  // var myRedisClient;
  // async () => {
  //   myRedisClient = await connectToRedis();
  // };

  (async () => {
    var filter = {};
    if (process.env.SPY_SERVICE_FILTERS) {
      const parsedJsonFilters = eval(process.env.SPY_SERVICE_FILTERS);

      var myFilters = [];
      for (var i = 0; i < parsedJsonFilters.length; i++) {
        var myChainId = parseInt(parsedJsonFilters[i].chain_id) as ChainId;
        var myEmitterAddress = parsedJsonFilters[i].emitter_address;
        // var myEmitterAddress = await encodeEmitterAddress(
        //   myChainId,
        //   parsedJsonFilters[i].emitter_address
        // );
        var myEmitterFilter = {
          emitterFilter: {
            chainId: myChainId,
            emitterAddress: myEmitterAddress,
          },
        };
        logger.info(
          "adding filter: chainId: [" +
            myEmitterFilter.emitterFilter.chainId +
            "], emitterAddress: [" +
            myEmitterFilter.emitterFilter.emitterAddress +
            "]"
        );
        myFilters.push(myEmitterFilter);
      }

      logger.info("setting " + myFilters.length + " filters");
      filter = {
        filters: myFilters,
      };
    } else {
      logger.info("processing all signed VAAs");
    }

    const client = createSpyRPCServiceClient(process.env.SPY_SERVICE_HOST);
    const stream = await subscribeSignedVAA(client, filter);

    stream.on("data", ({ vaaBytes }) => {
      processVaa(vaaBytes);
    });

    logger.info("pyth_relay listening for messages");
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

async function processVaa(vaaBytes: string) {
  const { parse_vaa } = await importCoreWasm();
  const parsedVAA = parse_vaa(hexToUint8Array(vaaBytes));
  // logger.debug(
  //   "processVaa, vaa len: " +
  //     vaaBytes.length +
  //     ", payload len: " +
  //     parsedVAA.payload.length
  // );

  // logger.debug("listen:processVaa: parsedVAA: %o", parsedVAA);

  if (isPyth(parsedVAA.payload)) {
    if (parsedVAA.payload.length !== helpers.PYTH_PRICE_ATTESTATION_LENGTH) {
      logger.error(
        "dropping vaa because the payload length is wrong: length: " +
          parsedVAA.payload.length +
          ", expected length:",
        helpers.PYTH_PRICE_ATTESTATION_LENGTH + ", vaa: %o",
        parsedVAA
      );
      return;
    }

    var pa = helpers.parsePythPriceAttestation(Buffer.from(parsedVAA.payload));
    // logger.debug("listen:processVaa: price attestation: %o", pa);

    var storeKey = helpers.storeKeyFromPriceAttestation(pa);
    var storeKeyStr: string = helpers.storeKeyToJson(storeKey);
    var lastSeqNum = seqMap.get(storeKeyStr);
    if (lastSeqNum) {
      if (lastSeqNum >= parsedVAA.sequence) {
        logger.debug(
          "ignoring duplicate: emitter: [" +
            parsedVAA.emitter_chain +
            ":" +
            uint8ArrayToHex(parsedVAA.emitter_address) +
            "], productId: [" +
            pa.productId +
            "], priceId: [" +
            pa.priceId +
            "], seqNum: " +
            parsedVAA.sequence
        );
        return;
      }
    }

    seqMap.set(storeKeyStr, parsedVAA.sequence);

    logger.info(
      "processing: emitter: [" +
        parsedVAA.emitter_chain +
        ":" +
        uint8ArrayToHex(parsedVAA.emitter_address) +
        "], productId: [" +
        pa.productId +
        "], priceId: [" +
        pa.priceId +
        "], seqNum: " +
        parsedVAA.sequence +
        ", productId: [" +
        pa.productId +
        "], priceId: [" +
        pa.priceId +
        "], priceType: " +
        pa.priceType +
        ", price: " +
        pa.price +
        ", exponent: " +
        pa.exponent +
        ", confidenceInterval: " +
        pa.confidenceInterval +
        ", timeStamp: " +
        pa.timestamp +
        ", payload: [" +
        uint8ArrayToHex(parsedVAA.payload) +
        "]"
    );

    const myRedisClient = await connectToRedis();
    if (myRedisClient) {
      logger.debug("Got a valid client from connect");
    } else {
      logger.error("Invalid client from connect");
      return;
    }

    var storePayload = helpers.storePayloadFromVaaBytes(vaaBytes);
    await storeInRedis(
      myRedisClient,
      helpers.storeKeyToJson(storeKey),
      helpers.storePayloadToJson(storePayload)
    );

    await myRedisClient.quit();
  } else {
    logger.debug(
      "dropping non-pyth vaa, payload type " +
        parsedVAA.payload[0] +
        ", vaa: %o",
      parsedVAA
    );
  }
}

function isPyth(payload): boolean {
  if (payload.length < 4) return false;
  if (
    payload[0] === 80 &&
    payload[1] === 50 &&
    payload[2] === 87 &&
    payload[3] === 72
  ) {
    // P2WH
    return true;
  }

  return false;
}

async function connectToRedis() {
  var rClient = createClient();

  rClient.on("connect", function (err) {
    if (err) {
      logger.error("Redis writer client failed to connect to Redis: %o", err);
    } else {
      logger.debug("Redis writer client Connected");
    }
  });

  await rClient.connect();
  return rClient;
}

async function storeInRedis(redisClient, name: string, value: string) {
  if (!redisClient) {
    logger.error("invalid redisClient");
    return;
  }
  if (!name) {
    logger.error("invalid name");
    return;
  }
  if (!value) {
    logger.error("invalid value");
    return;
  }
  await redisClient.select(helpers.INCOMING);
  await redisClient.set(name, value);
}
