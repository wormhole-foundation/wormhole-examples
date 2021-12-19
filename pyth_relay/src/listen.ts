import { createClient } from "redis";

import { relay } from "./relay/main";

import {
  ChainId,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  hexToNativeString,
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

import { importCoreWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";

import * as helpers from "./helpers";

var seqMap = new Map<string, number>();

export async function listen() {
  require("dotenv").config();
  if (!process.env.SPY_SERVICE_HOST) {
    console.error("Missing environment variable SPY_SERVICE_HOST");
    process.exit(1);
  }

  console.log(
    "pyth_relay starting up, will listen for signed VAAs from [%s]",
    process.env.SPY_SERVICE_HOST
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

    stream.on("data", ({ vaaBytes }) => {
      processVaa(vaaBytes);
    });

    console.log("pyth_relay listening for messages");
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
  console.log(
    "processVaa, vaa len: ",
    vaaBytes.length,
    ", payload len: ",
    parsedVAA.payload.length
  );
  console.log(parsedVAA);

  if (isPyth(parsedVAA.payload)) {
    if (parsedVAA.payload.length !== helpers.PYTH_PRICE_ATTESTATION_LENGTH) {
      console.error(
        "dropping vaa because the payload length is wrong: length:",
        parsedVAA.payload.length,
        ", expected length:",
        helpers.PYTH_PRICE_ATTESTATION_LENGTH,
        parsedVAA
      );
      return;
    }

    var pa = helpers.parsePythPriceAttestation(Buffer.from(parsedVAA.payload));

    var storeKey = helpers.storeKeyFromPriceAttestation(pa);
    var storeKeyStr: string = helpers.storeKeyToJson(storeKey);
    var lastSeqNum = seqMap.get(storeKeyStr);
    if (lastSeqNum) {
      if (lastSeqNum >= parsedVAA.sequence) {
        // console.log(
        //   "ignoring duplicate: emitter: [%d:%s], productId: [%s], priceId: [%s], seqNum: %d",
        //   parsedVAA.emitter_chain,
        //   uint8ArrayToHex(parsedVAA.emitter_address),
        //   pa.productId,
        //   pa.priceId,
        //   parsedVAA.sequence
        // );
        return;
      }
    }

    seqMap.set(storeKeyStr, parsedVAA.sequence);

    console.log(
      "processing: emitter: [%d:%s], seqNum: %d, magic: 0x%s, version: %d, payloadId: %d, productId: [%s], priceId: [%s], priceType: %d, price: %d, exponent: %d, confidenceInterval: %d, payload: [%s]",
      parsedVAA.emitter_chain,
      uint8ArrayToHex(parsedVAA.emitter_address),
      parsedVAA.sequence,
      pa.magic.toString(16),
      pa.version,
      hexToNativeString(pa.productId, CHAIN_ID_SOLANA),
      hexToNativeString(pa.priceId, CHAIN_ID_SOLANA),
      pa.priceId,
      pa.priceType,
      pa.price,
      pa.exponent,
      pa.confidenceInterval,
      uint8ArrayToHex(parsedVAA.payload)
    );

    // const myRedisClient = await connectToRedis();
    // if (myRedisClient) {
    //   console.log("Got a valid client from connect");
    // } else {
    //   console.error("Invalid client from connect");
    //   return;
    // }

    // var storePayload = helpers.storePayloadFromVaaBytes(vaaBytes);
    // await storeInRedis(
    //   myRedisClient,
    //   helpers.storeKeyToJson(storeKey),
    //   helpers.storePayloadToJson(storePayload)
    // );

    // await myRedisClient.quit();
    // } else {
    //   console.log(
    //     "dropping vaa, payload type %d",
    //     parsedVAA.payload[0],
    //     parsedVAA
    //   );
  } else {
    console.log("dropping non-pyth vaa");
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
      console.error("Redis writer client failed to connect to Redis:", err);
    } else {
      console.log("Redis writer client Connected");
    }
  });

  await rClient.connect();
  return rClient;
}

async function storeInRedis(redisClient, name: string, value: string) {
  if (!redisClient) {
    console.error("invalid redisClient");
    return;
  }
  if (!name) {
    console.error("invalid name");
    return;
  }
  if (!value) {
    console.error("invalid value");
    return;
  }
  await redisClient.select(helpers.INCOMING);
  await redisClient.set(name, value);
}
