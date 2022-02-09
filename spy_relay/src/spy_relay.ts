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

// import { storeKeyFromParsedVAA, storePayloadFromVaaBytes } from "./helpers";
import * as helpers from "./helpers";

var pendingMap = new Map<string, string>();
pendingMap.set("XXX", "XXX should be first");
pendingMap.set("CCC", "CCC should be second");
pendingMap.set("XXX", "XXX should still be first");
pendingMap.set("AAA", "AAA should be third");

for (let [pk, pendingValue] of pendingMap) {
  console.log("key: [" + pk + "], value: [" + pendingValue + "]");
}

while (pendingMap.size !== 0) {
  const first = pendingMap.entries().next();

  console.log(
    "deleting first item, which is: key: [" +
      first.value[0] +
      "], value: [" +
      first.value[1] +
      "]"
  );

  pendingMap.delete(first.value[0]);

  for (let [pk, pendingValue] of pendingMap) {
    console.log("key: [" + pk + "], value: [" + pendingValue + "]");
  }
}

var listenOnly: boolean = false;
for (let idx = 0; idx < process.argv.length; ++idx) {
  if (process.argv[idx] === "--listen_only") {
    console.log("running in listen only mode, will not forward to redis");
    listenOnly = true;
    break;
  }
}

require("dotenv").config();
if (!process.env.SPY_SERVICE_HOST) {
  console.error("Missing environment variable SPY_SERVICE_HOST");
  process.exit(1);
}

// Connect to redis
import { createClient } from "redis";

async function connectToRedis() {
  var rClient = createClient();

  rClient.on("error", (err) => console.log("Redis Client Error", err));
  rClient.on("connect", (err) => console.log("Redis Client Connected", err));

  console.log("Attempting to connect...");

  await rClient.connect();
  return rClient;
}

async function storeInRedis(
  client: typeof myRedisClient,
  name: string,
  value: string
) {
  await (await client).set(name, value);
}

if (false) {
  var myRedisClient;
  if (!listenOnly) {
    myRedisClient = connectToRedis();
  }

  console.log(
    "spy_relay starting up, will listen for signed VAAs from [%s]",
    process.env.SPY_SERVICE_HOST
  );

  setDefaultWasm("node");

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

    const { parse_vaa } = await importCoreWasm();

    stream.on("data", ({ vaaBytes }) => {
      processVaa(parse_vaa, vaaBytes);
    });

    console.log("spy_relay waiting for transfer signed VAAs");
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

function processVaa(parse_vaa, vaaBytes) {
  // console.log(vaaBytes);
  const parsedVAA = parse_vaa(hexToUint8Array(vaaBytes));
  // console.log(parsedVAA);
  if (parsedVAA.payload[0] === 1) {
    if (!listenOnly) {
      var storeKey = helpers.storeKeyFromParsedVAA(parsedVAA);
      var storePayload = helpers.storePayloadFromVaaBytes(vaaBytes);
      //    console.log("storeKey: ", helpers.storeKeyToJson(storeKey));
      //    console.log("storePayload: ", helpers.storePayloadToJson(storePayload));
      var newStoreKey = helpers.storeKeyFromJson(JSON.stringify(storeKey));
      var newStorePayload = helpers.storeePayloadFromJson(
        JSON.stringify(storePayload)
      );
      //    console.log("newStoreKey: ", newStoreKey);
      //    console.log("newStorePayload: ", newStorePayload);
      storeInRedis(
        myRedisClient,
        helpers.storeKeyToJson(storeKey),
        helpers.storePayloadToJson(storePayload)
      );
    }

    var transferPayload = parseTransferPayload(Buffer.from(parsedVAA.payload));
    console.log(
      "transfer: emitter: [%d:%s], seqNum: %d, payload: origin: [%d:%s], target: [%d:%s],  amount: %d",
      parsedVAA.emitter_chain,
      uint8ArrayToHex(parsedVAA.emitter_address),
      parsedVAA.sequence,
      transferPayload.originChain,
      transferPayload.originAddress,
      transferPayload.targetChain,
      transferPayload.targetAddress,
      transferPayload.amount
    );
    // console.log(transferPayload);
  }
}
